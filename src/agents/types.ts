import { z } from 'zod'

// Task-processing agent types (distinct from CLI adapter Agent in config/define)

// --- AgentStatus ---
export const AgentStatusSchema = z.enum(['idle', 'busy', 'offline'])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

// --- RetryStrategy ---
export const RetryStrategySchema = z.object({
  maxRetries: z.number(),
  backoff: z.enum(['linear', 'exponential']),
  initialDelay: z.number(),
  maxDelay: z.number(),
})
export type RetryStrategy = z.infer<typeof RetryStrategySchema>

// --- AgentConfig ---
export const AgentConfigSchema = z.object({
  maxConcurrentTasks: z.number(),
  timeout: z.number(),
  retryStrategy: RetryStrategySchema,
})
export type AgentConfig = z.infer<typeof AgentConfigSchema>

// --- AgentStatistics ---
export const AgentStatisticsSchema = z.object({
  totalTasks: z.number(),
  completedTasks: z.number(),
  failedTasks: z.number(),
  averageDuration: z.number(),
  successRate: z.number().min(0).max(1),
})
export type AgentStatistics = z.infer<typeof AgentStatisticsSchema>

// --- TaskAgent ---
export const TaskAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  capabilities: z.array(z.string()),
  specialties: z.array(z.string()),
  status: AgentStatusSchema,
  currentTaskId: z.string().optional(),
  config: AgentConfigSchema,
  statistics: AgentStatisticsSchema,
  metadata: z.record(z.string(), z.unknown()),
})
export type TaskAgent = z.infer<typeof TaskAgentSchema>
