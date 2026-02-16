import process from 'node:process'
import { defineCommand } from 'citty'
import { logger } from '../../utils/logger'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

/**
 * CLI command for agents to ask the user a question.
 * Transitions the task to waiting_user and records the query.
 */
export const askCommand = defineCommand({
  meta: {
    name: 'ask',
    description: 'Ask the user a question (transitions task to waiting_user)',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID to transition',
      required: true,
    },
    question: {
      type: 'string',
      description: 'Question to ask the user',
      required: true,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string
    const question = args.question as string

    const { taskManager, queryManager } = await createCliContext()

    const task = await taskManager.getTask(taskId)
    if (!task) {
      logger.error(`Task not found: ${taskId}`)
      process.exit(1)
    }

    if (task.status !== 'running') {
      logger.error(`Task is not in running status (current: ${task.status})`)
      process.exit(1)
    }

    const query = await queryManager.createQuery({
      taskId,
      question,
    })

    outputJson({
      success: true,
      data: {
        taskId,
        queryId: query.id,
        status: 'waiting_user',
        question,
        message: 'Task is now waiting for user input',
      },
    })
  },
})
