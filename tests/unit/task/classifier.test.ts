import type { TaskAgent } from '../../../src/agents/types'
import { describe, expect, it } from 'vitest'
import { classifyTask } from '../../../src/task/classifier'
import { createMockAgent } from '../../helpers'

describe('taskClassifier (classifyTask)', () => {
  const mockAgents: TaskAgent[] = [
    createMockAgent({ id: 'dev-1', name: 'Dev', type: 'developer', capabilities: ['coding', 'testing'], specialties: ['typescript'], status: 'idle' }),
    createMockAgent({ id: 'design-1', name: 'Designer', type: 'designer', capabilities: ['design', 'ui'], specialties: ['css'], status: 'idle' }),
  ]

  it('classifies single-agent task as \'local\'', () => {
    const description = 'Implement typescript module'
    expect(classifyTask(description, mockAgents)).toBe('local')
  })

  it('classifies multi-domain task as \'downstream\' (when multiple agents match different specialties)', () => {
    const description = 'Build typescript frontend with css styling'
    expect(classifyTask(description, mockAgents)).toBe('downstream')
  })

  it('classifies inquiry task (contains decision keywords like \'choose\', \'select\', \'选择\')', () => {
    expect(classifyTask('Choose between A or B', mockAgents)).toBe('inquiry')
    expect(classifyTask('Select the best option', mockAgents)).toBe('inquiry')
    expect(classifyTask('请选择方案', mockAgents)).toBe('inquiry')
  })

  it('does not false-positive on substrings (e.g. "world" should not trigger "or" inquiry)', () => {
    expect(classifyTask('create hello world file', mockAgents)).toBe('local')
    expect(classifyTask('important work on the project', mockAgents)).toBe('local')
    expect(classifyTask('export report to CSV format', mockAgents)).toBe('local')
  })

  it('returns \'local\' for tasks with no matching agents (default)', () => {
    const description = 'do something with haskell and rust'
    const noMatchAgents = [createMockAgent({ capabilities: ['typescript'], specialties: [] })]
    expect(classifyTask(description, noMatchAgents)).toBe('local')
  })
})
