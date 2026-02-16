import type { Diagnosis, ProblemType } from '../../../src/mediator/types'
import type { Score } from '../../../src/scorer/types'
import type { Task, TaskEvent, TaskHistory } from '../../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { MediatorAnalyzer } from '../../../src/mediator/analyzer'
import { HistoryStore } from '../../../src/storage/history-store'
import { generateUUID } from '../../../src/utils/validator'
import { createMockTask } from '../../helpers'

describe('mediatorAnalyzer', () => {
  let analyzer: MediatorAnalyzer
  let historyStore: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    historyStore = new HistoryStore(storage)
    analyzer = new MediatorAnalyzer(historyStore)
  })

  describe('diagnose', () => {
    it('diagnoses \'loop\' when task has 3+ rejections with same error', async () => {
      const task = createMockTask({ id: 'task-1', assignedAgent: 'agent-1' })
      const history: TaskHistory = {
        taskId: task.id,
        events: [],
        scores: [
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.3,
            feedback: 'Error: timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 3000,
            metadata: {},
          },
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.2,
            feedback: 'Error: timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 2000,
            metadata: {},
          },
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.25,
            feedback: 'Error: timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 1000,
            metadata: {},
          },
        ] as Score[],
        mediations: [],
        statistics: {
          totalDuration: 0,
          executionDuration: 0,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 3,
          mediationCount: 0,
        },
      }

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.problemType).toBe('loop')
      expect(diagnosis.symptoms).toContain('Multiple rejections with same error')
      expect(diagnosis.symptoms.length).toBeGreaterThan(0)
    })

    it('diagnoses \'timeout\' when task duration exceeds limit', async () => {
      const now = Date.now()
      const task = createMockTask({
        id: 'task-2',
        timeout: 5000,
        startedAt: now - 10000,
        createdAt: now - 10000,
      })
      const history: TaskHistory = {
        taskId: task.id,
        events: [
          {
            type: 'started',
            timestamp: task.startedAt!,
          },
        ] as TaskEvent[],
        scores: [],
        mediations: [],
        statistics: {
          totalDuration: 10000,
          executionDuration: 10000,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 0,
          mediationCount: 0,
        },
      }

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.problemType).toBe('timeout')
      expect(diagnosis.symptoms).toContain('Task duration exceeds timeout limit')
      expect(diagnosis.context).toHaveProperty('duration')
      expect(diagnosis.context).toHaveProperty('timeout')
    })

    it('diagnoses \'error\' when task has execution errors', async () => {
      const task = createMockTask({ id: 'task-3' })
      const history: TaskHistory = {
        taskId: task.id,
        events: [
          {
            type: 'failed',
            timestamp: Date.now(),
            error: {
              code: 'EXECUTION_ERROR',
              message: 'Failed to execute task',
              recoverable: true,
            },
          },
        ] as TaskEvent[],
        scores: [],
        mediations: [],
        statistics: {
          totalDuration: 0,
          executionDuration: 0,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 0,
          mediationCount: 0,
        },
      }

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.problemType).toBe('error')
      expect(diagnosis.symptoms).toContain('Task execution failed')
      expect(diagnosis.rootCause).toBeDefined()
    })

    it('diagnoses \'dependency\' when child tasks fail', async () => {
      const task = createMockTask({
        id: 'task-4',
        childTaskIds: ['child-1', 'child-2'],
      })
      const history: TaskHistory = {
        taskId: task.id,
        events: [
          {
            type: 'created',
            timestamp: Date.now(),
            data: {
              description: 'Parent task',
              type: 'local',
            },
          },
        ] as TaskEvent[],
        scores: [],
        mediations: [],
        statistics: {
          totalDuration: 0,
          executionDuration: 0,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 0,
          mediationCount: 0,
        },
      }

      // Store failed child task histories (analyzer will fetch these via historyStore)
      await historyStore.appendEvent('child-1', {
        type: 'failed',
        timestamp: Date.now(),
        error: {
          code: 'CHILD_FAILED',
          message: 'Child task failed',
          recoverable: false,
        },
      } as TaskEvent)

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.problemType).toBe('dependency')
      expect(diagnosis.symptoms).toContain('Child tasks failed')
      expect(diagnosis.context).toHaveProperty('failedChildTasks')
    })

    it('diagnoses \'unknown\' when no pattern matches', async () => {
      const task = createMockTask({ id: 'task-5' })
      const history: TaskHistory = {
        taskId: task.id,
        events: [
          {
            type: 'created',
            timestamp: Date.now(),
            data: {
              description: 'Normal task',
              type: 'local',
            },
          },
        ] as TaskEvent[],
        scores: [],
        mediations: [],
        statistics: {
          totalDuration: 100,
          executionDuration: 100,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 0,
          mediationCount: 0,
        },
      }

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.problemType).toBe('unknown')
      expect(diagnosis.symptoms.length).toBeGreaterThan(0)
    })

    it('symptoms list contains relevant details', async () => {
      const task = createMockTask({ id: 'task-6', assignedAgent: 'agent-1' })
      const history: TaskHistory = {
        taskId: task.id,
        events: [],
        scores: [
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.3,
            feedback: 'Error: network timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 3000,
            metadata: {},
          },
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.2,
            feedback: 'Error: network timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 2000,
            metadata: {},
          },
          {
            id: generateUUID(),
            taskId: task.id,
            result: 'reject',
            confidence: 0.25,
            feedback: 'Error: network timeout',
            criteria: [],
            suggestions: [],
            scorerId: 'scorer-1',
            scorerType: 'rule',
            scoredAt: Date.now() - 1000,
            metadata: {},
          },
        ] as Score[],
        mediations: [],
        statistics: {
          totalDuration: 0,
          executionDuration: 0,
          waitingDuration: 0,
          retryCount: 0,
          scoreCount: 3,
          mediationCount: 0,
        },
      }

      const diagnosis = await analyzer.diagnose(task, history)

      expect(diagnosis.symptoms.length).toBeGreaterThan(0)
      expect(diagnosis.symptoms.some(s => s.includes('reject'))).toBe(true)
      expect(diagnosis.symptoms.some(s => s.includes('network timeout') || s.includes('timeout'))).toBe(true)
    })
  })
})
