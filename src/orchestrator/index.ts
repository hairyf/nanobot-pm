import type { Storage } from 'unstorage'
import type { Agent } from '../config/define'
import type { AppConfig } from '../config/schema'
import type { QueryOption } from '../task/types'
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
import { UserQueryManager } from '../task/user-query'
import { logger, taskCompleted, taskFailed } from '../utils/logger'
import { Dispatcher } from './dispatcher'
import { SessionReporter } from './reporter'
import { Scheduler } from './scheduler'

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
  public scheduler: Scheduler
  public dispatcher: Dispatcher
  public historyStore: HistoryStore
  public queryManager: UserQueryManager

  private taskStore: TaskStore
  private config: AppConfig
  private platform?: Agent
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
    this.scheduler = new Scheduler(this.registry)
    this.dispatcher = new Dispatcher(this.registry)
    this.queryManager = new UserQueryManager(options.storage)
  }

  async submitTask(description: string, options?: { parentTaskId?: string, depth?: number, agentId?: string }): Promise<string> {
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

    // Handle downstream tasks by delegating to child tasks
    if (task.type === 'downstream') {
      await this.processDownstreamTask(taskId)
      return
    }

    // Handle inquiry tasks by creating user queries
    if (task.type === 'inquiry') {
      await this.processInquiryTask(taskId)
      return
    }

    // Use pre-assigned agent or assign via scheduler
    let agent = task.assignedAgent ? this.registry.getById(task.assignedAgent) : undefined
    if (!agent) {
      agent = this.scheduler.assignTask(task)
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

  async processDownstreamTask(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId)
    if (!task)
      return

    // Skip if task is already in a terminal state
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
      return

    // Transition parent to running if not already
    if (task.status !== 'running') {
      await this.taskManager.transitionStatus(taskId, 'running')
      await this.historyStore.appendEvent(taskId, { type: 'started', timestamp: Date.now() })
    }

    // Check if child tasks already exist
    const existingChildren = await this.taskManager.getChildTasks(taskId)
    if (existingChildren.length === 0) {
      // Find all available agents for this task
      const availableAgents = this.registry.listAvailable()

      if (availableAgents.length === 0) {
        await this.taskManager.transitionStatus(taskId, 'failed')
        await this.historyStore.appendEvent(taskId, {
          type: 'failed',
          timestamp: Date.now(),
          error: { code: 'NO_SUITABLE_AGENTS', message: 'No suitable agents found for downstream task', recoverable: false },
        })
        logger.warn(`No suitable agents found for downstream task ${taskId}`)
        return
      }

      // Create a specialized child task for each agent
      for (const agent of availableAgents) {
        const domain = agent.specialties.length > 0 ? agent.specialties.join(' ') : agent.capabilities.join(' ')
        const childTask = await this.taskManager.createChildTask(taskId, {
          description: `${domain} implementation`,
          type: 'local',
        })
        // Pre-assign agent and mark busy
        await this.taskManager.assignTask(childTask.id, agent.id)
        this.registry.updateStatus(agent.id, 'busy', childTask.id)
        this.taskQueue.enqueue(childTask)
      }
    }

    // Process child tasks (if any are pending)
    this.processQueue()

    // Wait for all child tasks to complete and aggregate results
    await this.aggregateChildResults(taskId)
  }

  async aggregateChildResults(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId)
    if (!task)
      return

    // Poll until all child tasks are complete
    const maxWaitTime = task.timeout
    const startTime = Date.now()
    const pollInterval = 1000 // Check every second

    while (Date.now() - startTime < maxWaitTime) {
      const childTasks = await this.taskManager.getChildTasks(taskId)
      if (childTasks.length === 0) {
        // No child tasks yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        continue
      }

      const allCompleted = childTasks.every(child => child.status === 'completed' || child.status === 'failed' || child.status === 'cancelled')
      if (allCompleted) {
        // All children completed, aggregate results
        const completedChildren = childTasks.filter(child => child.status === 'completed')
        const failedChildren = childTasks.filter(child => child.status === 'failed')

        if (failedChildren.length > 0 && completedChildren.length === 0) {
          // All children failed
          await this.taskManager.transitionStatus(taskId, 'failed')
          await this.historyStore.appendEvent(taskId, {
            type: 'failed',
            timestamp: Date.now(),
            error: { code: 'ALL_CHILDREN_FAILED', message: 'All child tasks failed', recoverable: false },
          })
          await this.hooks.callHook('task:failed', task)
          taskFailed(taskId, 'All child tasks failed')
        }
        else {
          // At least some children succeeded, aggregate their results
          const aggregatedResult = {
            taskId,
            success: completedChildren.length > 0,
            output: {
              completed: completedChildren.length,
              failed: failedChildren.length,
              total: childTasks.length,
              childResults: childTasks.map(child => ({
                id: child.id,
                status: child.status,
                description: child.description,
              })),
            },
            duration: Date.now() - (task.createdAt),
            metadata: {},
          }

          await this.taskManager.transitionStatus(taskId, 'completed')
          const completedTask = await this.taskManager.getTask(taskId)
          if (completedTask) {
            await this.historyStore.appendEvent(taskId, { type: 'completed', timestamp: Date.now(), result: aggregatedResult })
            await this.hooks.callHook('task:completed', completedTask)
            taskCompleted(taskId, aggregatedResult.duration)
          }
        }
        return
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    // Timeout reached
    await this.taskManager.transitionStatus(taskId, 'failed')
    await this.historyStore.appendEvent(taskId, {
      type: 'failed',
      timestamp: Date.now(),
      error: { code: 'AGGREGATION_TIMEOUT', message: 'Timeout waiting for child tasks to complete', recoverable: false },
    })
    await this.hooks.callHook('task:failed', task)
    taskFailed(taskId, 'Timeout waiting for child tasks to complete')
  }

  async processInquiryTask(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId)
    if (!task)
      return

    // Transition to running if needed
    if (task.status !== 'running') {
      await this.taskManager.transitionStatus(taskId, 'running')
      await this.historyStore.appendEvent(taskId, { type: 'started', timestamp: Date.now() })
    }

    const questions = this.parseInquiryQuestions(task.description)

    for (const { question, options } of questions) {
      // Create a user query (auto-transitions task to waiting_user)
      await this.queryManager.createQuery({
        taskId,
        question,
        options,
      })

      // Wait for user to respond
      await this.waitForQueryResponse(taskId)
    }
  }

  private async waitForQueryResponse(taskId: string): Promise<void> {
    const maxWait = 600000 // 10 minute max wait
    const startTime = Date.now()
    while (Date.now() - startTime < maxWait) {
      const query = await this.queryManager.getQueryByTask(taskId)
      if (!query)
        break // Response has been submitted
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  private parseInquiryQuestions(description: string): Array<{ question: string, options: QueryOption[] }> {
    const questions: Array<{ question: string, options: QueryOption[] }> = []

    // Split by "then" for multiple questions
    const parts = description.split(/,\s*then\s+/i)

    for (const part of parts) {
      const trimmed = part.trim()
      const orMatch = trimmed.match(/(?:choose|select|decide)\s+(?:between\s+|on\s+|from\s+)?(.+?)\s+or\s+(.+)$/i)
      if (orMatch) {
        const opt1 = orMatch[1].trim()
        const opt2 = orMatch[2].trim()
        questions.push({
          question: trimmed,
          options: [
            { id: `option-${opt1.toLowerCase().replace(/\s+/g, '-')}`, label: opt1, value: opt1 },
            { id: `option-${opt2.toLowerCase().replace(/\s+/g, '-')}`, label: opt2, value: opt2 },
          ],
        })
      }
      else {
        questions.push({
          question: trimmed,
          options: [
            { id: 'option-yes', label: 'Yes', value: true },
            { id: 'option-no', label: 'No', value: false },
          ],
        })
      }
    }

    if (questions.length === 0) {
      questions.push({
        question: description,
        options: [
          { id: 'option-yes', label: 'Yes', value: true },
          { id: 'option-no', label: 'No', value: false },
        ],
      })
    }

    return questions
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
