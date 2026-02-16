import type { Storage } from 'unstorage'
import type { Agent } from '../config/define'
import type { AppConfig } from '../config/schema'
import type { OrchestratorHooks } from './types'
import { createHooks } from 'hookable'
import { executeTask } from '../agents/executor'
import { AgentRegistry } from '../agents/registry'
import { HistoryStore } from '../storage/history'
import { TaskStore } from '../storage/task'
import { AskManager } from '../task/ask'
import { TaskManager } from '../task/manager'
import { TaskQueue } from '../task/queue'
import { logger, taskAssigned, taskCompleted, taskFailed } from '../utils/logger'

export interface OrchestratorOptions {
  config: AppConfig
  storage: Storage
  /** Platform adapter (cursor/claude) for launching real AI sessions. Optional for tests. */
  platform?: Agent
}

export class Orchestrator {
  public hooks = createHooks<OrchestratorHooks>()
  public taskManager: TaskManager
  public taskQueue: TaskQueue
  public registry: AgentRegistry
  public historyStore: HistoryStore
  public queryManager: AskManager

  private taskStore: TaskStore
  private config: AppConfig
  /** Platform adapter (cursor/claude) — exposed for CLI commands that need to spawn agents. */
  public platform?: Agent
  /** Tracks in-flight processTask promises so callers can await completion. */
  private processingPromises = new Map<string, Promise<void>>()

  constructor(options: OrchestratorOptions) {
    this.config = options.config
    this.platform = options.platform
    this.taskStore = new TaskStore(options.storage)
    this.historyStore = new HistoryStore(options.storage)
    this.taskManager = new TaskManager(this.taskStore, this.historyStore)
    this.taskQueue = new TaskQueue(options.config.orchestrator.maxConcurrentTasks)
    this.registry = new AgentRegistry()
    this.queryManager = new AskManager(options.storage)
  }

  async submitTask(description: string, options?: { parentTaskId?: string, depth?: number, agentId?: string }): Promise<string> {
    const task = await this.taskManager.createTask({
      description,
      parentTaskId: options?.parentTaskId,
      depth: options?.depth,
      timeout: this.config.orchestrator.defaultTimeout,
      maxRetries: this.config.orchestrator.maxRetries,
    })

    // Pre-assign agent if specified
    if (options?.agentId) {
      const agent = this.registry.getById(options.agentId)
      if (!agent) {
        throw new Error(`Agent not found: ${options.agentId}`)
      }
      await this.taskManager.assignTask(task.id, options.agentId)
    }

    await this.hooks.callHook('task:created', task)
    this.taskQueue.enqueue(task)

    this.processQueue()
    return task.id
  }

  private processQueue(): void {
    const task = this.taskQueue.dequeue()
    if (!task)
      return

    this.taskQueue.markRunning(task.id)

    const promise = this.processTask(task.id)
      .catch(err => logger.error('Task processing error', err))
      .finally(() => {
        this.processingPromises.delete(task.id)
        this.taskQueue.markDone(task.id)
        this.processQueue()
      })

    this.processingPromises.set(task.id, promise)
  }

  /**
   * Wait for a task's processing to complete (delegation, scoring, or failure).
   * Resolves immediately if the task is not currently being processed.
   */
  async waitForProcessing(taskId: string): Promise<void> {
    const promise = this.processingPromises.get(taskId)
    if (promise) {
      await promise
    }
  }

  async processTask(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId)
    if (!task)
      return

    // Use pre-assigned agent or assign via registry
    let agent = task.assignedAgent ? this.registry.getById(task.assignedAgent) : undefined
    if (!agent) {
      const keywords = task.description.toLowerCase().split(/\s+/)
      const foundAgent = this.registry.selectBest(keywords)
      if (foundAgent) {
        this.registry.updateStatus(foundAgent.id, 'busy', task.id)
        taskAssigned(task.id, foundAgent.id)
      }
      agent = foundAgent
    }
    if (!agent) {
      logger.warn(`No available agent for task ${taskId}`)
      return
    }

    const updatedTask = { ...task, assignedAgent: agent.id, updatedAt: Date.now() }
    await this.taskStore.save(updatedTask)
    await this.historyStore.appendEvent(taskId, { type: 'assigned', timestamp: Date.now(), agentId: agent.id })
    await this.hooks.callHook('task:assigned', updatedTask)

    await this.taskManager.transitionStatus(taskId, 'running')
    await this.historyStore.appendEvent(taskId, { type: 'started', timestamp: Date.now() })
    const runningTask = await this.taskManager.getTask(taskId)
    if (runningTask)
      await this.hooks.callHook('task:started', runningTask)

    try {
      const result = await executeTask(agent, updatedTask, {
        timeout: this.config.orchestrator.defaultTimeout,
        platform: this.platform,
        basePath: this.config.storage.basePath,
      })

      // Store execution result (prompt, delegation info) in task metadata
      const resultMeta: Record<string, unknown> = { ...result.metadata }
      const output = result.output as Record<string, unknown> | undefined
      if (output?.prompt) {
        resultMeta.prompt = output.prompt
      }
      await this.taskManager.updateMetadata(taskId, resultMeta)

      // If task was delegated to an external agent, keep it in "running" state.
      // The external agent will report completion via the `complete` command.
      if (result.metadata?.delegated) {
        return
      }

      // Scoring is handled by AI Agent externally (via `agentic complete` → `agentic score`).
      // If scorer.agentId is configured, the `complete` command transitions to waiting_eval.
      // Here we handle the in-process case (no external delegation, no scorer):
      if (result.success) {
        await this.taskManager.transitionStatus(taskId, 'completed')
        const completedTask = await this.taskManager.getTask(taskId)
        if (completedTask) {
          await this.historyStore.appendEvent(taskId, { type: 'completed', timestamp: Date.now(), result })
          await this.hooks.callHook('task:completed', completedTask)
          taskCompleted(taskId, result.duration)
        }
      }
      else {
        const currentTask = await this.taskManager.getTask(taskId)
        if (currentTask && currentTask.retryCount < currentTask.maxRetries) {
          await this.taskManager.incrementRetry(taskId)
          await this.taskManager.transitionStatus(taskId, 'pending')
          const retryTask = await this.taskManager.getTask(taskId)
          if (retryTask) {
            this.taskQueue.enqueue(retryTask)
            this.processQueue()
          }
        }
        else {
          await this.taskManager.transitionStatus(taskId, 'failed')
          const failedTask = await this.taskManager.getTask(taskId)
          if (failedTask) {
            await this.historyStore.appendEvent(taskId, {
              type: 'failed',
              timestamp: Date.now(),
              error: { code: 'MAX_RETRIES', message: 'Maximum retries exceeded', recoverable: false },
            })
            await this.hooks.callHook('task:failed', failedTask)
            taskFailed(taskId, 'Maximum retries exceeded')
          }
        }
      }
    }
    catch (err) {
      await this.taskManager.transitionStatus(taskId, 'failed')
      const failedTask = await this.taskManager.getTask(taskId)
      if (failedTask) {
        await this.historyStore.appendEvent(taskId, {
          type: 'failed',
          timestamp: Date.now(),
          error: { code: 'EXECUTION_ERROR', message: String(err), recoverable: false },
        })
        await this.hooks.callHook('task:failed', failedTask)
        taskFailed(taskId, String(err))
      }
    }
    finally {
      this.registry.updateStatus(agent.id, 'idle', undefined)
    }
  }
}

export type { OrchestratorConfig, OrchestratorHooks } from './types'
