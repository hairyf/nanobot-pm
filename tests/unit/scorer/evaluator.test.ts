import type { EvaluatorConfig } from '../../../src/scorer/evaluator'
import type { ScoringRule } from '../../../src/scorer/types'
import type { TaskResult } from '../../../src/task/types'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../../src/scorer/evaluator'
import { createMockTask } from '../../helpers'

function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    taskId: 'task-1',
    success: true,
    duration: 100,
    metadata: {},
    ...overrides,
  }
}

describe('scoring evaluator', () => {
  it('evaluate returns \'pass\' when all rules pass', () => {
    const task = createMockTask({ id: 'task-1' })
    const result = makeResult()
    const rules: ScoringRule[] = [
      { name: 'R1', weight: 0.5, condition: () => true, score: 'pass', feedback: 'OK' },
      { name: 'R2', weight: 0.5, condition: () => true, score: 'pass', feedback: 'OK' },
    ]
    const config: EvaluatorConfig = { scoreThreshold: 0.5, rules }
    const score = evaluate(task, result, config)
    expect(score.result).toBe('pass')
    expect(score.confidence).toBe(1)
  })

  it('evaluate returns \'reject\' when score below threshold', () => {
    const task = createMockTask({ id: 'task-1' })
    const result = makeResult()
    const rules: ScoringRule[] = [
      { name: 'R1', weight: 0.5, condition: () => true, score: 'pass', feedback: 'OK' },
      { name: 'R2', weight: 0.5, condition: () => false, score: 'reject', feedback: 'Failed' },
    ]
    const config: EvaluatorConfig = { scoreThreshold: 0.8, rules }
    const score = evaluate(task, result, config)
    expect(score.result).toBe('reject')
    expect(score.confidence).toBe(0.5)
  })

  it('evaluate handles empty rules (default pass)', () => {
    const task = createMockTask({ id: 'task-1' })
    const result = makeResult()
    const config: EvaluatorConfig = { scoreThreshold: 0.5, rules: [] }
    const score = evaluate(task, result, config)
    expect(score.result).toBe('pass')
    expect(score.confidence).toBe(1)
  })

  it('evaluate generates improvement suggestions for failed criteria', () => {
    const task = createMockTask({ id: 'task-1' })
    const result = makeResult()
    const rules: ScoringRule[] = [
      { name: 'Quality', weight: 0.5, condition: () => false, score: 'reject', feedback: 'Low quality' },
      { name: 'Speed', weight: 0.5, condition: () => true, score: 'pass', feedback: 'OK' },
    ]
    const config: EvaluatorConfig = { scoreThreshold: 1, rules }
    const score = evaluate(task, result, config)
    expect(score.suggestions).toContainEqual(expect.stringContaining('Quality'))
    expect(score.suggestions).toContainEqual(expect.stringContaining('Low quality'))
  })

  it('evaluate calculates correct confidence from weighted criteria', () => {
    const task = createMockTask({ id: 'task-1' })
    const result = makeResult()
    const rules: ScoringRule[] = [
      { name: 'R1', weight: 0.7, condition: () => true, score: 'pass', feedback: 'OK' },
      { name: 'R2', weight: 0.3, condition: () => false, score: 'reject', feedback: 'No' },
    ]
    const config: EvaluatorConfig = { scoreThreshold: 0.5, rules }
    const score = evaluate(task, result, config)
    expect(score.confidence).toBe(0.7)
  })
})
