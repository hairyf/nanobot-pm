import type { Storage } from 'unstorage'
import type { HistoryStoreInterface, TaskStoreInterface } from '../storage/types'
import type { QueryOption, UserQuery } from './types'
import { HistoryStore } from '../storage/history'
import { TaskStore } from '../storage/task'
import { generateUUID } from '../utils/validator'

const QUERY_PREFIX = 'queries:'
const INDEX_QUERY_TASK_PREFIX = 'index:query-task:'

export class AskManager {
  private taskStore: TaskStoreInterface
  private historyStore: HistoryStoreInterface

  constructor(private storage: Storage) {
    this.taskStore = new TaskStore(storage)
    this.historyStore = new HistoryStore(storage)
  }

  async createQuery(options: {
    taskId: string
    question: string
    options?: QueryOption[]
    context?: string
    metadata?: Record<string, unknown>
  }): Promise<UserQuery> {
    // Check for pending concurrent query
    const existingQuery = await this.getQueryByTask(options.taskId)
    if (existingQuery) {
      throw new Error(`Task ${options.taskId} already has a pending query`)
    }

    const now = Date.now()
    const query: UserQuery = {
      id: generateUUID(),
      taskId: options.taskId,
      question: options.question,
      context: options.context,
      options: options.options ?? [],
      waitIndefinitely: true,
      reminderInterval: 86400000,
      createdAt: now,
      metadata: options.metadata ?? {},
    }

    const key = `${QUERY_PREFIX}${query.id}`
    await this.storage.setItem(key, query)

    const indexKey = `${INDEX_QUERY_TASK_PREFIX}${options.taskId}`
    await this.storage.setItem(indexKey, query.id)

    // Auto-transition task to waiting_user
    const task = await this.taskStore.get(options.taskId)
    if (task && task.status === 'running') {
      await this.taskStore.updateStatus(options.taskId, 'waiting_user')
    }

    // Record user_query event in history
    await this.historyStore.appendEvent(options.taskId, {
      type: 'user_query',
      timestamp: now,
      queryId: query.id,
    })

    return query
  }

  async getQuery(queryId: string): Promise<UserQuery | undefined> {
    const key = `${QUERY_PREFIX}${queryId}`
    const query = await this.storage.getItem<UserQuery>(key)
    return query ?? undefined
  }

  async getQueryByTask(taskId: string): Promise<UserQuery | undefined> {
    const indexKey = `${INDEX_QUERY_TASK_PREFIX}${taskId}`
    const queryId = await this.storage.getItem<string>(indexKey)
    if (!queryId) {
      return undefined
    }
    const query = await this.getQuery(queryId)
    if (query && !query.respondedAt) {
      return query
    }
    return undefined
  }

  async submitResponse(
    queryId: string,
    selectedOptionId: string,
    responseText?: string,
  ): Promise<UserQuery> {
    const query = await this.getQuery(queryId)
    if (!query) {
      throw new Error(`Query not found: ${queryId}`)
    }

    // Only validate option if options array is not empty
    if (query.options.length > 0) {
      const optionExists = query.options.some(opt => opt.id === selectedOptionId)
      if (!optionExists) {
        throw new Error(`Invalid option: ${selectedOptionId}`)
      }
    }

    const now = Date.now()
    const updated: UserQuery = {
      ...query,
      selectedOption: selectedOptionId,
      response: responseText,
      respondedAt: now,
    }

    const key = `${QUERY_PREFIX}${queryId}`
    await this.storage.setItem(key, updated)

    // Clear the task→query index so next query can be created
    const indexKey = `${INDEX_QUERY_TASK_PREFIX}${query.taskId}`
    await this.storage.removeItem(indexKey)

    // Auto-transition task back to running
    const task = await this.taskStore.get(query.taskId)
    if (task && task.status === 'waiting_user') {
      await this.taskStore.updateStatus(query.taskId, 'running')
    }

    // Record user_response event in history
    await this.historyStore.appendEvent(query.taskId, {
      type: 'user_response',
      timestamp: now,
      response: selectedOptionId,
    })

    return updated
  }
}
