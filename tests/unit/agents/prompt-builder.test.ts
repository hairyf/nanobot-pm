import type { TaskAgent } from '../../../src/agents/types'
import type { Task } from '../../../src/task/types'
import { describe, expect, it } from 'vitest'
import { buildAgentPrompt, buildRetryTaskPrompt, buildScorerSystemPrompt, buildScorerTaskPrompt } from '../../../src/agents/prompt-builder'

function createMockAgent(overrides?: Partial<TaskAgent>): TaskAgent {
  return {
    id: 'developer',
    name: 'developer',
    type: 'developer',
    capabilities: ['coding', 'testing', 'debugging'],
    specialties: ['typescript', 'javascript'],
    status: 'idle',
    config: {
      maxConcurrentTasks: 5,
      timeout: 1800000,
      description: 'A general-purpose developer agent',
      retryStrategy: { maxRetries: 3, backoff: 'linear', initialDelay: 1000, maxDelay: 30000 },
    },
    statistics: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageDuration: 0,
      successRate: 1,
    },
    metadata: {},
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

describe('buildScorerSystemPrompt', () => {
  it('includes scorer role and task ID', () => {
    const agent = createMockAgent({ name: 'scorer' })
    const prompt = buildScorerSystemPrompt(agent, 'task-abc')

    expect(prompt).toContain('# Scorer Agent: scorer')
    expect(prompt).toContain('evaluation agent')
    expect(prompt).toContain('task-abc')
  })

  it('includes scoring commands with pass and reject', () => {
    const agent = createMockAgent()
    const prompt = buildScorerSystemPrompt(agent, 'task-xyz')

    expect(prompt).toContain('pnpm agentic score task-xyz --result pass')
    expect(prompt).toContain('pnpm agentic score task-xyz --result reject')
    expect(prompt).toContain('--feedback')
  })
})

describe('buildScorerTaskPrompt', () => {
  it('includes evaluation context with task and completion output', () => {
    const task = createMockTask({ description: 'Build auth module' })
    const prompt = buildScorerTaskPrompt(task, 'Implemented JWT auth', '/logs/task.log', '/prompts/task.md')

    expect(prompt).toContain('Build auth module')
    expect(prompt).toContain('Implemented JWT auth')
    expect(prompt).toContain('/logs/task.log')
    expect(prompt).toContain('/prompts/task.md')
    expect(prompt).toContain('Evaluation Criteria')
  })
})

describe('buildRetryTaskPrompt', () => {
  it('includes original task and scorer feedback', () => {
    const task = createMockTask({ description: 'Build auth module' })
    const prompt = buildRetryTaskPrompt(task, 'Missing error handling', 'Add try-catch blocks')

    expect(prompt).toContain('Build auth module')
    expect(prompt).toContain('rejected')
    expect(prompt).toContain('Missing error handling')
    expect(prompt).toContain('Add try-catch blocks')
  })

  it('works without suggestions', () => {
    const task = createMockTask({ description: 'Simple task' })
    const prompt = buildRetryTaskPrompt(task, 'Incomplete', '')

    expect(prompt).toContain('Simple task')
    expect(prompt).toContain('Incomplete')
    expect(prompt).not.toContain('Suggestions')
  })
})
