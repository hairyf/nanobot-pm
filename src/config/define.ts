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
