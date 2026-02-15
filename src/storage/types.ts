import type { Mediation } from '../mediator/types'
import type { Score } from '../scorer/types'
import type { Task, TaskEvent, TaskHistory, TaskStatistics, TaskStatus } from '../task/types'
import { z } from 'zod'

// --- StorageConfig ---
export const StorageConfigSchema = z.object({
  driver: z.enum(['fs', 'redis', 'sqlite']).default('fs'),
  basePath: z.string().default('.agentic/storage'),
})
export type StorageConfig = z.infer<typeof StorageConfigSchema>

// --- TaskStoreInterface ---
export interface TaskStoreInterface {
  save: (task: Task) => Promise<void>
  get: (id: string) => Promise<Task | undefined>
  list: () => Promise<Task[]>
  delete: (id: string) => Promise<void>
  updateStatus: (id: string, status: TaskStatus) => Promise<void>
  getByStatus: (status: TaskStatus) => Promise<Task[]>
  getByAgent: (agentId: string) => Promise<Task[]>
  getByParent: (parentTaskId: string) => Promise<Task[]>
}

// --- HistoryStoreInterface ---
export interface HistoryStoreInterface {
  appendEvent: (taskId: string, event: TaskEvent) => Promise<void>
  getHistory: (taskId: string) => Promise<TaskHistory | undefined>
  getStatistics: (taskId: string) => Promise<TaskStatistics | undefined>
  appendScore: (taskId: string, score: Score) => Promise<void>
  appendMediation: (taskId: string, mediation: Mediation) => Promise<void>
}
