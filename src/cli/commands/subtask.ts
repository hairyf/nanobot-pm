import process from 'node:process'
import { defineCommand } from 'citty'
import { logger } from '../../utils/logger'
import { validateTaskInput } from '../../utils/validator'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const subtaskCommand = defineCommand({
  meta: {
    name: 'subtask',
    description: 'Create a child task under an existing running task',
  },
  args: {
    parentTaskId: {
      type: 'positional',
      description: 'Parent task ID',
      required: true,
    },
    agentId: {
      type: 'positional',
      description: 'Agent ID to assign the subtask to',
      required: true,
    },
    description: {
      type: 'positional',
      description: 'Subtask description',
      required: true,
    },
  },
  async run({ args }) {
    const parentTaskId = args.parentTaskId as string
    const agentId = args.agentId as string
    const description = args.description as string

    const validation = validateTaskInput(description)
    if (!validation.valid) {
      logger.error(validation.error)
      process.exit(1)
    }

    const { orchestrator, taskManager, agents } = await createCliContext()

    const parentTask = await taskManager.getTask(parentTaskId)
    if (!parentTask) {
      logger.error(`Parent task not found: ${parentTaskId}`)
      process.exit(1)
    }

    if (parentTask.status !== 'running') {
      logger.error(`Parent task is not in running status (current: ${parentTask.status})`)
      process.exit(1)
    }

    // Validate agent exists
    const agent = agents.find(a => a.id === agentId)
    if (!agent) {
      logger.error(`Agent not found: ${agentId}`)
      logger.info(`Available agents: ${agents.map(a => a.id).join(', ')}`)
      process.exit(1)
    }

    // Submit the subtask through the orchestrator
    const childTaskId = await orchestrator.submitTask(description, {
      parentTaskId,
      depth: parentTask.depth + 1,
      agentId,
    })

    const childTask = await taskManager.getTask(childTaskId)

    outputJson({
      success: true,
      data: {
        parentTaskId,
        childTaskId,
        agentId,
        description,
        status: childTask?.status ?? 'pending',
        message: 'Subtask created and queued',
      },
    })
  },
})
