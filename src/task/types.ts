import { z } from 'zod'

// --- TaskType & TaskStatus ---
export const TaskTypeSchema = z.enum(['local', 'downstream', 'inquiry'])
export type TaskType = z.infer<typeof TaskTypeSchema>

export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'waiting_user',
  'completed',
  'failed',
  'cancelled',
])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

// --- TaskError ---
export const TaskErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  recoverable: z.boolean(),
})
export type TaskError = z.infer<typeof TaskErrorSchema>

// --- TaskResult ---
export const TaskResultSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  output: z.unknown().optional(),
  error: TaskErrorSchema.optional(),
  duration: z.number(),
  metadata: z.record(z.string(), z.unknown()),
})
export type TaskResult = z.infer<typeof TaskResultSchema>

// --- Task ---
export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  assignedAgent: z.string().optional(),
  agentMetadata: z.record(z.string(), z.unknown()).optional(),
  parentTaskId: z.string().optional(),
  childTaskIds: z.array(z.string()),
  depth: z.number().int().min(0).max(10),
  createdAt: z.number(),
  updatedAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  timeout: z.number().default(1800000),
  maxRetries: z.number().default(3),
  retryCount: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
})
export type Task = z.infer<typeof TaskSchema>

// --- TaskEvent (discriminated union) ---
const CreateTaskDataSchema = z.object({
  description: z.string(),
  type: TaskTypeSchema,
  parentTaskId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type CreateTaskData = z.infer<typeof CreateTaskDataSchema>

const TaskEventCreatedSchema = z.object({
  type: z.literal('created'),
  timestamp: z.number(),
  data: CreateTaskDataSchema,
})
const TaskEventAssignedSchema = z.object({
  type: z.literal('assigned'),
  timestamp: z.number(),
  agentId: z.string(),
})
const TaskEventStartedSchema = z.object({
  type: z.literal('started'),
  timestamp: z.number(),
})
const TaskEventScoredSchema = z.object({
  type: z.literal('scored'),
  timestamp: z.number(),
  scoreId: z.string(),
})
const TaskEventMediatedSchema = z.object({
  type: z.literal('mediated'),
  timestamp: z.number(),
  mediationId: z.string(),
})
const TaskEventUserQuerySchema = z.object({
  type: z.literal('user_query'),
  timestamp: z.number(),
  queryId: z.string(),
})
const TaskEventUserResponseSchema = z.object({
  type: z.literal('user_response'),
  timestamp: z.number(),
  response: z.string(),
})
const TaskEventCompletedSchema = z.object({
  type: z.literal('completed'),
  timestamp: z.number(),
  result: TaskResultSchema,
})
const TaskEventFailedSchema = z.object({
  type: z.literal('failed'),
  timestamp: z.number(),
  error: TaskErrorSchema,
})
const TaskEventCancelledSchema = z.object({
  type: z.literal('cancelled'),
  timestamp: z.number(),
  reason: z.string(),
})
const TaskEventRetriedSchema = z.object({
  type: z.literal('retried'),
  timestamp: z.number(),
  attempt: z.number(),
})
const TaskEventSessionBoundSchema = z.object({
  type: z.literal('session_bound'),
  timestamp: z.number(),
  sessionId: z.string(),
})
const TaskEventSessionDisconnectedSchema = z.object({
  type: z.literal('session_disconnected'),
  timestamp: z.number(),
  sessionId: z.string(),
})
const TaskEventSessionReconnectedSchema = z.object({
  type: z.literal('session_reconnected'),
  timestamp: z.number(),
  sessionId: z.string(),
})

export const TaskEventSchema = z.discriminatedUnion('type', [
  TaskEventCreatedSchema,
  TaskEventAssignedSchema,
  TaskEventStartedSchema,
  TaskEventScoredSchema,
  TaskEventMediatedSchema,
  TaskEventUserQuerySchema,
  TaskEventUserResponseSchema,
  TaskEventCompletedSchema,
  TaskEventFailedSchema,
  TaskEventCancelledSchema,
  TaskEventRetriedSchema,
  TaskEventSessionBoundSchema,
  TaskEventSessionDisconnectedSchema,
  TaskEventSessionReconnectedSchema,
])
export type TaskEvent = z.infer<typeof TaskEventSchema>

// --- TaskStatistics ---
export const TaskStatisticsSchema = z.object({
  totalDuration: z.number(),
  executionDuration: z.number(),
  waitingDuration: z.number(),
  retryCount: z.number(),
  scoreCount: z.number(),
  mediationCount: z.number(),
})
export type TaskStatistics = z.infer<typeof TaskStatisticsSchema>

// --- TaskHistory ---
export const TaskHistorySchema = z.object({
  taskId: z.string(),
  events: z.array(TaskEventSchema),
  scores: z.array(z.unknown()), // Score[] - avoid circular import; use scorer types at runtime
  mediations: z.array(z.unknown()), // Mediation[]
  statistics: TaskStatisticsSchema,
})
export type TaskHistory = z.infer<typeof TaskHistorySchema>

// --- QueryOption ---
export const QueryOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  value: z.unknown(),
})
export type QueryOption = z.infer<typeof QueryOptionSchema>

// --- UserQuery ---
export const UserQuerySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  question: z.string(),
  context: z.string().optional(),
  options: z.array(QueryOptionSchema),
  response: z.string().optional(),
  selectedOption: z.string().optional(),
  respondedAt: z.number().optional(),
  waitIndefinitely: z.literal(true),
  reminderInterval: z.number().default(86400000),
  createdAt: z.number(),
  metadata: z.record(z.string(), z.unknown()),
})
export type UserQuery = z.infer<typeof UserQuerySchema>
