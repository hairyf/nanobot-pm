import type { Score } from './types'

export function parseFeedback(score: Score): string[] {
  const items: string[] = []
  if (score.result === 'reject') {
    items.push(`Score rejected: ${score.feedback}`)
    for (const s of score.suggestions) {
      items.push(`  - ${s}`)
    }
  }
  return items
}

export function generateImprovementSuggestions(score: Score): string[] {
  return score.criteria
    .filter(c => !c.passed)
    .map(c => `[${c.name}] ${c.reason} (weight: ${c.weight})`)
}
