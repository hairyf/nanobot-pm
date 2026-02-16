import type { Mediation } from '../mediator/types'
import type { Score } from '../scorer/types'
import type { Task } from '../task/types'
import { z } from 'zod'

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
