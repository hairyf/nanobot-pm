import type { Storage } from 'unstorage'
import type { Task, TaskStatus } from '../task/types'
import type { TaskStoreInterface } from './types'

const TASK_PREFIX = 'tasks:'
const INDEX_STATUS_PREFIX = 'index:status:'
const INDEX_AGENT_PREFIX = 'index:agent:'
const INDEX_PARENT_PREFIX = 'index:parent:'

async function getIndexIds(storage: Storage, indexKey: string): Promise<string[]> {
  const raw = await storage.getItem<string[]>(indexKey)
  return Array.isArray(raw) ? raw : []
}

async function addToIndex(storage: Storage, indexKey: string, taskId: string): Promise<void> {
  const ids = await getIndexIds(storage, indexKey)
  if (!ids.includes(taskId)) {
    ids.push(taskId)
    await storage.setItem(indexKey, ids)
  }
}

async function removeFromIndex(storage: Storage, indexKey: string, taskId: string): Promise<void> {
  const ids = await getIndexIds(storage, indexKey)
  const next = ids.filter(id => id !== taskId)
  if (next.length !== ids.length) {
    await storage.setItem(indexKey, next)
  }
}

export class TaskStore implements TaskStoreInterface {
  constructor(private storage: Storage) {}

  async save(task: Task): Promise<void> {
    const key = `${TASK_PREFIX}${task.id}`
    const existing = await this.storage.getItem<Task>(key)

    if (existing) {
      await removeFromIndex(this.storage, `${INDEX_STATUS_PREFIX}${existing.status}`, task.id)
      if (existing.assignedAgent) {
        await removeFromIndex(this.storage, `${INDEX_AGENT_PREFIX}${existing.assignedAgent}`, task.id)
      }
      if (existing.parentTaskId) {
        await removeFromIndex(this.storage, `${INDEX_PARENT_PREFIX}${existing.parentTaskId}`, task.id)
      }
    }

    await this.storage.setItem(key, task)
    await addToIndex(this.storage, `${INDEX_STATUS_PREFIX}${task.status}`, task.id)
    if (task.assignedAgent) {
      await addToIndex(this.storage, `${INDEX_AGENT_PREFIX}${task.assignedAgent}`, task.id)
    }
    if (task.parentTaskId) {
      await addToIndex(this.storage, `${INDEX_PARENT_PREFIX}${task.parentTaskId}`, task.id)
    }
  }

  async get(id: string): Promise<Task | undefined> {
    const key = `${TASK_PREFIX}${id}`
    const task = await this.storage.getItem<Task>(key)
    return task ?? undefined
  }

  async list(): Promise<Task[]> {
    const keys = await this.storage.getKeys(TASK_PREFIX)
    const tasks: Task[] = []
    for (const key of keys) {
      const task = await this.storage.getItem<Task>(key)
      if (task)
        tasks.push(task)
    }
    return tasks
  }

  async delete(id: string): Promise<void> {
    const key = `${TASK_PREFIX}${id}`
    const task = await this.storage.getItem<Task>(key)
    if (task) {
      await removeFromIndex(this.storage, `${INDEX_STATUS_PREFIX}${task.status}`, id)
      if (task.assignedAgent) {
        await removeFromIndex(this.storage, `${INDEX_AGENT_PREFIX}${task.assignedAgent}`, id)
      }
      if (task.parentTaskId) {
        await removeFromIndex(this.storage, `${INDEX_PARENT_PREFIX}${task.parentTaskId}`, id)
      }
    }
    await this.storage.removeItem(key)
  }

  async updateStatus(id: string, status: TaskStatus): Promise<void> {
    const task = await this.get(id)
    if (!task)
      return
    const oldStatus = task.status
    await removeFromIndex(this.storage, `${INDEX_STATUS_PREFIX}${oldStatus}`, id)
    const updated: Task = { ...task, status, updatedAt: Date.now() }
    await this.storage.setItem(`${TASK_PREFIX}${id}`, updated)
    await addToIndex(this.storage, `${INDEX_STATUS_PREFIX}${status}`, id)
  }

  async getByStatus(status: TaskStatus): Promise<Task[]> {
    const ids = await getIndexIds(this.storage, `${INDEX_STATUS_PREFIX}${status}`)
    const tasks: Task[] = []
    for (const id of ids) {
      const task = await this.get(id)
      if (task)
        tasks.push(task)
    }
    return tasks
  }

  async getByAgent(agentId: string): Promise<Task[]> {
    const ids = await getIndexIds(this.storage, `${INDEX_AGENT_PREFIX}${agentId}`)
    const tasks: Task[] = []
    for (const id of ids) {
      const task = await this.get(id)
      if (task)
        tasks.push(task)
    }
    return tasks
  }

  async getByParent(parentTaskId: string): Promise<Task[]> {
    const ids = await getIndexIds(this.storage, `${INDEX_PARENT_PREFIX}${parentTaskId}`)
    const tasks: Task[] = []
    for (const id of ids) {
      const task = await this.get(id)
      if (task)
        tasks.push(task)
    }
    return tasks
  }
}
