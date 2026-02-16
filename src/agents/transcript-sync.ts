import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import process from 'node:process'
import { join, resolve } from 'pathe'
import { logger } from '../utils/logger'

interface TranscriptEntry {
  role: string
  message: {
    content: Array<{ type: string, text?: string }>
  }
}

/**
 * Derive the Cursor project slug used for internal storage paths.
 *
 * Cursor maps `D:\projects\clawflow\playground` → `d-projects-clawflow-playground`.
 */
function deriveProjectSlug(projectPath: string): string {
  return projectPath
    .replace(/^[A-Z]:/i, m => m[0].toLowerCase())
    .split(/[:\\/]/)
    .filter(Boolean)
    .join('-')
}

/**
 * Locate the agent-transcripts directory for the current project.
 *
 * Tries several strategies:
 * 1. Derive from cwd → `~/.cursor/projects/{slug}/agent-transcripts/`
 * 2. Walk up from cwd looking for `.agentic` sibling of `.cursor`
 */
export function findTranscriptDir(): string | undefined {
  const cwd = resolve(process.cwd())
  const home = homedir()

  // Strategy 1: derive slug from cwd
  const slug = deriveProjectSlug(cwd)
  const candidate = join(home, '.cursor', 'projects', slug, 'agent-transcripts')
  if (existsSync(candidate)) {
    return candidate
  }

  // Strategy 2: try parent directories (playground → clawflow → projects)
  let dir = cwd
  for (let i = 0; i < 4; i++) {
    const parentSlug = deriveProjectSlug(dir)
    const parentCandidate = join(home, '.cursor', 'projects', parentSlug, 'agent-transcripts')
    if (existsSync(parentCandidate)) {
      return parentCandidate
    }
    const parent = resolve(dir, '..')
    if (parent === dir)
      break
    dir = parent
  }

  return undefined
}

/**
 * Read a transcript `.jsonl` file and return parsed entries.
 */
export function readTranscript(transcriptPath: string): TranscriptEntry[] {
  if (!existsSync(transcriptPath))
    return []
  const raw = readFileSync(transcriptPath, 'utf-8')
  const entries: TranscriptEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim())
      continue
    try {
      entries.push(JSON.parse(line))
    }
    catch {
      // skip malformed lines
    }
  }
  return entries
}

/**
 * Format transcript entries into human-readable log lines.
 */
export function formatTranscriptForLog(entries: TranscriptEntry[]): string {
  const lines: string[] = []
  for (const entry of entries) {
    const role = entry.role === 'user' ? '[USER]' : '[ASSISTANT]'
    const texts = entry.message?.content
      ?.filter(c => c.type === 'text' && c.text)
      .map(c => c.text!) ?? []
    if (texts.length > 0) {
      lines.push(`${role} ${texts.join('\n')}`)
    }
  }
  return lines.join('\n\n')
}

/**
 * Sync an agent transcript into the task log file.
 *
 * Reads the transcript `.jsonl`, formats it, and appends any new content
 * to the log file. Idempotent: tracks a marker to avoid duplicate appends.
 *
 * @returns The number of new entries synced, or -1 if transcript was not found.
 */
export function syncTranscriptToLog(
  sessionId: string,
  logFile: string,
  transcriptDir?: string,
): number {
  const dir = transcriptDir ?? findTranscriptDir()
  if (!dir) {
    logger.debug('syncTranscriptToLog: could not locate agent-transcripts directory')
    return -1
  }

  const transcriptPath = join(dir, `${sessionId}.jsonl`)
  if (!existsSync(transcriptPath)) {
    logger.debug(`syncTranscriptToLog: transcript file not found: ${transcriptPath}`)
    return -1
  }

  const entries = readTranscript(transcriptPath)
  if (entries.length === 0)
    return 0

  // Read existing log to check how many entries we already synced
  const SYNC_MARKER = '[transcript-sync]'
  let existingLog = ''
  if (existsSync(logFile)) {
    existingLog = readFileSync(logFile, 'utf-8')
  }

  // Count existing synced entries by marker lines
  const markerPattern = /\[transcript-sync\] entry \d+/g
  const syncedCount = (existingLog.match(markerPattern) || []).length
  const newEntries = entries.slice(syncedCount)
  if (newEntries.length === 0)
    return 0

  // Format and append new entries
  const lines: string[] = []
  for (let i = 0; i < newEntries.length; i++) {
    const entry = newEntries[i]
    const entryIdx = syncedCount + i
    const role = entry.role === 'user' ? 'USER' : 'ASSISTANT'
    const texts = entry.message?.content
      ?.filter(c => c.type === 'text' && c.text)
      .map(c => c.text!) ?? []
    lines.push(`${SYNC_MARKER} entry ${entryIdx} (${role})`)
    lines.push(texts.join('\n'))
    lines.push('')
  }

  writeFileSync(logFile, `${existingLog}\n${lines.join('\n')}`, 'utf-8')
  logger.debug(`syncTranscriptToLog: synced ${newEntries.length} new entries to ${logFile}`)
  return newEntries.length
}
