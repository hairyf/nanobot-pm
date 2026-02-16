import type { Buffer } from 'node:buffer'
import type { Agent, LaunchOptions } from '../config/define'
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { dirname, join } from 'pathe'
import { x } from 'tinyexec'
import { logger } from '../utils/logger'
/**
 * Ensure `.claude/settings.json` exists with `bypassPermissions` so Claude Code
 * can execute all tools (Bash, Read, Write, etc.) without interactive approval.
 *
 * @see auto-company's approach: project-level permission config
 */
function ensureClaudeSettings(cwd: string): void {
  const settingsDir = join(cwd, '.claude')
  const settingsPath = join(settingsDir, 'settings.json')

  if (existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      if (existing?.permissions?.defaultMode === 'bypassPermissions')
        return
    }
    catch {}
  }

  mkdirSync(settingsDir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify({
    permissions: {
      defaultMode: 'bypassPermissions',
      allow: ['Bash', 'Read', 'Write', 'Edit', 'WebFetch', 'WebSearch'],
      ask: [],
      deny: [],
    },
  }, null, 2), 'utf-8')
  logger.debug(`ensureClaudeSettings: created ${settingsPath}`)
}

/**
 * Ensure `.cursor/cli.json` exists with full permissions so the Cursor Agent CLI
 * can execute Shell, Read, Write without interactive approval when used with `--force`.
 *
 * @see https://cursor.com/docs/cli/reference/permissions
 */
function ensureCursorSettings(cwd: string): void {
  const settingsDir = join(cwd, '.cursor')
  const settingsPath = join(settingsDir, 'cli.json')

  if (existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      if (existing?.permissions?.allow?.length > 0)
        return
    }
    catch {}
  }

  mkdirSync(settingsDir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify({
    permissions: {
      allow: [
        'Shell(pnpm)',
        'Shell(npm)',
        'Shell(node)',
        'Shell(echo)',
        'Shell(cat)',
        'Shell(ls)',
        'Shell(git)',
        'Read(**)',
        'Write(**)',
      ],
      deny: [],
    },
  }, null, 2), 'utf-8')
  logger.debug(`ensureCursorSettings: created ${settingsPath}`)
}

/**
 * Build a short, single-line reference message for the agent.
 *
 * Instead of passing the full multi-line prompt as a CLI argument (which gets
 * truncated on Windows), we write the prompt to a file and tell the agent
 * to read it.
 */
function buildReferenceMessage(promptFile: string, taskId?: string): string {
  const lines: string[] = []
  lines.push(`Read the file at ${promptFile} and execute the task described within.`)
  if (taskId) {
    lines.push(`Task ID: ${taskId}`)
    lines.push(`When done, run: pnpm agentic complete ${taskId} --output "summary"`)
  }
  return lines.join(' ')
}

/**
 * Write a log header to the log file (shared by both cursor and claude adapters).
 */
function writeLogHeader(logFile: string, platform: string, sessionId: string, taskId: string, promptFile?: string): void {
  mkdirSync(dirname(logFile), { recursive: true })
  writeFileSync(logFile, [
    `[${platform}.launch] sessionId: ${sessionId}`,
    `[${platform}.launch] time: ${new Date().toISOString()}`,
    `[${platform}.launch] taskId: ${taskId}`,
    promptFile ? `[${platform}.launch] promptFile: ${promptFile}` : '',
    '',
  ].filter(Boolean).join('\n'), 'utf-8')
}

/**
 * Spawn a background process using tinyexec x().
 *
 * Uses x() directly (no detached stdio redirection) — this resolves .ps1/.cmd
 * scripts correctly on Windows. The child process is unref'd so the parent
 * CLI can exit; on Windows child processes survive parent exit by default.
 */
