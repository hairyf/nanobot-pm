import { config } from '../config'

export const session = {
  async start(system: string) {
    await config.ready()
    return config.agent.fresh(system)
  },
  async reply(session: string, message: string) {
    await config.ready()
    return config.agent.reply(session, message)
  },
  async clear(session: string) {
    await config.ready()
    return config.agent.clear(session)
  },
}
