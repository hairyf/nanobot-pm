import type { AgentRegistry } from '../agents/registry'
import type { TaskAgent } from '../agents/types'
import type { Task } from '../task/types'
import { taskAssigned } from '../utils/logger'

export class Scheduler {
  constructor(private registry: AgentRegistry) {}

  assignTask(task: Task): TaskAgent | undefined {
    const keywords = task.description.toLowerCase().split(/\s+/)
    const agent = this.registry.selectBest(keywords)
    if (agent) {
      this.registry.updateStatus(agent.id, 'busy', task.id)
      taskAssigned(task.id, agent.id)
    }
    return agent
  }

  releaseAgent(agentId: string): void {
    this.registry.updateStatus(agentId, 'idle', undefined)
  }

  calculateBackoff(retryCount: number, strategy: 'linear' | 'exponential' = 'exponential', initialDelay: number = 1000, maxDelay: number = 60000): number {
    if (strategy === 'linear') {
      return Math.min(initialDelay * retryCount, maxDelay)
    }
    return Math.min(initialDelay * (2 ** (retryCount - 1)), maxDelay)
  }
}