function spawnBackground(cmd: string, args: string[], logFile?: string): ReturnType<typeof x> {
  logger.debug(`[spawnBackground] cmd=${cmd} args=${JSON.stringify(args.slice(0, -1).concat(['<prompt>']))}`)

  const result = x(cmd, args, { nodeOptions: { detached: true } })
  const child = result.process

  logger.debug(`[spawnBackground] spawned pid=${child?.pid ?? 'none'}`)

  if (child) {
    // Pipe stdout/stderr to log file
    if (logFile) {
      child.stdout?.on('data', (chunk: Buffer) => {
        try {
          appendFileSync(logFile, chunk)
        }
        catch {}
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        try {
          appendFileSync(logFile, chunk)
        }
        catch {}
      })
    }

    child.on('error', (err) => {
      logger.error(`[spawnBackground] process error: ${err.message}`)
      if (logFile) {
        try {
          appendFileSync(logFile, `\n[ERROR] ${err.message}\n`)
        }
        catch {}
      }
    })

    child.on('exit', (code, signal) => {
      logger.debug(`[spawnBackground] exit code=${code} signal=${signal}`)
      if (logFile) {
        try {
          appendFileSync(logFile, `\n[exit] code=${code} signal=${signal}\n`)
        }
        catch {}
      }
    })

    // Unref so parent CLI can exit while child continues
    child.unref()
  }
  else {
    logger.error(`[spawnBackground] no child process returned for "${cmd}"`)
  }

  return result
}

export const claude: Agent = {
  fresh: async (system: string) => {
    const sessionId = randomUUID()
    await x(
      'claude',
      ['--session-id', sessionId, '--append-system-prompt', system, '-p', 'init'],
      { nodeOptions: { stdio: 'inherit' } },
    )
    return sessionId
  },

  launch: async (system: string, prompt: string, options?: LaunchOptions) => {
    const sessionId = randomUUID()
    const taskId = options?.taskId ?? 'unknown'

    ensureClaudeSettings(process.cwd())

    if (options?.logFile) {
      writeLogHeader(options.logFile, 'claude', sessionId, taskId, options.promptFile)
    }

    const userPrompt = options?.promptFile
      ? `Read and execute the task in ${options.promptFile}`
      : prompt

    logger.debug(`[claude.launch] taskId=${taskId} sessionId=${sessionId}`)
    spawnBackground(
      'claude',
      ['--session-id', sessionId, '-p', userPrompt],
      options?.logFile,
    )

    return sessionId
  },

  start: async (session: string) =>
    x('claude', ['-r', session], { nodeOptions: { stdio: 'inherit' } }),
  reply: async (session: string, message: string) =>
    x('claude', ['-p', message, '-r', session], { nodeOptions: { stdio: 'inherit' } }),
  clear: async (session: string) =>
    x('claude', ['-r', session], { nodeOptions: { stdio: 'inherit' } }),
}

export const cursor: Agent = {
  fresh: async (system: string, prompt?: string) => {
    logger.debug('cursor.fresh: creating new chat session...')
    const seed = prompt ? `${system}\n\n${prompt}` : system
    const result = await x('agent', ['--print', '--force', '--output-format', 'json', seed], {
      throwOnError: true,
    })
    const output = result.stdout.toString().trim()
    const sessionId = parseAgentSessionId(output)

    logger.debug(`cursor.fresh: session completed — sessionId: ${sessionId}`)
    return sessionId
  },

  launch: async (system: string, prompt: string, options?: LaunchOptions) => {
    const sessionId = randomUUID()
    const taskId = options?.taskId ?? 'unknown'

    ensureCursorSettings(process.cwd())

    if (options?.logFile) {
      writeLogHeader(options.logFile, 'cursor', sessionId, taskId, options.promptFile)
    }

    const userPrompt = options?.promptFile
      ? buildReferenceMessage(options.promptFile, options.taskId)
      : `${system}\n\n${prompt}`

    logger.debug(`[cursor.launch] taskId=${taskId} sessionId=${sessionId}`)
    spawnBackground(
      'agent',
      ['--print', '--force', '--output-format', 'text', userPrompt],
      options?.logFile,
    )

    return sessionId
  },

  start: async (session: string) =>
    x('agent', ['--resume', session], { nodeOptions: { stdio: 'inherit' } }),
  reply: async (session: string, message: string) =>
    x('agent', ['--resume', session, '--print', '--force', message], {
      nodeOptions: { stdio: 'inherit' },
    }),
  clear: async (session: string) =>
    x('agent', ['--delete', session], { nodeOptions: { stdio: 'inherit' } }),
}

/** Parse the session_id from agent CLI JSON output. */
function parseAgentSessionId(output: string): string {
  try {
    const json = JSON.parse(output)
    if (json.session_id)
      return json.session_id
  }
  catch {}

  for (const line of output.split('\n')) {
    try {
      const json = JSON.parse(line.trim())
      if (json.session_id)
        return json.session_id
    }
    catch {}
  }

  return randomUUID()
}
