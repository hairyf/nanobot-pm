import process from 'node:process'
import { defineCommand } from 'citty'
import { buildAgentPrompt } from '../../executor/prompt-builder'
import { logger } from '../../utils/logger'
import { validateTaskInput } from '../../utils/validator'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const specifyCommand = defineCommand({
  meta: {
    name: 'specify',
    description: 'Register a task, assign an agent, and start internal processing',
  },
  args: {
    agentId: {
      type: 'positional',
      description: 'Agent ID to assign',
      required: true,
    },
    description: {
      type: 'positional',
      description: 'Task description',
      required: true,
    },
  },
  async run({ args }) {
    const agentId = args.agentId as string
    const description = args.description as string

    const validation = validateTaskInput(description)
    if (!validation.valid) {
      logger.error(validation.error)
      process.exit(1)
    }

    const { orchestrator, agents } = await createCliContext()

    // Validate agent exists
    const agent = agents.find(a => a.id === agentId)
    if (!agent) {
      logger.error(`Agent not found: ${agentId}`)
      logger.info(`Available agents: ${agents.map(a => a.id).join(', ')}`)
      process.exit(1)
    }

    // Use Orchestrator's internal submitTask with pre-assigned agent
    // This triggers: scheduler → assign → executeTask (agent function)
    const taskId = await orchestrator.submitTask(description, { agentId })

    // Build prompt for sub-agent reference
    const task = await orchestrator.taskManager.getTask(taskId)
    const prompt = buildAgentPrompt(agent, task!)

    // Store prompt in task metadata
    await orchestrator.taskManager.updateMetadata(taskId, {
      agentPrompt: prompt,
    })

    outputJson({
      success: true,
      data: {
        taskId,
        agentId,
        description,
        type: task?.type ?? 'local',
        status: task?.status ?? 'completed',
        prompt,
      },
    })
  },
})
