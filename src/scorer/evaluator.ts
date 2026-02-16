import type { Score } from './types'
import { generateUUID } from '../utils/validator'

/**
 * Build a Score record from AI Agent evaluation results.
 * This is the only supported scoring method — all evaluation
 * is performed by the Scorer Agent configured via `scorer.agentId`.
 */
export function buildAgentScore(params: {
  taskId: string
  result: 'pass' | 'reject'
  feedback: string
  suggestions?: string[]
  scorerId: string
  confidence?: number
  metadata?: Record<string, unknown>
}): Score {
  return {
    id: generateUUID(),
    taskId: params.taskId,
    result: params.result,
    confidence: params.confidence ?? (params.result === 'pass' ? 1 : 0),
    feedback: params.feedback,
    criteria: [],
    suggestions: params.suggestions ?? [],
    scorerId: params.scorerId,
    scorerType: 'agent',
    scoredAt: Date.now(),
    metadata: params.metadata ?? {},
  }
}
