import type { Diagnosis, Mediation, Solution } from '../../../src/mediator/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { MediatorResolver } from '../../../src/mediator/resolver'
import { createMockTask } from '../../helpers'

describe('mediatorResolver', () => {
  let resolver: MediatorResolver

  beforeEach(() => {
    resolver = new MediatorResolver()
  })

  describe('generateSolutions', () => {
    it('for \'loop\' diagnosis: suggest reassign (exclude current agent)', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'loop',
        symptoms: ['Multiple rejections with same error'],
        rootCause: 'Agent stuck in rejection loop',
        context: { agentId: 'agent-1', rejectionCount: 3 },
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(0)
      const reassignSolution = solutions.find(s => s.type === 'reassign')
      expect(reassignSolution).toBeDefined()
      expect(reassignSolution?.params).toHaveProperty('excludeAgentId', 'agent-1')
      expect(reassignSolution?.confidence).toBeGreaterThan(0)
    })

    it('for \'timeout\' diagnosis: suggest split into subtasks', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'timeout',
        symptoms: ['Task duration exceeds timeout limit'],
        context: { duration: 10000, timeout: 5000 },
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(0)
      const splitSolution = solutions.find(s => s.type === 'split')
      expect(splitSolution).toBeDefined()
      expect(splitSolution?.description).toContain('split')
      expect(splitSolution?.confidence).toBeGreaterThan(0)
    })

    it('for \'dependency\' diagnosis: suggest escalate to user', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'dependency',
        symptoms: ['Child tasks failed'],
        context: { failedChildTasks: ['child-1'] },
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(0)
      const escalateSolution = solutions.find(s => s.type === 'escalate')
      expect(escalateSolution).toBeDefined()
      expect(escalateSolution?.description).toContain('escalate')
      expect(escalateSolution?.confidence).toBeGreaterThan(0)
    })

    it('for \'error\' diagnosis: suggest retry with different params', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'error',
        symptoms: ['Task execution failed'],
        rootCause: 'Execution error occurred',
        context: { errorCode: 'EXECUTION_ERROR' },
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(0)
      const retrySolution = solutions.find(s => s.type === 'retry')
      expect(retrySolution).toBeDefined()
      expect(retrySolution?.params).toHaveProperty('modifyParams', true)
      expect(retrySolution?.confidence).toBeGreaterThan(0)
    })

    it('solutions sorted by confidence', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'loop',
        symptoms: ['Multiple rejections'],
        context: {},
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(1)
      for (let i = 0; i < solutions.length - 1; i++) {
        expect(solutions[i].confidence).toBeGreaterThanOrEqual(solutions[i + 1].confidence)
      }
    })

    it('generates escalation solution when others fail', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'unknown',
        symptoms: ['Unknown problem pattern'],
        context: {},
      }

      const solutions = await resolver.generateSolutions(diagnosis)

      expect(solutions.length).toBeGreaterThan(0)
      const escalateSolution = solutions.find(s => s.type === 'escalate')
      expect(escalateSolution).toBeDefined()
      expect(escalateSolution?.description).toContain('escalate')
    })

    it('uses similar cases when provided', async () => {
      const diagnosis: Diagnosis = {
        problemType: 'loop',
        symptoms: ['Multiple rejections'],
        context: {},
      }

      const similarCases: Mediation[] = [
        {
          id: 'mediation-1',
          taskId: 'task-1',
          diagnosis: {
            problemType: 'loop',
            symptoms: ['Multiple rejections'],
            context: {},
          },
          solutions: [],
          appliedSolution: {
            type: 'reassign',
            description: 'Reassign worked',
            params: { excludeAgentId: 'agent-1' },
            confidence: 0.9,
            estimatedImpact: 'high',
          },
          result: 'success',
          mediatorId: 'mediator-1',
          mediatorType: 'cbr',
          triggeredAt: Date.now() - 1000,
          completedAt: Date.now(),
          metadata: {},
        },
      ]

      const solutions = await resolver.generateSolutions(diagnosis, similarCases)

      expect(solutions.length).toBeGreaterThan(0)
      // Should prioritize solutions from similar cases
      const reassignSolution = solutions.find(s => s.type === 'reassign')
      expect(reassignSolution).toBeDefined()
    })
  })

  describe('applySolution', () => {
    it('applies reassign solution successfully', async () => {
      const task = createMockTask({ id: 'task-7', assignedAgent: 'agent-1' })
      const solution: Solution = {
        type: 'reassign',
        description: 'Reassign to different agent',
        params: { excludeAgentId: 'agent-1' },
        confidence: 0.8,
        estimatedImpact: 'high',
      }

      const result = await resolver.applySolution(task, solution)

      expect(result).toBe(true)
    })

    it('applies split solution successfully', async () => {
      const task = createMockTask({ id: 'task-8', description: 'Large task to split' })
      const solution: Solution = {
        type: 'split',
        description: 'Split into subtasks',
        params: { maxSubtasks: 3 },
        confidence: 0.7,
        estimatedImpact: 'medium',
      }

      const result = await resolver.applySolution(task, solution)

      expect(result).toBe(true)
    })

    it('applies retry solution successfully', async () => {
      const task = createMockTask({ id: 'task-9', retryCount: 1 })
      const solution: Solution = {
        type: 'retry',
        description: 'Retry with modified parameters',
        params: { modifyParams: true },
        confidence: 0.6,
        estimatedImpact: 'low',
      }

      const result = await resolver.applySolution(task, solution)

      expect(result).toBe(true)
    })

    it('applies escalate solution successfully', async () => {
      const task = createMockTask({ id: 'task-10' })
      const solution: Solution = {
        type: 'escalate',
        description: 'Escalate to user',
        params: {},
        confidence: 0.9,
        estimatedImpact: 'high',
      }

      const result = await resolver.applySolution(task, solution)

      expect(result).toBe(true)
    })
  })
})
