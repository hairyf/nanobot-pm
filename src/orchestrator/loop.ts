import type { AgentRegistry } from '../agents/registry'
import type { TaskAgent } from '../agents/types'
import type { TaskManager } from '../task/manager'
import type { Task, TaskResult } from '../task/types'

export interface OrchestratorLoopDeps {
  taskManager: TaskManager
  classifyTask: (description: string, agents: TaskAgent[]) => import('../task/types').TaskType
  registry: AgentRegistry
  execute: (task: Task, agent: TaskAgent) => Promise<TaskResult>
  /** If set, tasks transition to waiting_eval after execution; scoring is handled externally by AI Agent */
  scorerAgentId?: string
}

/**
 * Core orchestrator loop: classify → assign → execute → decide.
 *
 * Scoring is NOT performed in-process. If `scorerAgentId` is configured,
 * the task transitions to `waiting_eval` after execution and the Scorer
 * Agent handles evaluation externally via CLI commands (`agentic score`).
 * If no scorer is configured, the task completes or fails based on
 * execution result directly.
 */
export async function runLoop(taskId: string, deps: OrchestratorLoopDeps): Promise<void> {
  const task = await deps.taskManager.getTask(taskId)
  if (!task)
    throw new Error(`Task not found: ${taskId}`)

  const agents = deps.registry.listAll()
  deps.classifyTask(task.description, agents)

  await deps.taskManager.transitionStatus(taskId, 'running')

  const keywords = task.description.toLowerCase().split(/\s+/).filter(Boolean)
  const agent = deps.registry.selectBest(keywords)
  if (!agent) {
    await deps.taskManager.transitionStatus(taskId, 'failed')
    return
  }

  const current = await deps.taskManager.getTask(taskId)
  if (!current)
    return

  const result = await deps.execute(current, agent)

  if (deps.scorerAgentId) {
    // AI Agent scoring: transition to waiting_eval; external Scorer Agent handles the rest
    await deps.taskManager.transitionStatus(taskId, 'waiting_eval')
  }
  else {
    // No scorer configured: decide based on execution result
    if (result.success) {
      await deps.taskManager.transitionStatus(taskId, 'completed')
    }
    else if (current.retryCount >= current.maxRetries) {
      await deps.taskManager.transitionStatus(taskId, 'failed')
    }
    else {
      await deps.taskManager.incrementRetry(taskId)
      // Re-execute (recursive for simplicity; in production use event-driven re-entry)
      await deps.taskManager.transitionStatus(taskId, 'running')
      await runLoop(taskId, deps)
    }
  }
}
