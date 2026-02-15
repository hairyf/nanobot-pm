import type { AgentRegistry } from '../agents/registry'
import type { TaskAgent } from '../agents/types'
import type { EvaluatorConfig } from '../scorer/evaluator'
import type { TaskManager } from '../task/manager'
import type { Task, TaskResult } from '../task/types'
import { evaluate } from '../scorer/evaluator'

export interface OrchestratorLoopDeps {
  taskManager: TaskManager
  classifyTask: (description: string, agents: TaskAgent[]) => import('../task/types').TaskType
  registry: AgentRegistry
  execute: (task: Task, agent: TaskAgent) => Promise<TaskResult>
  evaluatorConfig: EvaluatorConfig
}

export async function runLoop(taskId: string, deps: OrchestratorLoopDeps): Promise<void> {
  const task = await deps.taskManager.getTask(taskId)
  if (!task)
    throw new Error(`Task not found: ${taskId}`)

  const agents = deps.registry.listAll()
  deps.classifyTask(task.description, agents)

  const keywords = task.description.toLowerCase().split(/\s+/).filter(Boolean)
  const agent = deps.registry.selectBest(keywords)
  if (!agent) {
    await deps.taskManager.transitionStatus(taskId, 'failed')
    return
  }

  await deps.taskManager.transitionStatus(taskId, 'running')

  for (;;) {
    const current = await deps.taskManager.getTask(taskId)
    if (!current)
      break
    const result = await deps.execute(current, agent)
    const score = evaluate(current, result, deps.evaluatorConfig)

    if (score.result === 'pass') {
      await deps.taskManager.transitionStatus(taskId, 'completed')
      return
    }

    if (current.retryCount >= current.maxRetries) {
      await deps.taskManager.transitionStatus(taskId, 'failed')
      return
    }

    await deps.taskManager.incrementRetry(taskId)
  }
}
