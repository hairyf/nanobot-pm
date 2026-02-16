import type { Agent } from '../config/define'

/**
 * @deprecated Use `Agent` from `../config/define` instead.
 */
export type SessionAdapter = Agent

export function createSession(adapter: Agent) {
  return {
    async start(system: string) {
      return adapter.fresh(system)
    },
    async launch(system: string, prompt: string, options?: { logFile?: string }) {
      return adapter.launch(system, prompt, options)
    },
    async reply(session: string, message: string) {
      return adapter.reply(session, message)
    },
    async clear(session: string) {
      return adapter.clear(session)
    },
  }
}
