import type { TaskAgent } from './types'

export class AgentRegistry {
  private agents = new Map<string, TaskAgent>()

  register(agent: TaskAgent): void {
    this.agents.set(agent.id, agent)
  }

  unregister(id: string): boolean {
    return this.agents.delete(id)
  }

  getById(id: string): TaskAgent | undefined {
    return this.agents.get(id)
  }

  listAvailable(): TaskAgent[] {
    return [...this.agents.values()].filter(a => a.status === 'idle')
  }

  listAll(): TaskAgent[] {
    return [...this.agents.values()]
  }

  matchByCapabilities(keywords: string[]): TaskAgent[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    return this.listAvailable()
      .map((agent) => {
        const allTags = [...agent.capabilities, ...agent.specialties].map(s => s.toLowerCase())
        const matchCount = lowerKeywords.filter(kw => allTags.some(tag => tag.includes(kw) || kw.includes(tag))).length
        return { agent, matchCount }
      })
      .filter(({ matchCount }) => matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map(({ agent }) => agent)
  }

  selectBest(keywords: string[]): TaskAgent | undefined {
    const matches = this.matchByCapabilities(keywords)
    if (matches.length > 0)
      return matches[0]
    // Fallback: if no capability match, return any available agent
    const available = this.listAvailable()
    return available[0]
  }

  hasSuitableAgent(keywords: string[]): boolean {
    const matches = this.matchByCapabilities(keywords)
    return matches.length > 0
  }

  updateStatus(id: string, status: TaskAgent['status'], currentTaskId?: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.status = status
      agent.currentTaskId = currentTaskId
    }
  }
}
