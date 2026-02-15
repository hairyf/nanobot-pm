import type { Task, TaskResult } from '../task/types'
import type { TaskAgent } from './types'

export interface ExecuteOptions {
  timeout?: number
}

// In the real system, this would delegate to the actual agent.
// For now, it provides the interface and a basic implementation.
export async function executeTask(agent: TaskAgent, task: Task, _options?: ExecuteOptions): Promise<TaskResult> {
  const startTime = Date.now()

  // This is the in-process execution point.
  // In a real implementation, this would call the agent's execution function.
  // For now, return a placeholder result that tests can mock.
  return {
    taskId: task.id,
    success: true,
    output: { message: `Task executed by ${agent.name}` },
    duration: Date.now() - startTime,
    metadata: { agentId: agent.id },
  }
}
