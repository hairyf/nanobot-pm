import { z } from 'zod'

// --- Execution Status ---
export const ExecutionStatusSchema = z.enum([
  'creating',
  'running',
  'finished',
  'error',
  'stopped',
])
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

// --- Execution Handle (returned when launching an agent) ---
export interface ExecutionHandle {
  executionId: string
  url?: string
}

// --- Execution Result (returned when querying status) ---
export interface ExecutionResult {
  status: ExecutionStatus
  summary?: string
  branchName?: string
  prUrl?: string
}

// --- Launch Options ---
export interface LaunchOptions {
  repository?: string
  ref?: string
  model?: string
  autoCreatePr?: boolean
  branchName?: string
}

// --- Agent Executor Interface ---
export interface AgentExecutor {
  /**
   * Launch an agent to execute a task.
   * Returns an execution handle with an ID for status tracking.
   */
  launch: (prompt: string, options?: LaunchOptions) => Promise<ExecutionHandle>

  /**
   * Query the current status of an execution.
   */
  getStatus: (executionId: string) => Promise<ExecutionResult>

  /**
   * Stop a running execution.
   */
  stop: (executionId: string) => Promise<void>
}
