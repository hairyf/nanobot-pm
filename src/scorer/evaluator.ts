import type { Task, TaskResult } from '../task/types'
import type { Score, ScoreCriterion, ScoreResult, ScoringRule } from './types'
import { generateUUID } from '../utils/validator'

export interface EvaluatorConfig {
  scoreThreshold: number
  rules: ScoringRule[]
}

export function evaluate(task: Task, result: TaskResult, config: EvaluatorConfig): Score {
  const criteria: ScoreCriterion[] = config.rules.map(rule => ({
    name: rule.name,
    weight: rule.weight,
    passed: rule.condition(task, result),
    reason: rule.feedback,
  }))

  // Calculate weighted score
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
  const passedWeight = criteria.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0)
  const confidence = totalWeight > 0 ? passedWeight / totalWeight : 1

  const scoreResult: ScoreResult = confidence >= config.scoreThreshold ? 'pass' : 'reject'

  const suggestions = criteria.filter(c => !c.passed).map(c => `Improve: ${c.name} - ${c.reason}`)

  return {
    id: generateUUID(),
    taskId: task.id,
    result: scoreResult,
    confidence,
    feedback: scoreResult === 'pass' ? 'All criteria met' : `Score ${(confidence * 100).toFixed(0)}% below threshold ${(config.scoreThreshold * 100).toFixed(0)}%`,
    criteria,
    suggestions,
    scorerId: 'rule-evaluator',
    scorerType: 'rule',
    scoredAt: Date.now(),
    metadata: {},
  }
}
