import type { Storage } from 'unstorage'
import type { TaskAgent } from '../agents/types'
import type { AppConfig } from '../config/schema'
import { loadAgents } from '../agents/loader'
import { resolveConfig } from '../config'
import { Orchestrator } from '../orchestrator'
import { createStorageInstance } from '../storage'
import { HistoryStore } from '../storage/history-store'
import { TaskStore } from '../storage/task-store'
import { TaskManager } from '../task/manager'

export interface CliContext {
  config: AppConfig
  storage: Storage
  taskStore: TaskStore
  historyStore: HistoryStore
  taskManager: TaskManager
  agents: TaskAgent[]
  orchestrator: Orchestrator
}

export async function createCliContext(): Promise<CliContext> {
  const config = await resolveConfig()
  const storage = createStorageInstance(config.storage.basePath)
  const taskStore = new TaskStore(storage)
  const historyStore = new HistoryStore(storage)
  const taskManager = new TaskManager(taskStore, historyStore)
  const agents = await loadAgents(config.agents.directories)
  const orchestrator = new Orchestrator({ config, storage })

  // Register loaded agents in the Orchestrator's registry
  for (const agent of agents) {
    orchestrator.registry.register(agent)
  }

  return { config, storage, taskStore, historyStore, taskManager, agents, orchestrator }
}
