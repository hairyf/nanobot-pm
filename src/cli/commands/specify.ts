import process from 'node:process'
import { defineCommand } from 'citty'
import { loadAgents } from '../../agents/loader'
import { resolveConfig } from '../../config'
import { Orchestrator } from '../../orchestrator'
import { createStorageInstance } from '../../storage'
import { logger } from '../../utils/logger'
import { generateUUID, validateTaskInput } from '../../utils/validator'

export const specifyCommand = defineCommand({
  meta: {
    name: 'specify',
    description: 'Create and execute a task',
  },
  args: {
    description: {
      type: 'positional',
      description: 'Task description',
      required: true,
    },
  },
  async run({ args }) {
    const description = args.description as string
    const validation = validateTaskInput(description)
    if (!validation.valid) {
      logger.error(validation.error)
      process.exit(1)
    }

    const config = await resolveConfig()
    const storage = createStorageInstance(config.storage.basePath)
    const orchestrator = new Orchestrator({ config, storage })

    const agents = await loadAgents(config.agents.directories)
    for (const agent of agents) {
      orchestrator.registry.register(agent)
    }

    if (orchestrator.registry.listAll().length === 0) {
      logger.warn('No agents found. Please create agent definitions in your agents directory.')
      logger.info('Example: .cursor/agents/developer.json')
      return
    }

    const sessionId = generateUUID()
    const reporter = orchestrator.createReporter()

    const taskId = await orchestrator.submitTask(description)
    logger.info(`Task created: ${taskId}`)

    reporter.bind(sessionId, taskId)

    reporter.onProgress = async () => {
      const task = await orchestrator.taskManager.getTask(taskId)
      if (task) {
        logger.info(`[${new Date().toLocaleTimeString()}] ${task.status} | ${task.description}`)
      }
    }

    logger.info('Task submitted. Processing...')
  },
})
