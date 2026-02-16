import type { Storage } from 'unstorage'
import type { Diagnosis, Mediation } from './types'

const CBR_PREFIX = 'cbr:'
const CBR_INDEX_PREFIX = 'cbr:index:'

export class CBRStore {
  constructor(private storage: Storage) {}

  async storeCase(mediation: Mediation): Promise<void> {
    const caseKey = `${CBR_PREFIX}${mediation.id}`
    await this.storage.setItem(caseKey, mediation)

    const indexKey = `${CBR_INDEX_PREFIX}${mediation.diagnosis.problemType}`
    const index = (await this.storage.getItem<string[]>(indexKey)) || []
    if (!index.includes(mediation.id)) {
      index.push(mediation.id)
      await this.storage.setItem(indexKey, index)
    }
  }

  async findSimilar(diagnosis: Diagnosis | string): Promise<Mediation[]> {
    const problemType = typeof diagnosis === 'string' ? diagnosis : diagnosis.problemType
    const indexKey = `${CBR_INDEX_PREFIX}${problemType}`
    const caseIds = (await this.storage.getItem<string[]>(indexKey)) || []

    const cases = await Promise.all(
      caseIds.map(async (id) => {
        const caseKey = `${CBR_PREFIX}${id}`
        return await this.storage.getItem<Mediation>(caseKey)
      }),
    )

    const validCases = cases.filter((c): c is Mediation => c !== null && c !== undefined)
    return validCases.sort((a, b) => {
      const aConfidence = a.appliedSolution?.confidence ?? 0
      const bConfidence = b.appliedSolution?.confidence ?? 0
      return bConfidence - aConfidence
    })
  }
}
