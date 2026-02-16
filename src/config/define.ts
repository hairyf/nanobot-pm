import type { AppConfig } from './schema'

export interface LaunchOptions {
  logFile?: string
  /** Path to the prompt file containing full system+task prompt for reliable delivery. */
  promptFile?: string
  /** Task ID so the agent can reference lifecycle commands. */
  taskId?: string
}

export interface Agent {
  /** Blocking: create session, send prompt, wait for completion. */
  fresh: (system: string) => Promise<string>
  /**
   * Non-blocking: spawn a detached background AI process, return sessionId immediately.
   * @param system - System prompt (agentic framework rules, agent definition, capabilities)
   * @param prompt - User/upstream task description (the actual work request)
   */
  launch: (system: string, prompt: string, options?: LaunchOptions) => Promise<string>
  start: (session: string) => Promise<any>
  reply: (session: string, message: string) => Promise<any>
  clear: (session: string) => Promise<any>
}

export interface AgenticConfig {
  agent: Agent
}

export function defineAgentic(config: AgenticConfig) {
  return config
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export function defineConfig(config: DeepPartial<AppConfig>): DeepPartial<AppConfig> {
  return config
}
