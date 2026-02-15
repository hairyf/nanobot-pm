// Session module - to be expanded in US1 with SessionBinding support
// Legacy session adapter functionality preserved for backward compatibility

export interface SessionAdapter {
  fresh: (system: string) => Promise<string>
  start: (session: string) => Promise<unknown>
  reply: (session: string, message: string) => Promise<unknown>
  clear: (session: string) => Promise<unknown>
}

export function createSession(adapter: SessionAdapter) {
  return {
    async start(system: string) {
      return adapter.fresh(system)
    },
    async reply(session: string, message: string) {
      return adapter.reply(session, message)
    },
    async clear(session: string) {
      return adapter.clear(session)
    },
  }
}
