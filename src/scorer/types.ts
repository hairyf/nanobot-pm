import { z } from 'zod'

// --- ScoreResult ---
export const ScoreResultSchema = z.enum(['pass', 'reject'])
export type ScoreResult = z.infer<typeof ScoreResultSchema>

// --- ScoreCriterion ---
export const ScoreCriterionSchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  passed: z.boolean(),
  reason: z.string(),
})
export type ScoreCriterion = z.infer<typeof ScoreCriterionSchema>

// --- Score ---
export const ScoreSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  result: ScoreResultSchema,
  confidence: z.number().min(0).max(1),
  feedback: z.string(),
  criteria: z.array(ScoreCriterionSchema),
  suggestions: z.array(z.string()),
  scorerId: z.string(),
  scorerType: z.literal('agent'),
  scoredAt: z.number(),
  metadata: z.record(z.string(), z.unknown()),
})
export type Score = z.infer<typeof ScoreSchema>
