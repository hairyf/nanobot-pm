import type { Agent, LaunchOptions } from '../config/define'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { dirname, join } from 'pathe'
import { x } from 'tinyexec'
import { logger } from '../utils/logger'

/**
 * Ensure `.claude/settings.json` exists with `bypassPermissions` so Claude Code
 * can execute all tools (Bash, Read, Write, etc.) without interactive approval.
 *
 * Inspired by auto-company's approach: project-level permission config instead
 * of the `--dangerously-skip-permissions` CLI flag.
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
 * Build a short, single-line reference message for the Cloud Agent.
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
 * Spawn a detached background process with stdout/stderr redirected to a log file.
 * Uses tinyexec's `x()` which correctly resolves `.ps1` / `.cmd` scripts on Windows,
 * then detaches the child process so the parent CLI can exit immediately.
 */
function launchDetached(cmd: string, args: string[], logFile?: string): void {
  let stdout: 'ignore' | number = 'ignore'
  let stderr: 'ignore' | number = 'ignore'

  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true })
    const fd = openSync(logFile, 'a')
    stdout = fd
    stderr = fd
  }

  const result = x(cmd, args, {
    nodeOptions: {
      detached: true,
      stdio: ['ignore', stdout, stderr],
    },
  })

  const child = result.process
  if (child) {
    child.on('error', (err) => {
      logger.error(`launchDetached: failed to spawn "${cmd}": ${err.message}`)
    })
    child.unref()
  }
  else {
    logger.error(`launchDetached: no child process returned for "${cmd}"`)
  }
}

/**
 * Launch a command in a **new visible terminal window**.
 *
 * On Windows: writes a `.cmd` script and opens it via `start` — creates exactly
 * one new console window where the user can watch the agent work in real-time.
 * The parent process returns immediately (non-blocking).
 *
 * On other platforms: falls back to `launchDetached`.
 */
function launchInTerminal(
  cmd: string,
  args: string[],
  options?: { title?: string, logFile?: string },
): void {
  if (process.platform === 'win32') {
    const scriptDir = options?.logFile ? dirname(options.logFile) : '.'
    const scriptPath = join(scriptDir, '_agent_run.cmd')
    mkdirSync(dirname(scriptPath), { recursive: true })

    const title = options?.title ?? 'Agent Task'
    // Build the command line; quote args that contain spaces or are plain values
    const cmdLine = [cmd, ...args.map(a => a.startsWith('-') ? a : `"${a}"`)].join(' ')
    const script = [
      '@echo off',
      `title ${title}`,
      cmdLine,
      'exit',
    ].join('\r\n')

    writeFileSync(scriptPath, script, 'utf-8')

    // Use shell: true so `start` is interpreted as a cmd built-in.
    // Empty quotes "" are required as the window title for `start`.
    const absScript = join(process.cwd(), scriptPath)
    const child = spawn(`start "" "${absScript}"`, [], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    })
    child.unref()
  }
  else {
    launchDetached(cmd, args, options?.logFile)
  }
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

    // Ensure .claude/settings.json grants bypassPermissions so the agent
    // can freely run Bash, Read, Write etc. without interactive approval.
    ensureClaudeSettings(process.cwd())

    if (options?.logFile) {
      mkdirSync(dirname(options.logFile), { recursive: true })
      writeFileSync(options.logFile, [
        `[claude.launch] sessionId: ${sessionId}`,
        `[claude.launch] time: ${new Date().toISOString()}`,
        `[claude.launch] taskId: ${taskId}`,
        options.promptFile ? `[claude.launch] promptFile: ${options.promptFile}` : '',
        '',
      ].filter(Boolean).join('\n'))
    }

    // Launch in a new visible terminal window so the user can watch in real-time.
    // Uses the prompt file to avoid long CLI arguments; drops --append-system-prompt
    // because the prompt file already contains the full system + task prompt.
    const userPrompt = options?.promptFile
      ? `Read and execute the task in ${options.promptFile}`
      : prompt

    launchInTerminal(
      'claude',
      ['--session-id', sessionId, '-p', userPrompt],
      {
        title: `Agent: ${taskId.slice(0, 8)}`,
        logFile: options?.logFile,
      },
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

    // Ensure .cursor/cli.json grants Shell/Read/Write permissions.
    // Combined with --force, the agent can execute all allowed tools.
    ensureCursorSettings(process.cwd())

    if (options?.logFile) {
      mkdirSync(dirname(options.logFile), { recursive: true })
      writeFileSync(options.logFile, [
        `[cursor.launch] sessionId: ${sessionId}`,
        `[cursor.launch] time: ${new Date().toISOString()}`,
        `[cursor.launch] taskId: ${taskId}`,
        options.promptFile ? `[cursor.launch] promptFile: ${options.promptFile}` : '',
        '',
      ].filter(Boolean).join('\n'))
    }

    // Use prompt file to avoid long CLI arguments (Windows truncation).
    const userPrompt = options?.promptFile
      ? buildReferenceMessage(options.promptFile, options.taskId)
      : `${system}\n\n${prompt}`

    // Launch in a new visible terminal window with --force for full tool access.
    launchInTerminal(
      'agent',
      ['--print', '--force', '--output-format', 'text', userPrompt],
      {
        title: `Agent: ${taskId.slice(0, 8)}`,
        logFile: options?.logFile,
      },
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

  // Fallback: try to find JSON in multi-line output
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
