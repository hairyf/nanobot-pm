import process from 'node:process'
import { defineCommand } from 'citty'
import { executeTask } from '../../agents/executor'
import { buildRetryTaskPrompt } from '../../agents/prompt-builder'
import { buildAgentScore } from '../../scorer/evaluator'
import { logger } from '../../utils/logger'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const scoreCommand = defineCommand({
  meta: {
    name: 'score',
    description: 'Submit evaluation result for a task in waiting_eval status (called by scorer agent)',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID to score',
      required: true,
    },
    result: {
      type: 'string',
      description: 'Evaluation result: pass or reject',
      required: true,
    },
    feedback: {
      type: 'string',
      description: 'Feedback explaining the evaluation',
      required: false,
    },
    suggestions: {
      type: 'string',
      description: 'Improvement suggestions (for reject)',
      required: false,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string
    const scoreResult = args.result as string
    const feedback = (args.feedback as string | undefined) || ''
    const suggestions = (args.suggestions as string | undefined) || ''

    if (scoreResult !== 'pass' && scoreResult !== 'reject') {
      logger.error(`Invalid result: "${scoreResult}". Must be "pass" or "reject"`)
      process.exit(1)
    }

    const { config, taskManager, historyStore, agents, orchestrator } = await createCliContext()

    const task = await taskManager.getTask(taskId)
    if (!task) {
      logger.error(`Task not found: ${taskId}`)
      process.exit(1)
    }

    if (task.status !== 'waiting_eval') {
      logger.error(`Task is not in waiting_eval status (current: ${task.status})`)
      process.exit(1)
    }

    // Record the score
    const score = buildAgentScore({
      taskId,
      result: scoreResult as 'pass' | 'reject',
      feedback,
      suggestions: suggestions ? [suggestions] : [],
      scorerId: config.scorer.agentId || 'ai-scorer',
    })
    await historyStore.appendScore(taskId, score)
    await historyStore.appendEvent(taskId, { type: 'scored', timestamp: Date.now(), scoreId: score.id })

    if (scoreResult === 'pass') {
      // --- PASS: complete the task ---
      const duration = Date.now() - (task.startedAt || task.createdAt)
      await taskManager.transitionStatus(taskId, 'completed')
      await historyStore.appendEvent(taskId, {
        type: 'completed',
        timestamp: Date.now(),
        result: {
          taskId,
          success: true,
          output: { message: task.metadata?.completionOutput || 'Task completed' },
          duration,
          metadata: { agentId: task.assignedAgent || 'unknown', scoreFeedback: feedback },
        },
      })

      outputJson({
        success: true,
        data: {
          taskId,
          status: 'completed',
          score: { result: 'pass', feedback },
          message: 'Task evaluation passed, marked as completed',
        },
      })
    }
    else {
      // --- REJECT: retry or fail ---
      if (task.retryCount < task.maxRetries) {
        await taskManager.incrementRetry(taskId)
        await taskManager.transitionStatus(taskId, 'running')

        // Store feedback in metadata for reference
        await taskManager.updateMetadata(taskId, {
          lastScorerFeedback: feedback,
          lastScorerSuggestions: suggestions,
        })

        // Re-spawn the original agent with feedback
        const originalAgentId = task.assignedAgent
        const originalAgent = agents.find(a => a.id === originalAgentId)

        if (originalAgent) {
          const platform = orchestrator.platform
          const basePath = config.storage.basePath

          // Build retry prompt with scorer feedback
          const retryPrompt = buildRetryTaskPrompt(task, feedback, suggestions)

          try {
            const result = await executeTask(originalAgent, task, {
              platform,
              basePath,
              taskPrompt: retryPrompt,
            })

            const newSessionId = result.metadata?.sessionId as string | undefined
            await taskManager.updateMetadata(taskId, { sessionId: newSessionId })

            outputJson({
              success: true,
              data: {
                taskId,
                status: 'running',
                score: { result: 'reject', feedback },
                retryCount: task.retryCount + 1,
                maxRetries: task.maxRetries,
                newSessionId,
                message: 'Evaluation rejected, agent re-spawned with feedback for retry',
              },
            })
          }
          catch (err) {
            logger.error(`Failed to re-spawn agent: ${err}`)
            await taskManager.transitionStatus(taskId, 'failed')
            await historyStore.appendEvent(taskId, {
              type: 'failed',
              timestamp: Date.now(),
              error: { code: 'RESPAWN_FAILED', message: `Failed to re-spawn agent after score rejection: ${err}`, recoverable: false },
            })
            outputJson({
              success: false,
              data: { taskId, status: 'failed', message: 'Agent re-spawn failed after score rejection' },
            })
          }
        }
        else {
          logger.error(`Original agent not found: ${originalAgentId}`)
          await taskManager.transitionStatus(taskId, 'failed')
          await historyStore.appendEvent(taskId, {
            type: 'failed',
            timestamp: Date.now(),
            error: { code: 'AGENT_NOT_FOUND', message: `Cannot retry: agent ${originalAgentId} not found`, recoverable: false },
          })
          outputJson({
            success: false,
            data: { taskId, status: 'failed', message: `Cannot retry: agent ${originalAgentId} not found` },
          })
        }
      }
      else {
        // Max retries exceeded
        await taskManager.transitionStatus(taskId, 'failed')
        await historyStore.appendEvent(taskId, {
          type: 'failed',
          timestamp: Date.now(),
          error: { code: 'SCORE_REJECTED', message: `Evaluation rejected after max retries: ${feedback}`, recoverable: false },
        })

        outputJson({
          success: false,
          data: {
            taskId,
            status: 'failed',
            score: { result: 'reject', feedback },
            message: 'Task failed: max retries exceeded with evaluation rejection',
          },
        })
      }
    }

    process.exit(0)
  },
})
