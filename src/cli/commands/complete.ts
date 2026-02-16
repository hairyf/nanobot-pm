import process from 'node:process'
import { defineCommand } from 'citty'
import { evaluate } from '../../scorer/evaluator'
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

    const { config, taskManager, historyStore } = await createCliContext()

    const task = await taskManager.getTask(taskId)
    if (!task) {
      logger.error(`Task not found: ${taskId}`)
      process.exit(1)
    }

    if (task.status !== 'running') {
      logger.error(`Task is not in running status (current: ${task.status})`)
      process.exit(1)
    }

    const duration = Date.now() - (task.startedAt || task.createdAt)

    const result = {
      taskId: task.id,
      success: true,
      output: { message: outputDesc },
      duration,
      metadata: { agentId: task.assignedAgent || 'unknown' },
    }

    const scorerConfig = {
      scoreThreshold: config.scorer.scoreThreshold,
      rules: [],
    }
    const score = evaluate(task, result, scorerConfig)
    await historyStore.appendScore(taskId, score)

    if (score.result === 'pass') {
      await taskManager.transitionStatus(taskId, 'completed')
      await historyStore.appendEvent(taskId, { type: 'completed', timestamp: Date.now(), result })

      outputJson({
        success: true,
        data: {
          taskId,
          status: 'completed',
          score: { result: score.result, confidence: score.confidence },
          duration,
          message: 'Task completed and scored as pass',
        },
      })
    }
    else {
      if (task.retryCount < task.maxRetries) {
        await taskManager.incrementRetry(taskId)
        await taskManager.transitionStatus(taskId, 'pending')

        outputJson({
          success: false,
          data: {
            taskId,
            status: 'pending',
            score: { result: score.result, confidence: score.confidence },
            feedback: score.feedback,
            suggestions: score.suggestions,
            retriesRemaining: task.maxRetries - task.retryCount - 1,
            message: 'Score below threshold, task returned to pending for retry',
          },
        })
      }
      else {
        await taskManager.transitionStatus(taskId, 'failed')
        await historyStore.appendEvent(taskId, {
          type: 'failed',
          timestamp: Date.now(),
          error: { code: 'SCORE_REJECTED', message: `Score ${score.confidence} below threshold after max retries`, recoverable: false },
        })

        outputJson({
          success: false,
          data: {
            taskId,
            status: 'failed',
            score: { result: score.result, confidence: score.confidence },
            message: 'Task failed: max retries exceeded with score below threshold',
          },
        })
      }
    }
  },
})
