import type { TaskAgent } from '../agents/types'
import type { TaskType } from './types'

export function classifyTask(description: string, agents: TaskAgent[]): TaskType {
  const desc = description.toLowerCase()

  // Check for inquiry indicators
  const inquiryKeywords = ['choose', 'select', 'decide', 'which', 'or', '选择', '决定', '哪个', '或']
  if (inquiryKeywords.some(kw => desc.includes(kw))) {
    return 'inquiry'
  }

  // Check how many agents match
  const matchingAgents = agents.filter((agent) => {
    const allTags = [...agent.capabilities, ...agent.specialties].map(s => s.toLowerCase())
    return allTags.some(tag => desc.includes(tag))
  })

  if (matchingAgents.length > 1) {
    // Multiple specialty domains needed
    return 'downstream'
  }

  return 'local'
}
