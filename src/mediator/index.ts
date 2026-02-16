import type { Storage } from 'unstorage'
import type { HistoryStoreInterface } from '../storage/types'
import type { Task, TaskHistory } from '../task/types'
import type { Mediation, MediationResult } from './types'
import { generateUUID } from '../utils/validator'
import { MediatorAnalyzer } from './analyzer'
import { CBRStore } from './cbr'
import { MediatorResolver } from './resolver'

export { MediatorAnalyzer } from './analyzer'

export class MediationEngine {
  private analyzer: MediatorAnalyzer
  private resolver: MediatorResolver
  private cbrStore: CBRStore

  constructor(historyStore: HistoryStoreInterface, storage: Storage) {
    this.analyzer = new MediatorAnalyzer(historyStore)
    this.resolver = new MediatorResolver()
    this.cbrStore = new CBRStore(storage)
  }

  async triggerMediation(task: Task, history: TaskHistory): Promise<Mediation> {
    // 1. Diagnose the problem using MediatorAnalyzer
    const diagnosis = await this.analyzer.diagnose(task, history)

    // 2. Find similar cases using CBRStore
    const similarCases = await this.cbrStore.findSimilar(diagnosis)

    // 3. Generate solutions using MediatorResolver
    const solutions = this.resolver.generateSolutions(diagnosis, similarCases.length > 0 ? similarCases : task.assignedAgent)

    // 4. Apply the best solution
    const bestSolution = solutions[0]
    if (!bestSolution) {
      throw new Error('No solutions generated for diagnosis')
    }

    const applied = await this.resolver.applySolution(task, bestSolution)

    // Determine result based on solution type and application result
    let result: MediationResult
    if (bestSolution.type === 'escalate') {
      result = 'escalated'
    }
    else if (applied) {
      result = 'success'
    }
    else {
      result = 'failed'
    }

    // 5. Create and return a Mediation record
    const mediation: Mediation = {
      id: generateUUID(),
      taskId: task.id,
      diagnosis,
      solutions,
      appliedSolution: bestSolution,
      result,
      mediatorId: 'mediation-engine',
      mediatorType: similarCases.length > 0 ? 'cbr' : 'rule',
      triggeredAt: Date.now(),
      metadata: {
        similarCasesCount: similarCases.length,
        currentAgentId: task.assignedAgent,
      },
    }

    // 6. Store successful mediation in CBR (only store successful, not escalated)
    if (mediation.result === 'success') {
      mediation.completedAt = Date.now()
      await this.cbrStore.storeCase(mediation)
    }

    return mediation
  }
}

export { CBRStore } from './cbr'
export { MediatorResolver } from './resolver'
export * from './types'
