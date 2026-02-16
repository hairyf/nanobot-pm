import { describe, expect, it } from 'vitest'
import { buildAgentScore } from '../../../src/scorer/evaluator'

describe('scoring evaluator', () => {
  it('buildAgentScore creates a pass score with correct defaults', () => {
    const score = buildAgentScore({
      taskId: 'task-1',
      result: 'pass',
      feedback: 'All criteria met',
      scorerId: 'scorer-agent',
    })
    expect(score.result).toBe('pass')
    expect(score.confidence).toBe(1)
    expect(score.scorerType).toBe('agent')
    expect(score.scorerId).toBe('scorer-agent')
    expect(score.feedback).toBe('All criteria met')
    expect(score.criteria).toEqual([])
    expect(score.suggestions).toEqual([])
    expect(score.id).toBeTruthy()
    expect(score.scoredAt).toBeGreaterThan(0)
  })

  it('buildAgentScore creates a reject score with confidence 0', () => {
    const score = buildAgentScore({
      taskId: 'task-2',
      result: 'reject',
      feedback: 'Code quality too low',
      suggestions: ['Add error handling', 'Improve naming'],
      scorerId: 'scorer-agent',
    })
    expect(score.result).toBe('reject')
    expect(score.confidence).toBe(0)
    expect(score.scorerType).toBe('agent')
    expect(score.suggestions).toEqual(['Add error handling', 'Improve naming'])
  })

  it('buildAgentScore allows custom confidence', () => {
    const score = buildAgentScore({
      taskId: 'task-3',
      result: 'pass',
      feedback: 'Mostly good',
      scorerId: 'scorer-agent',
      confidence: 0.85,
    })
    expect(score.confidence).toBe(0.85)
  })

  it('buildAgentScore allows custom metadata', () => {
    const score = buildAgentScore({
      taskId: 'task-4',
      result: 'pass',
      feedback: 'Good',
      scorerId: 'scorer-agent',
      metadata: { reviewedFiles: 3 },
    })
    expect(score.metadata).toEqual({ reviewedFiles: 3 })
  })

  it('buildAgentScore always sets scorerType to agent', () => {
    const score = buildAgentScore({
      taskId: 'task-5',
      result: 'reject',
      feedback: 'Needs work',
      scorerId: 'ai-scorer',
    })
    expect(score.scorerType).toBe('agent')
  })
})
