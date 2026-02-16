import type { TaskAgent } from './types'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'pathe'

export async function loadAgents(directories: string[]): Promise<TaskAgent[]> {
  const agents: TaskAgent[] = []
  for (const dir of directories) {
    try {
      const files = await readdir(dir)
      for (const file of files) {
        try {
          if (file.endsWith('.json')) {
            const content = await readFile(join(dir, file), 'utf-8')
            const parsed = JSON.parse(content)
            agents.push(toTaskAgent(parsed))
          }
          else if (file.endsWith('.md')) {
            const content = await readFile(join(dir, file), 'utf-8')
            const parsed = parseAgentMarkdown(content, file)
            agents.push(toTaskAgent(parsed))
          }
        }
        catch { /* skip invalid files */ }
      }
    }
    catch { /* directory may not exist */ }
  }
  return agents
}

function parseAgentMarkdown(content: string, filename: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Parse frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fmMatch) {
    const fmBlock = fmMatch[1]
    for (const line of fmBlock.split(/\r?\n/)) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        result[key] = value
      }
    }
  }

  // Derive id from frontmatter name or filename
  if (!result.id) {
    result.id = (result.name as string) ?? filename.replace(/\.md$/, '')
  }

  // Parse ## Capabilities section
  result.capabilities = parseMdListSection(content, 'Capabilities')

  // Parse ## Specialties section
  result.specialties = parseMdListSection(content, 'Specialties')

  // Wrap description into metadata
  if (result.description) {
    result.metadata = { description: result.description }
  }

  return result
}

function parseMdListSection(content: string, heading: string): string[] {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\r?\\n([\\s\\S]*?)(?=\\n##\\s|$)`)
  const match = content.match(pattern)
  if (!match)
    return []

  const items: string[] = []
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      items.push(trimmed.slice(2).trim())
    }
  }
  return items
}

function toTaskAgent(raw: Record<string, unknown>): TaskAgent {
  const r = raw as Record<string, any>
  return {
    id: r.id ?? generateId(),
    name: r.name ?? 'Unknown',
    type: r.type ?? 'generic',
    capabilities: r.capabilities ?? [],
    specialties: r.specialties ?? [],
    status: 'idle',
    config: {
      maxConcurrentTasks: r.config?.maxConcurrentTasks ?? 1,
      timeout: r.config?.timeout ?? 1800000,
      retryStrategy: {
        maxRetries: r.config?.retryStrategy?.maxRetries ?? 3,
        backoff: r.config?.retryStrategy?.backoff ?? 'exponential',
        initialDelay: r.config?.retryStrategy?.initialDelay ?? 1000,
        maxDelay: r.config?.retryStrategy?.maxDelay ?? 60000,
      },
    },
    statistics: { totalTasks: 0, completedTasks: 0, failedTasks: 0, averageDuration: 0, successRate: 0 },
    metadata: r.metadata ?? {},
  }
}

function generateId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
