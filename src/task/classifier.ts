import type { TaskAgent } from '../agents/types'
import type { TaskType } from './types'

export function classifyTask(description: string, agents: TaskAgent[]): TaskType {
  const desc = description.toLowerCase()

  // Check for inquiry indicators (use word-boundary regex for short keywords to avoid substring false-positives)
  const inquiryPatterns = [
    /\bchoose\b/,
    /\bselect\b/,
    /\bdecide\b/,
    /\bwhich\b/,
    /\bor\b/,
    /选择/,
    /决定/,
    /哪个/,
    /或/,
  ]
  if (inquiryPatterns.some(pattern => pattern.test(desc))) {
    return 'inquiry'
  }

  // Check for downstream indicators (complexity heuristics)
  if (agents.length > 1) {
    const downstreamPatterns = [
      /full[-\s]?stack/i,
      /multi[-\s]?(?:component|part|domain|agent)/i,
      /complex/i,
      /(?:build|create|develop|implement)\s+(?:\S.*)?(?:application|system|project|platform)/i,
      /components/i,
    ]
    if (downstreamPatterns.some(pattern => pattern.test(desc))) {
      return 'downstream'
    }
  }

  // Check how many agents match via tag matching
  const matchingAgents = agents.filter((agent) => {
    const allTags = [...agent.capabilities, ...agent.specialties].map(s => s.toLowerCase())
    return allTags.some(tag => desc.includes(tag))
  })

  if (matchingAgents.length > 1) {
    return 'downstream'
  }

  return 'local'
}
