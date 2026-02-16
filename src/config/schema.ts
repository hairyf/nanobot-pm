import { z } from 'zod'

export const ScorerConfigSchema = z.object({
  /** Agent ID for AI-driven scoring. If set, the scorer agent evaluates task output. */
  agentId: z.string().optional(),
  /** Whether to automatically score tasks when they complete. */
  autoScore: z.boolean().default(false),
  /** Minimum score threshold to consider a task as passed (0-1). */
  scoreThreshold: z.number().min(0).max(1).default(0.8),
})

export const MediatorConfigSchema = z.object({
  triggerThreshold: z.number().default(3),
  enableCBR: z.boolean().default(true),
})

export const StorageConfigSchema = z.object({
  driver: z.enum(['fs', 'redis', 'sqlite']).default('fs'),
  basePath: z.string().default('.agentic/storage'),
})

export const AgentsConfigSchema = z.object({
  directories: z.array(z.string()).default(['.cursor/agents/', '.claude/agents/']),
  autoLoad: z.boolean().default(true),
})

export const OrchestratorConfigSchema = z.object({
  maxConcurrentTasks: z.number().default(5),
  defaultTimeout: z.number().default(1800000),
  maxRetries: z.number().default(3),
  pollInterval: z.number().default(10000),
  maxDepth: z.number().default(10),
  memoryThreshold: z.number().default(500 * 1024 * 1024), // 500MB in bytes
})

export const PlatformSchema = z.enum(['cursor', 'claude'])

export const AppConfigSchema = z.object({
  platform: PlatformSchema.optional(),
  orchestrator: OrchestratorConfigSchema.optional(),
  scorer: ScorerConfigSchema.optional(),
  mediator: MediatorConfigSchema.optional(),
  storage: StorageConfigSchema.optional(),
  agents: AgentsConfigSchema.optional(),
})

export type AppConfigInput = z.input<typeof AppConfigSchema>

export interface AppConfig {
  platform?: z.infer<typeof PlatformSchema>
  orchestrator: z.infer<typeof OrchestratorConfigSchema>
  scorer: z.infer<typeof ScorerConfigSchema>
  mediator: z.infer<typeof MediatorConfigSchema>
  storage: z.infer<typeof StorageConfigSchema>
  agents: z.infer<typeof AgentsConfigSchema>
}

export type ScorerConfig = z.infer<typeof ScorerConfigSchema>
export type MediatorConfig = z.infer<typeof MediatorConfigSchema>
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>

export function parseAppConfig(raw: unknown): AppConfig {
  const parsed = AppConfigSchema.parse(raw ?? {})
  return {
    platform: parsed.platform,
    orchestrator: OrchestratorConfigSchema.parse(parsed.orchestrator ?? {}),
    scorer: ScorerConfigSchema.parse(parsed.scorer ?? {}),
    mediator: MediatorConfigSchema.parse(parsed.mediator ?? {}),
    storage: StorageConfigSchema.parse(parsed.storage ?? {}),
    agents: AgentsConfigSchema.parse(parsed.agents ?? {}),
  }
}

export const defaultConfig: AppConfig = parseAppConfig({})
