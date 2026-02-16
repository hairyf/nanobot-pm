import type { Diagnosis, Mediation } from '../../../src/mediator/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { CBRStore } from '../../../src/mediator/cbr'
import { generateUUID } from '../../../src/utils/validator'

describe('cBRStore', () => {
  let cbrStore: CBRStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    cbrStore = new CBRStore(storage)
  })

  describe('storeCase', () => {
    it('stores successful mediation as a case', async () => {
      const mediation: Mediation = {
        id: generateUUID(),
        taskId: 'task-1',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [
          {
            type: 'reassign',
            description: 'Reassign to different agent',
            params: { excludeAgentId: 'agent-1' },
            confidence: 0.8,
            estimatedImpact: 'high',
          },
        ],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign to different agent',
          params: { excludeAgentId: 'agent-1' },
          confidence: 0.8,
          estimatedImpact: 'high',
        },
        result: 'success',
        outcome: 'Task completed successfully after reassignment',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 1000,
        completedAt: Date.now(),
        metadata: {},
      }

      await cbrStore.storeCase(mediation)

      const similarCases = await cbrStore.findSimilar(mediation.diagnosis)
      expect(similarCases.length).toBeGreaterThan(0)
      expect(similarCases[0].id).toBe(mediation.id)
    })
  })

  describe('findSimilar', () => {
    it('retrieves similar cases by problem type', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'loop',
        symptoms: ['Multiple rejections with same error'],
        context: { agentId: 'agent-1' },
      }

      const mediation1: Mediation = {
        id: generateUUID(),
        taskId: 'task-1',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign',
          params: {},
          confidence: 0.8,
          estimatedImpact: 'high',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 2000,
        completedAt: Date.now() - 1000,
        metadata: {},
      }

      const mediation2: Mediation = {
        id: generateUUID(),
        taskId: 'task-2',
        diagnosis: {
          problemType: 'timeout',
          symptoms: ['Task timeout'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'split',
          description: 'Split task',
          params: {},
          confidence: 0.7,
          estimatedImpact: 'medium',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 1500,
        completedAt: Date.now() - 500,
        metadata: {},
      }

      await cbrStore.storeCase(mediation1)
      await cbrStore.storeCase(mediation2)

      const similarCases = await cbrStore.findSimilar(diagnosis)

      expect(similarCases.length).toBeGreaterThan(0)
      expect(similarCases.every(c => c.diagnosis.problemType === 'loop')).toBe(true)
    })

    it('no similar cases returns empty array', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'unknown',
        symptoms: ['Unknown pattern'],
        context: {},
      }

      const similarCases = await cbrStore.findSimilar(diagnosis)

      expect(similarCases).toEqual([])
    })

    it('cases with higher confidence ranked first', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'loop',
        symptoms: ['Multiple rejections'],
        context: {},
      }

      const mediation1: Mediation = {
        id: generateUUID(),
        taskId: 'task-1',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign',
          params: {},
          confidence: 0.6,
          estimatedImpact: 'medium',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 3000,
        completedAt: Date.now() - 2000,
        metadata: {},
      }

      const mediation2: Mediation = {
        id: generateUUID(),
        taskId: 'task-2',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign',
          params: {},
          confidence: 0.9,
          estimatedImpact: 'high',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 2000,
        completedAt: Date.now() - 1000,
        metadata: {},
      }

      const mediation3: Mediation = {
        id: generateUUID(),
        taskId: 'task-3',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign',
          params: {},
          confidence: 0.7,
          estimatedImpact: 'medium',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now() - 1000,
        completedAt: Date.now(),
        metadata: {},
      }

      await cbrStore.storeCase(mediation1)
      await cbrStore.storeCase(mediation2)
      await cbrStore.storeCase(mediation3)

      const similarCases = await cbrStore.findSimilar(diagnosis)

      expect(similarCases.length).toBe(3)
      expect(similarCases[0].appliedSolution?.confidence).toBe(0.9)
      expect(similarCases[1].appliedSolution?.confidence).toBe(0.7)
      expect(similarCases[2].appliedSolution?.confidence).toBe(0.6)
    })

    it('cBR storage uses unstorage', async () => {
      const mediation: Mediation = {
        id: generateUUID(),
        taskId: 'task-1',
        diagnosis: {
          problemType: 'loop',
          symptoms: ['Multiple rejections'],
          context: {},
        },
        solutions: [],
        appliedSolution: {
          type: 'reassign',
          description: 'Reassign',
          params: {},
          confidence: 0.8,
          estimatedImpact: 'high',
        },
        result: 'success',
        mediatorId: 'mediator-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now(),
        completedAt: Date.now() + 1000,
        metadata: {},
      }

      await cbrStore.storeCase(mediation)

      // Verify it's persisted by querying the same instance
      const similarCases = await cbrStore.findSimilar(mediation.diagnosis)

      expect(similarCases.length).toBeGreaterThan(0)
      expect(similarCases[0].id).toBe(mediation.id)
    })
  })
})
