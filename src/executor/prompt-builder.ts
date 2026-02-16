import type { TaskAgent } from '../agents/types'
import type { Task } from '../task/types'

/**
 * Build a prompt for a Cloud Agent from the agent definition and task.
 */
export function buildAgentPrompt(agent: TaskAgent, task: Task): string {
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

  sections.push('## Task')
  sections.push('')
  sections.push(`**Type:** ${task.type}`)
  sections.push('')
  sections.push('### Description')
  sections.push('')
  sections.push(task.description)
  sections.push('')

  sections.push('## Instructions')
  sections.push('')
  sections.push('Complete the task described above. When finished, commit your changes and provide a clear summary of what was accomplished.')

  return sections.join('\n')
}
