import type { AppConfig } from './schema'

export interface Agent {
  fresh: (system: string) => Promise<string>
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
