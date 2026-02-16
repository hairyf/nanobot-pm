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
    sections.push(`pnpm agentic ask ${taskId} --question "your question to the user"`)
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

/**
 * Build system prompt for the scorer agent.
 * Tells the scorer who it is, what to evaluate, and which command to call.
 */
export function buildScorerSystemPrompt(agent: TaskAgent, taskId: string): string {
  const sections: string[] = []

  sections.push(`# Scorer Agent: ${agent.name}`)
  sections.push('')

  if (agent.config.description) {
    sections.push(agent.config.description)
    sections.push('')
  }

  sections.push('## Role')
  sections.push('')
  sections.push('You are an evaluation agent. Your job is to review the work done by another agent and determine whether it meets the task requirements.')
  sections.push('')

  sections.push('## Instructions')
  sections.push('')
  sections.push('1. Read the original task description below')
  sections.push('2. Read the agent\'s completion summary')
  sections.push('3. Review the log file and prompt file (paths provided below) to understand what was actually done')
  sections.push('4. Evaluate quality, correctness, and completeness')
  sections.push('5. Call the scoring command with your verdict')
  sections.push('')

  sections.push('### Scoring Commands')
  sections.push('')
  sections.push(`> Your **Task ID** is \`${taskId}\`. Use it in the commands below.`)
  sections.push('')
  sections.push('**If the work PASSES evaluation**, run:')
  sections.push('```bash')
  sections.push(`pnpm agentic score ${taskId} --result pass --feedback "brief explanation of why it passes"`)
  sections.push('```')
  sections.push('')
  sections.push('**If the work FAILS evaluation**, run:')
  sections.push('```bash')
  sections.push(`pnpm agentic score ${taskId} --result reject --feedback "what needs to be fixed" --suggestions "specific improvement suggestions"`)
  sections.push('```')
  sections.push('')
  sections.push('You **must** call one of the above commands before finishing. Do NOT simply stop.')
  sections.push('')

  return sections.join('\n')
}

/**
 * Build task prompt for the scorer agent with evaluation context.
 */
export function buildScorerTaskPrompt(task: Task, completionOutput: string, logFile: string, promptFile: string): string {
  const sections: string[] = []

  sections.push('## Evaluation Context')
  sections.push('')
  sections.push('### Original Task')
  sections.push('')
  sections.push(`**Type:** ${task.type}`)
  sections.push('')
  sections.push(task.description)
  sections.push('')
  sections.push('### Agent Completion Summary')
  sections.push('')
  sections.push(completionOutput)
  sections.push('')
  sections.push('### Reference Files')
  sections.push('')
  sections.push(`- **Log file**: \`${logFile}\` — contains the agent\'s execution log`)
  sections.push(`- **Prompt file**: \`${promptFile}\` — contains the original prompt sent to the agent`)
  sections.push('')
  sections.push('### Evaluation Criteria')
  sections.push('')
  sections.push('- Does the output satisfy the task description?')
  sections.push('- Is the implementation correct and complete?')
  sections.push('- Are there any obvious errors or omissions?')

  return sections.join('\n')
}

/**
 * Build a retry task prompt that includes scorer feedback for improvement.
 */
export function buildRetryTaskPrompt(task: Task, feedback: string, suggestions: string): string {
  const sections: string[] = []

  sections.push('## Task (Retry)')
  sections.push('')
  sections.push(`**Type:** ${task.type}`)
  sections.push('')
  sections.push('### Description')
  sections.push('')
  sections.push(task.description)
  sections.push('')
  sections.push('### Previous Attempt Feedback')
  sections.push('')
  sections.push('Your previous attempt was evaluated and **rejected**. Please address the following issues:')
  sections.push('')
  sections.push(`**Feedback:** ${feedback}`)
  sections.push('')
  if (suggestions) {
    sections.push(`**Suggestions:** ${suggestions}`)
    sections.push('')
  }
  sections.push('Fix the issues above and complete the task again.')

  return sections.join('\n')
}
