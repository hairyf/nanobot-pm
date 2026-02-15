import type { HistoryStoreInterface, TaskStoreInterface } from '../storage/types'
import type { Task, TaskStatus, TaskType } from './types'
import { taskCreated } from '../utils/logger'
import { generateUUID } from '../utils/validator'

// Valid state transitions
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['waiting_user', 'completed', 'failed', 'cancelled'],
  waiting_user: ['running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
}

export class TaskManager {
  constructor(
    private taskStore: TaskStoreInterface,
    private historyStore: HistoryStoreInterface,
  ) {}

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false
  }

  async createTask(options: { description: string, type: TaskType, parentTaskId?: string, depth?: number, timeout?: number, maxRetries?: number, metadata?: Record<string, unknown>, tags?: string[] }): Promise<Task> {
    const now = Date.now()
    const task: Task = {
      id: generateUUID(),
      description: options.description,
      type: options.type,
      status: 'pending',
      childTaskIds: [],
      depth: options.depth ?? 0,
      createdAt: now,
      updatedAt: now,
      timeout: options.timeout ?? 1800000,
      maxRetries: options.maxRetries ?? 3,
      retryCount: 0,
      metadata: options.metadata ?? {},
      tags: options.tags ?? [],
      parentTaskId: options.parentTaskId,
    }
    await this.taskStore.save(task)
    await this.historyStore.appendEvent(task.id, {
      type: 'created',
      timestamp: now,
      data: { description: task.description, type: task.type, parentTaskId: task.parentTaskId },
    })
    taskCreated(task.id, task.description, task.type)
    return task
  }

  async transitionStatus(taskId: string, newStatus: TaskStatus): Promise<Task> {
    const task = await this.taskStore.get(taskId)
    if (!task)
      throw new Error(`Task not found: ${taskId}`)
    if (!this.canTransition(task.status, newStatus)) {
      throw new Error(`Invalid transition: ${task.status} → ${newStatus}`)
    }
    await this.taskStore.updateStatus(taskId, newStatus)
    const updated = await this.taskStore.get(taskId)
    return updated!
  }

  async incrementRetry(taskId: string): Promise<Task> {
    const task = await this.taskStore.get(taskId)
    if (!task)
      throw new Error(`Task not found: ${taskId}`)
    const updated = { ...task, retryCount: task.retryCount + 1, updatedAt: Date.now() }
    await this.taskStore.save(updated)
    await this.historyStore.appendEvent(taskId, { type: 'retried', timestamp: Date.now(), attempt: updated.retryCount })
    return updated
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    return this.taskStore.get(taskId)
  }
}
