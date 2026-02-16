import process from 'node:process'
import { defineCommand } from 'citty'
import { logger } from '../../utils/logger'
import { validateTaskInput } from '../../utils/validator'
import { createCliContext } from '../helpers'
import { outputJson } from '../utils'

export const specifyCommand = defineCommand({
  meta: {
    name: 'specify',
    description: 'Register a task, assign an agent, and delegate to external agent',
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

    // Submit task: triggers classify → assign → executeTask (builds prompt, marks delegated)
    const taskId = await orchestrator.submitTask(description, { agentId })

    // Wait for processTask to finish delegation (or fail) before reading status
    await orchestrator.waitForProcessing(taskId)

    // Read back task with prompt and sessionId stored in metadata by executeTask
    const task = await orchestrator.taskManager.getTask(taskId)
    const prompt = (task?.metadata?.prompt as string) ?? ''
    const sessionId = (task?.metadata?.sessionId as string) ?? undefined

    outputJson({
      success: true,
      data: {
        taskId,
        agentId,
        description,
        status: task?.status ?? 'unknown',
        ...(sessionId && { sessionId }),
        prompt,
      },
    })

    // Exit immediately — background child process (agent CLI) may keep the event loop alive
    process.exit(0)
  },
})
