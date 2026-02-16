import type { Agent } from '../config/define'
import type { Task, TaskResult } from '../task/types'
import type { TaskAgent } from './types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'pathe'
import { logger } from '../utils/logger'
import { buildSystemPrompt, buildTaskPrompt } from './prompt-builder'

export interface ExecuteOptions {
  timeout?: number
  /** Platform adapter (cursor/claude) for launching a real AI session. */
  platform?: Agent
  /** Base path for log files (defaults to '.agentic'). */
  basePath?: string
  /** Override the default system prompt (e.g. for scorer agents). */
  systemPrompt?: string
  /** Override the default task prompt (e.g. for scorer agents). */
  taskPrompt?: string
}

/**
 * Execute a task by building system/task prompts and launching a real AI session.
 *
 * The full prompt (system + task) is written to a file at
 * `{basePath}/prompts/{taskId}.md` for reliable delivery — passing long
 * multi-line strings as CLI arguments is unreliable on Windows.
 *
 * The platform adapter receives the prompt file path via `LaunchOptions.promptFile`
 * and sends a short reference message to the Cloud Agent instead of the full text.
 *
 * Returns a TaskResult with `metadata.delegated: true` and `metadata.sessionId`.
 * The Orchestrator keeps the task in "running" state until the external agent
 * reports completion via the `complete` command.
 */
export async function executeTask(agent: TaskAgent, task: Task, options?: ExecuteOptions): Promise<TaskResult> {
  const startTime = Date.now()
  const system = options?.systemPrompt ?? buildSystemPrompt(agent, task.id)
  const prompt = options?.taskPrompt ?? buildTaskPrompt(task)

  let sessionId: string | undefined

  if (options?.platform) {
    const basePath = options.basePath ?? '.agentic'
    const logFile = join(basePath, 'logs', `${task.id}.log`)

    // Write full prompt to a file for reliable delivery (avoids CLI arg truncation)
    const promptFile = join(basePath, 'prompts', `${task.id}.md`)
    mkdirSync(dirname(promptFile), { recursive: true })
    writeFileSync(promptFile, `${system}\n\n${prompt}`, 'utf-8')

    logger.info(`executeTask: launching platform session for task ${task.id} (agent: ${agent.id}, logFile: ${logFile}, promptFile: ${promptFile})`)
    try {
      sessionId = await options.platform.launch(system, prompt, {
        logFile,
        promptFile,
        taskId: task.id,
      })
      logger.info(`executeTask: platform session launched — sessionId: ${sessionId}`)
    }
    catch (err) {
      logger.error(`executeTask: platform.launch() failed for task ${task.id}: ${err}`)
      throw err
    }
  }
  else {
    logger.debug(`executeTask: no platform adapter, skipping session launch (task: ${task.id})`)
  }

  return {
    taskId: task.id,
    success: true,
    output: { delegated: true, prompt, sessionId },
    duration: Date.now() - startTime,
    metadata: { agentId: agent.id, delegated: true, sessionId, system, prompt },
  }
}
