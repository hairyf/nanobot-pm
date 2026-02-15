import type { TaskAgent } from './types'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'pathe'

export async function loadAgents(directories: string[]): Promise<TaskAgent[]> {
  const agents: TaskAgent[] = []
  for (const dir of directories) {
    try {
      const files = await readdir(dir)
      for (const file of files) {
        if (!file.endsWith('.json'))
          continue
        try {
          const content = await readFile(join(dir, file), 'utf-8')
          const parsed = JSON.parse(content)
          agents.push(toTaskAgent(parsed))
        }
        catch { /* skip invalid files */ }
      }
    }
    catch { /* directory may not exist */ }
  }
  return agents
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
