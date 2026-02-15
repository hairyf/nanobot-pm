import type { Mediation } from '../mediator/types'
import type { Score } from '../scorer/types'
import type { Task } from '../task/types'
import { z } from 'zod'

// --- SessionStatus ---
export const SessionStatusSchema = z.enum(['active', 'disconnected', 'reconnected', 'closed'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

// --- SessionBinding ---
export const SessionBindingSchema = z.object({
  sessionId: z.string(),
  taskId: z.string(),
  status: SessionStatusSchema,
  pollInterval: z.number().default(10000),
  boundAt: z.number(),
  lastActiveAt: z.number(),
  disconnectedAt: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()),
})
export type SessionBinding = z.infer<typeof SessionBindingSchema>

// --- OrchestratorConfig ---
export const OrchestratorConfigSchema = z.object({
  maxConcurrentTasks: z.number().default(5),
  defaultTimeout: z.number().default(1800000),
  maxRetries: z.number().default(3),
  pollInterval: z.number().default(10000),
  maxDepth: z.number().default(10),
  memoryThreshold: z.string().default('500MB'),
})
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>

// --- ReporterOptions (callbacks are functions; use plain TypeScript for callback types) ---
export interface ReporterOptions {
  pollInterval: number
  onProgress: (task: Task) => void
  onComplete: (task: Task) => void
  onError: (error: Error) => void
}

// --- OrchestratorHooks (hookable event interface; plain TypeScript) ---
export interface OrchestratorHooks {
  'task:created': (task: Task) => void
  'task:assigned': (task: Task) => void
  'task:started': (task: Task) => void
  'task:completed': (task: Task) => void
  'task:failed': (task: Task) => void
  'score:submitted': (score: Score) => void
  'mediation:triggered': (mediation: Mediation) => void
}
