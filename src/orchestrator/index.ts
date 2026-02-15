import type { Storage } from 'unstorage'
import type { AppConfig } from '../config/schema'
import type { OrchestratorHooks } from './types'
import { createHooks } from 'hookable'
import { executeTask } from '../agents/executor'
import { AgentRegistry } from '../agents/registry'
import { evaluate } from '../scorer/evaluator'
import { HistoryStore } from '../storage/history-store'
import { TaskStore } from '../storage/task-store'
import { classifyTask } from '../task/classifier'
import { TaskManager } from '../task/manager'
import { TaskQueue } from '../task/queue'
import { logger, taskCompleted, taskFailed } from '../utils/logger'
import { Dispatcher } from './dispatcher'
import { SessionReporter } from './reporter'
import { Scheduler } from './scheduler'

export interface OrchestratorOptions {
  config: AppConfig
  storage: Storage
}

export class Orchestrator {
  public hooks = createHooks<OrchestratorHooks>()
  public taskManager: TaskManager
  public taskQueue: TaskQueue
  public registry: AgentRegistry
  public scheduler: Scheduler
  public dispatcher: Dispatcher

  private taskStore: TaskStore
  private historyStore: HistoryStore
  private config: AppConfig

  constructor(options: OrchestratorOptions) {
    this.config = options.config
    this.taskStore = new TaskStore(options.storage)
    this.historyStore = new HistoryStore(options.storage)
    this.taskManager = new TaskManager(this.taskStore, this.historyStore)
    this.taskQueue = new TaskQueue(options.config.orchestrator.maxConcurrentTasks)
    this.registry = new AgentRegistry()
    this.scheduler = new Scheduler(this.registry)
    this.dispatcher = new Dispatcher(this.registry)
  }

  async submitTask(description: string, options?: { parentTaskId?: string, depth?: number }): Promise<string> {
    const agents = this.registry.listAll()
    const type = classifyTask(description, agents)

    const task = await this.taskManager.createTask({
      description,
      type,
      parentTaskId: options?.parentTaskId,
      depth: options?.depth,
      timeout: this.config.orchestrator.defaultTimeout,
      maxRetries: this.config.orchestrator.maxRetries,
    })

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

    this.processTask(task.id)
      .catch(err => logger.error('Task processing error', err))
      .finally(() => {
        this.taskQueue.markDone(task.id)
        this.processQueue()
      })
  }

  async processTask(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId)
    if (!task)
      return

    const agent = this.scheduler.assignTask(task)
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
      const result = await executeTask(agent, updatedTask, { timeout: this.config.orchestrator.defaultTimeout })

      const scorerConfig = {
        scoreThreshold: this.config.scorer.scoreThreshold,
        rules: [],
      }
      const score = evaluate(updatedTask, result, scorerConfig)
      await this.historyStore.appendScore(taskId, score)
      await this.hooks.callHook('score:submitted', score)

      if (score.result === 'pass') {
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
      this.scheduler.releaseAgent(agent.id)
    }
  }

  createReporter(pollInterval?: number): SessionReporter {
    const interval = pollInterval ?? this.config.orchestrator.pollInterval
    const noop = () => {}
    return new SessionReporter(
      { pollInterval: interval, onProgress: noop, onComplete: noop, onError: noop },
      taskId => this.taskManager.getTask(taskId),
    )
  }
}

export { Dispatcher } from './dispatcher'
export { runLoop } from './loop'
export { SessionReporter } from './reporter'
export { Scheduler } from './scheduler'
export type { OrchestratorConfig, OrchestratorHooks, ReporterOptions, SessionBinding } from './types'
