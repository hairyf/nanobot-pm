import type { Task } from '../task/types'
import type { TaskAgent } from './types'

/**
 * Build the system prompt: agent identity, capabilities, and framework rules.
 * This tells the AI *who it is* and *how to behave*.
 *
 * @param agent  The agent definition.
 * @param taskId Optional task ID — when provided the prompt includes lifecycle
 *               CLI commands so the agent can signal completion, ask the user,
 *               or dispatch subtasks.
 */
export function buildSystemPrompt(agent: TaskAgent, taskId?: string): string {
  const sections: string[] = []

  sections.push(`# Agent: ${agent.name}`)
  sections.push('')

  if (agent.config.description) {
    sections.push(agent.config.description)
    sections.push('')
  }

  if (agent.capabilities.length > 0) {
    sections.push('## Capabilities')
    sections.push('')
    for (const cap of agent.capabilities) {
      sections.push(`- ${cap}`)
    }
    sections.push('')
  }

  if (agent.specialties.length > 0) {
    sections.push('## Specialties')
    sections.push('')
    for (const spec of agent.specialties) {
      sections.push(`- ${spec}`)
    }
    sections.push('')
  }

  sections.push('## Instructions')
  sections.push('')
  sections.push('Complete the task described below. When finished, **you MUST signal completion** using the lifecycle commands listed here.')
  sections.push('')

  if (taskId) {
    sections.push('### Task Lifecycle Commands')
    sections.push('')
    sections.push(`> Your **Task ID** is \`${taskId}\`. Use it in every command below.`)
    sections.push('')
    sections.push('**When you have completed the task**, run:')
    sections.push('```bash')
    sections.push(`pnpm agentic complete ${taskId} --output "concise summary of what was accomplished"`)
    sections.push('```')
    sections.push('')
    sections.push('**If you need input from the user**, run:')
    sections.push('```bash')
    sections.push(`pnpm agentic wait ${taskId} --question "your question to the user"`)
    sections.push('```')
    sections.push('')
    sections.push('**To dispatch a subtask to another agent**, run:')
    sections.push('```bash')
    sections.push(`pnpm agentic subtask ${taskId} <agentId> "subtask description"`)
    sections.push('```')
    sections.push('')
    sections.push('⚠️ You **must** call one of the above commands before finishing. Do NOT simply stop — the orchestrator tracks your task status.')
    sections.push('')
  }

  return sections.join('\n')
}

/**
 * Build the task prompt: the actual user/upstream work request.
 * This tells the AI *what to do*.
 */
export function buildTaskPrompt(task: Task): string {
  const sections: string[] = []

  sections.push('## Task')
  sections.push('')
  sections.push(`**Type:** ${task.type}`)
  sections.push('')
  sections.push('### Description')
  sections.push('')
  sections.push(task.description)

  return sections.join('\n')
}

/**
 * Build a combined prompt (system + task) for contexts that only accept a single string.
 * @deprecated Prefer `buildSystemPrompt` + `buildTaskPrompt` separately.
 */
export function buildAgentPrompt(agent: TaskAgent, task: Task): string {
  return `${buildSystemPrompt(agent)}\n\n${buildTaskPrompt(task)}`
}
