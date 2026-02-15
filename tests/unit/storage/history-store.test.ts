import type { Mediation } from '../../../src/mediator/types'
import type { Score } from '../../../src/scorer/types'
import type { TaskEvent } from '../../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore } from '../../../src/storage/history-store'
import { generateUUID } from '../../../src/utils/validator'

describe('historyStore', () => {
  let store: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    store = new HistoryStore(storage)
  })

  describe('appendEvent', () => {
    it('creates history and appends event', async () => {
      const taskId = generateUUID()
      const event: TaskEvent = {
        type: 'created',
        timestamp: Date.now(),
        data: { description: 'New task', type: 'local' },
      }
      await store.appendEvent(taskId, event)
      const history = await store.getHistory(taskId)
      expect(history).toBeDefined()
      expect(history?.taskId).toBe(taskId)
      expect(history?.events).toHaveLength(1)
      expect(history?.events[0]).toEqual(event)
    })

    it('appends to existing history', async () => {
      const taskId = generateUUID()
      const e1: TaskEvent = { type: 'started', timestamp: Date.now() }
      const e2: TaskEvent = { type: 'completed', timestamp: Date.now(), result: { taskId, success: true, duration: 100, metadata: {} } }
      await store.appendEvent(taskId, e1)
      await store.appendEvent(taskId, e2)
      const history = await store.getHistory(taskId)
      expect(history?.events).toHaveLength(2)
      expect(history?.events[0]).toEqual(e1)
      expect(history?.events[1]).toEqual(e2)
    })
  })

  describe('getHistory', () => {
    it('returns stored history', async () => {
      const taskId = generateUUID()
      const event: TaskEvent = { type: 'assigned', timestamp: Date.now(), agentId: 'agent-1' }
      await store.appendEvent(taskId, event)
      const history = await store.getHistory(taskId)
      expect(history?.taskId).toBe(taskId)
      expect(history?.events[0]).toEqual(event)
      expect(history?.scores).toEqual([])
      expect(history?.mediations).toEqual([])
    })

    it('returns undefined for non-existent task', async () => {
      const history = await store.getHistory('non-existent-id')
      expect(history).toBeUndefined()
    })
  })

  describe('getStatistics', () => {
    it('returns statistics from history', async () => {
      const taskId = generateUUID()
      await store.appendEvent(taskId, { type: 'started', timestamp: Date.now() })
      const stats = await store.getStatistics(taskId)
      expect(stats).toBeDefined()
      expect(stats?.totalDuration).toBe(0)
      expect(stats?.executionDuration).toBe(0)
      expect(stats?.waitingDuration).toBe(0)
      expect(stats?.retryCount).toBe(0)
      expect(stats?.scoreCount).toBe(0)
      expect(stats?.mediationCount).toBe(0)
    })
  })

  describe('appendScore', () => {
    it('adds score and updates scoreCount', async () => {
      const taskId = generateUUID()
      const score: Score = {
        id: generateUUID(),
        taskId,
        result: 'pass',
        confidence: 0.9,
        feedback: 'Good',
        criteria: [],
        suggestions: [],
        scorerId: 'scorer-1',
        scorerType: 'rule',
        scoredAt: Date.now(),
        metadata: {},
      }
      await store.appendScore(taskId, score)
      const history = await store.getHistory(taskId)
      expect(history?.scores).toHaveLength(1)
      expect(history?.scores[0]).toEqual(score)
      expect(history?.statistics.scoreCount).toBe(1)
      const score2: Score = { ...score, id: generateUUID() }
      await store.appendScore(taskId, score2)
      const history2 = await store.getHistory(taskId)
      expect(history2?.scores).toHaveLength(2)
      expect(history2?.statistics.scoreCount).toBe(2)
    })
  })

  describe('appendMediation', () => {
    it('adds mediation and updates mediationCount', async () => {
      const taskId = generateUUID()
      const mediation: Mediation = {
        id: generateUUID(),
        taskId,
        diagnosis: { problemType: 'timeout', symptoms: ['slow'], context: {} },
        solutions: [{ type: 'retry', description: 'Retry', params: {}, confidence: 0.8, estimatedImpact: 'low' }],
        result: 'success',
        mediatorId: 'med-1',
        mediatorType: 'cbr',
        triggeredAt: Date.now(),
        metadata: {},
      }
      await store.appendMediation(taskId, mediation)
      const history = await store.getHistory(taskId)
      expect(history?.mediations).toHaveLength(1)
      expect(history?.mediations[0]).toEqual(mediation)
      expect(history?.statistics.mediationCount).toBe(1)
      const mediation2: Mediation = { ...mediation, id: generateUUID() }
      await store.appendMediation(taskId, mediation2)
      const history2 = await store.getHistory(taskId)
      expect(history2?.mediations).toHaveLength(2)
      expect(history2?.statistics.mediationCount).toBe(2)
    })
  })
})
