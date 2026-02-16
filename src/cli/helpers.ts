import type { Storage } from 'unstorage'
import type { TaskAgent } from '../agents/types'
import type { Agent } from '../config/define'
import type { AppConfig } from '../config/schema'
import { claude, cursor } from '../agents'
import { loadAgents } from '../agents/loader'
import { resolveConfig } from '../config'
import { Orchestrator } from '../orchestrator'
import { createStorageInstance } from '../storage'
import { HistoryStore } from '../storage/history'
import { TaskStore } from '../storage/task'
import { AskManager } from '../task/ask'
import { TaskManager } from '../task/manager'
import { logger } from '../utils/logger'

const platformAdapters: Record<string, Agent> = { cursor, claude }

export interface CliContext {
  config: AppConfig
  storage: Storage
  taskStore: TaskStore
  historyStore: HistoryStore
  taskManager: TaskManager
  queryManager: AskManager
  agents: TaskAgent[]
  orchestrator: Orchestrator
}

export async function createCliContext(): Promise<CliContext> {
  const config = await resolveConfig()
  const storage = createStorageInstance(config.storage.basePath)
  const taskStore = new TaskStore(storage)
  const historyStore = new HistoryStore(storage)
  const taskManager = new TaskManager(taskStore, historyStore)
  const queryManager = new AskManager(storage)
  const agents = await loadAgents(config.agents.directories)

  // Resolve platform adapter from config
  const platform = config.platform ? platformAdapters[config.platform] : undefined
  if (!platform) {
    logger.warn('No platform adapter configured — tasks will be marked as delegated but no external agent session will be launched')
  }
  else {
    logger.debug(`Platform adapter resolved: ${config.platform}`)
  }
  const orchestrator = new Orchestrator({ config, storage, platform })

  // Register loaded agents in the Orchestrator's registry
  for (const agent of agents) {
    orchestrator.registry.register(agent)
  }

  return { config, storage, taskStore, historyStore, taskManager, queryManager, agents, orchestrator }
}
