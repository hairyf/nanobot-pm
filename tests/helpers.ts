import type { TaskAgent } from '../src/agents/types'
import type { Task } from '../src/task/types'
import { generateUUID } from '../src/utils/validator'

const defaultAgentConfig = {
  maxConcurrentTasks: 1,
  timeout: 1800000,
  retryStrategy: {
    maxRetries: 3,
    backoff: 'linear' as const,
    initialDelay: 1000,
    maxDelay: 30000,
  },
}

const defaultAgentStatistics = {
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  averageDuration: 0,
  successRate: 1,
}

export function createMockAgent(overrides?: Partial<TaskAgent>): TaskAgent {
  return {
    id: `agent-${generateUUID().slice(0, 8)}`,
    name: 'MockAgent',
    type: 'developer',
    capabilities: ['coding'],
    specialties: ['typescript'],
    status: 'idle',
    config: defaultAgentConfig,
    statistics: defaultAgentStatistics,
    metadata: {},
    ...overrides,
  }
}

export function createMockTask(overrides?: Partial<Task>): Task {
  const now = Date.now()
  return {
    id: generateUUID(),
    description: 'Test task',
    status: 'pending',
    childTaskIds: [],
    depth: 0,
    createdAt: now,
    updatedAt: now,
    timeout: 1800000,
    maxRetries: 3,
    retryCount: 0,
    metadata: {},
    tags: [],
    ...overrides,
  }
}
