import process from 'node:process'
import { defineCommand } from 'citty'
import { join } from 'pathe'
import { executeTask } from '../../agents/executor'
import { buildScorerSystemPrompt, buildScorerTaskPrompt } from '../../agents/prompt-builder'
import { logger } from '../../utils/logger'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const completeCommand = defineCommand({
  meta: {
    name: 'complete',
    description: 'Mark a running task as completed with auto-scoring',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID to complete',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Description of what was accomplished',
      required: false,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string
    const outputDesc = (args.output as string | undefined) || 'Task completed'

    const { config, taskManager, historyStore, agents, orchestrator } = await createCliContext()

    const task = await taskManager.getTask(taskId)
    if (!task) {
      logger.error(`Task not found: ${taskId}`)
      process.exit(1)
    }

    if (task.status !== 'running') {
      logger.error(`Task is not in running status (current: ${task.status})`)
      process.exit(1)
    }

    const scorerAgentId = config.scorer.agentId

    // --- AI Scorer path: spawn a scorer agent to evaluate ---
    if (scorerAgentId) {
      // Store completion output in task metadata for the scorer to read
      await taskManager.updateMetadata(taskId, { completionOutput: outputDesc })

      // Transition to waiting_eval
      await taskManager.transitionStatus(taskId, 'waiting_eval')
      await historyStore.appendEvent(taskId, {
        type: 'evaluating',
        timestamp: Date.now(),
        scorerAgentId,
      })

      // Load the scorer agent definition
      const scorerAgent = agents.find(a => a.id === scorerAgentId)
      if (!scorerAgent) {
        logger.error(`Scorer agent not found: ${scorerAgentId}. Available agents: ${agents.map(a => a.id).join(', ')}`)
        // Fallback: transition directly to completed (graceful degradation)
        await taskManager.transitionStatus(taskId, 'completed')
        await historyStore.appendEvent(taskId, {
          type: 'completed',
          timestamp: Date.now(),
          result: { taskId, success: true, output: { message: outputDesc }, duration: 0, metadata: {} },
        })
        outputJson({
          success: true,
          data: { taskId, status: 'completed', message: 'Scorer agent not found, task auto-completed' },
        })
        process.exit(0)
      }

      // Build scorer prompt
      const basePath = config.storage.basePath
      const logFile = join(basePath, 'logs', `${taskId}.log`)
      const promptFile = join(basePath, 'prompts', `${taskId}.md`)

      const scorerSystem = buildScorerSystemPrompt(scorerAgent, taskId)
      const scorerTask = buildScorerTaskPrompt(task, outputDesc, logFile, promptFile)

      // Resolve platform adapter
      const platform = orchestrator.platform

      // Launch scorer agent session
      try {
        const result = await executeTask(scorerAgent, task, {
          platform,
          basePath,
          systemPrompt: scorerSystem,
          taskPrompt: scorerTask,
        })

        const scorerSessionId = result.metadata?.sessionId as string | undefined
        await taskManager.updateMetadata(taskId, { scorerSessionId, scorerSystem, scorerTask })

        outputJson({
          success: true,
          data: {
            taskId,
            status: 'waiting_eval',
            scorerAgentId,
            scorerSessionId,
            message: 'Task submitted for AI evaluation',
          },
        })
      }
      catch (err) {
        logger.error(`Failed to launch scorer agent: ${err}`)
        // Fallback: auto-complete on scorer launch failure
        await taskManager.transitionStatus(taskId, 'completed')
        await historyStore.appendEvent(taskId, {
          type: 'completed',
          timestamp: Date.now(),
          result: { taskId, success: true, output: { message: outputDesc }, duration: 0, metadata: {} },
        })
        outputJson({
          success: true,
          data: { taskId, status: 'completed', message: 'Scorer launch failed, task auto-completed' },
        })
      }

      process.exit(0)
    }

    // --- No scorer configured: complete directly ---
    const duration = Date.now() - (task.startedAt || task.createdAt)

    await taskManager.transitionStatus(taskId, 'completed')
    await historyStore.appendEvent(taskId, {
      type: 'completed',
      timestamp: Date.now(),
      result: {
        taskId: task.id,
        success: true,
        output: { message: outputDesc },
        duration,
        metadata: { agentId: task.assignedAgent || 'unknown' },
      },
    })

    outputJson({
      success: true,
      data: {
        taskId,
        status: 'completed',
        duration,
        message: 'Task completed (no scorer configured)',
      },
    })

    process.exit(0)
  },
})
