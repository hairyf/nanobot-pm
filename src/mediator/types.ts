import { z } from 'zod'

// --- ProblemType ---
export const ProblemTypeSchema = z.enum(['loop', 'timeout', 'error', 'dependency', 'unknown'])
export type ProblemType = z.infer<typeof ProblemTypeSchema>

// --- SolutionType ---
export const SolutionTypeSchema = z.enum(['retry', 'reassign', 'split', 'escalate'])
export type SolutionType = z.infer<typeof SolutionTypeSchema>

// --- MediationResult ---
export const MediationResultSchema = z.enum(['success', 'failed', 'escalated'])
export type MediationResult = z.infer<typeof MediationResultSchema>

// --- Diagnosis ---
export const DiagnosisSchema = z.object({
  problemType: ProblemTypeSchema,
  symptoms: z.array(z.string()),
  rootCause: z.string().optional(),
  context: z.record(z.string(), z.unknown()),
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

// --- Solution ---
export const SolutionSchema = z.object({
  type: SolutionTypeSchema,
  description: z.string(),
  params: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  estimatedImpact: z.string(),
})
export type Solution = z.infer<typeof SolutionSchema>

// --- Mediation ---
export const MediationSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  diagnosis: DiagnosisSchema,
  solutions: z.array(SolutionSchema),
  appliedSolution: SolutionSchema.optional(),
  result: MediationResultSchema,
  outcome: z.string().optional(),
  mediatorId: z.string(),
  mediatorType: z.enum(['cbr', 'rule', 'manual']),
  triggeredAt: z.number(),
  completedAt: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()),
})
export type Mediation = z.infer<typeof MediationSchema>
