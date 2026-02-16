import type { TaskAgent } from '../../../src/agents/types'
import type { Task } from '../../../src/task/types'
import { describe, expect, it } from 'vitest'
import { buildAgentPrompt } from '../../../src/executor/prompt-builder'

function createMockAgent(overrides?: Partial<TaskAgent>): TaskAgent {
  return {
    id: 'developer',
    name: 'developer',
    capabilities: ['coding', 'testing', 'debugging'],
    specialties: ['typescript', 'javascript'],
    status: 'idle',
    config: {
      maxConcurrentTasks: 5,
      description: 'A general-purpose developer agent',
      retryStrategy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
    },
    statistics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageDuration: 0,
      successRate: 1,
    },
    ...overrides,
  }
}

function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    description: 'Create a README file',
    type: 'local',
    status: 'pending',
    childTaskIds: [],
    depth: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timeout: 1800000,
    maxRetries: 3,
    retryCount: 0,
    metadata: {},
    tags: [],
    ...overrides,
  }
}

describe('buildAgentPrompt', () => {
  it('includes agent name and description', () => {
    const agent = createMockAgent()
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).toContain('# Agent: developer')
    expect(prompt).toContain('A general-purpose developer agent')
  })

  it('includes capabilities section', () => {
    const agent = createMockAgent()
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).toContain('## Capabilities')
    expect(prompt).toContain('- coding')
    expect(prompt).toContain('- testing')
    expect(prompt).toContain('- debugging')
  })

  it('includes specialties section', () => {
    const agent = createMockAgent()
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).toContain('## Specialties')
    expect(prompt).toContain('- typescript')
    expect(prompt).toContain('- javascript')
  })

  it('includes task description and type', () => {
    const agent = createMockAgent()
    const task = createMockTask({ description: 'Fix the auth bug', type: 'local' })
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).toContain('## Task')
    expect(prompt).toContain('**Type:** local')
    expect(prompt).toContain('Fix the auth bug')
  })

  it('includes instructions section', () => {
    const agent = createMockAgent()
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).toContain('## Instructions')
    expect(prompt).toContain('Complete the task')
  })

  it('omits capabilities section when empty', () => {
    const agent = createMockAgent({ capabilities: [] })
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).not.toContain('## Capabilities')
  })

  it('omits specialties section when empty', () => {
    const agent = createMockAgent({ specialties: [] })
    const task = createMockTask()
    const prompt = buildAgentPrompt(agent, task)

    expect(prompt).not.toContain('## Specialties')
  })
})
