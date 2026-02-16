import process from 'node:process'
import { defineCommand } from 'citty'
import { logger } from '../../utils/logger'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const respondCommand = defineCommand({
  meta: {
    name: 'respond',
    description: 'Respond to a waiting_user query on a task',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID with a pending query',
      required: true,
    },
    answer: {
      type: 'positional',
      description: 'Answer text to submit',
      required: true,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string
    const answer = args.answer as string

    const { queryManager } = await createCliContext()

    const query = await queryManager.getQueryByTask(taskId)
    if (!query) {
      logger.error(`No pending query found for task: ${taskId}`)
      process.exit(1)
    }

    // Use the first option as the selected option, with the answer as response text.
    // If options exist, pick the first one; the answer text carries the actual content.
    const selectedOption = query.options[0]?.id ?? 'default'
    const updated = await queryManager.submitResponse(query.id, selectedOption, answer)

    outputJson({
      success: true,
      data: {
        taskId,
        queryId: updated.id,
        question: updated.question,
        answer,
        status: 'resumed',
      },
    })
  },
})
