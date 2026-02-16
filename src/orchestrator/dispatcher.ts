import type { AgentRegistry } from '../agents/registry'
import type { TaskAgent } from '../agents/types'
import type { Task } from '../task/types'

export class Dispatcher {
  constructor(private registry: AgentRegistry) {}

  selectAgent(task: Task): TaskAgent | undefined {
    const keywords = task.description.toLowerCase().split(/\s+/)
    return this.registry.selectBest(keywords)
  }

  checkAvailability(): TaskAgent[] {
    return this.registry.listAvailable()
  }

  hasAvailableAgent(): boolean {
    return this.checkAvailability().length > 0
  }

  selectDownstreamAgent(task: Task, excludeAgentIds: string[]): TaskAgent | undefined {
    const keywords = task.description.toLowerCase().split(/\s+/)
    const matches = this.registry.matchByCapabilities(keywords)
    return matches.find(agent => !excludeAgentIds.includes(agent.id))
  }
}
