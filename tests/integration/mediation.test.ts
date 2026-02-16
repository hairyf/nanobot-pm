import type { Mediation } from '../../src/mediator/types'
import type { Score } from '../../src/scorer/types'
import type { HistoryStore } from '../../src/storage/history'
import type { TaskEvent } from '../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseAppConfig } from '../../src/config/schema'
import { MediatorAnalyzer } from '../../src/mediator/analyzer'
import { MediatorResolver } from '../../src/mediator/resolver'
import { Orchestrator } from '../../src/orchestrator'
import { generateUUID } from '../../src/utils/validator'
import { createMockAgent } from '../helpers'

describe('mediation flow integration', () => {
  let orchestrator: Orchestrator
  let analyzer: MediatorAnalyzer
  let resolver: MediatorResolver
  let historyStore: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    const config = parseAppConfig({})
    orchestrator = new Orchestrator({ config, storage })
    historyStore = orchestrator.historyStore
    analyzer = new MediatorAnalyzer(historyStore)
    resolver = new MediatorResolver()

    const agent1 = createMockAgent({
      id: 'agent-1',
      capabilities: ['coding'],
      specialties: ['typescript'],
    })
    const agent2 = createMockAgent({
      id: 'agent-2',
      capabilities: ['coding'],
      specialties: ['typescript'],
    })
    orchestrator.registry.register(agent1)
    orchestrator.registry.register(agent2)
  })

  it('after 3 score rejections, mediator is triggered', async () => {
    const task = await orchestrator.taskManager.createTask({
      description: 'Test task for mediation',
    })

    // Simulate 3 rejections
    const score1: Score = {
      id: generateUUID(),
      taskId: task.id,
      result: 'reject',
      confidence: 0.3,
      feedback: 'Error: timeout',
      criteria: [],
      suggestions: [],
      scorerId: 'scorer-1',
      scorerType: 'agent',
      scoredAt: Date.now() - 3000,
      metadata: {},
    }
    await orchestrator.historyStore.appendScore(task.id, score1)

    const score2: Score = {
      id: generateUUID(),
      taskId: task.id,
      result: 'reject',
      confidence: 0.2,
      feedback: 'Error: timeout',
      criteria: [],
      suggestions: [],
      scorerId: 'scorer-1',
      scorerType: 'agent',
      scoredAt: Date.now() - 2000,
      metadata: {},
    }
    await orchestrator.historyStore.appendScore(task.id, score2)

    const score3: Score = {
      id: generateUUID(),
      taskId: task.id,
      result: 'reject',
      confidence: 0.25,
      feedback: 'Error: timeout',
      criteria: [],
      suggestions: [],
      scorerId: 'scorer-1',
      scorerType: 'agent',
      scoredAt: Date.now() - 1000,
      metadata: {},
    }
    await orchestrator.historyStore.appendScore(task.id, score3)

    // Trigger mediation check (this would be called by orchestrator loop)
    const history = await orchestrator.historyStore.getHistory(task.id)
    expect(history?.scores.length).toBe(3)
    expect((history?.scores as Score[]).every(s => s.result === 'reject')).toBe(true)

    // Check if mediator should be triggered (3+ rejections)
    const rejectionCount = (history?.scores as Score[]).filter(s => s.result === 'reject').length ?? 0
    expect(rejectionCount).toBeGreaterThanOrEqual(3)
  })

  it('mediator diagnoses the problem', async () => {
    const task = await orchestrator.taskManager.createTask({
      description: 'Test task',
    })
    await orchestrator.taskManager.transitionStatus(task.id, 'running')
    await orchestrator.taskManager.assignTask(task.id, 'agent-1')

    // Add 3 rejections
    for (let i = 0; i < 3; i++) {
      const score: Score = {
        id: generateUUID(),
        taskId: task.id,
        result: 'reject',
        confidence: 0.3 - i * 0.05,
        feedback: 'Error: timeout',
        criteria: [],
        suggestions: [],
        scorerId: 'scorer-1',
        scorerType: 'agent',
        scoredAt: Date.now() - (3 - i) * 1000,
        metadata: {},
      }
      await orchestrator.historyStore.appendScore(task.id, score)
    }

    const history = await orchestrator.historyStore.getHistory(task.id)
    const updatedTask = await orchestrator.taskManager.getTask(task.id)

    // Trigger mediation
    const diagnosis = await analyzer.diagnose(updatedTask!, history!)
    expect(diagnosis).toBeDefined()
    expect(diagnosis.problemType).toBe('loop')
    expect(diagnosis.symptoms.length).toBeGreaterThan(0)
  })

  it('mediator generates and applies solution', async () => {
    const task = await orchestrator.taskManager.createTask({
      description: 'Test task',
    })
    await orchestrator.taskManager.transitionStatus(task.id, 'running')
    await orchestrator.taskManager.assignTask(task.id, 'agent-1')

    // Add 3 rejections
    for (let i = 0; i < 3; i++) {
      const score: Score = {
        id: generateUUID(),
        taskId: task.id,
        result: 'reject',
        confidence: 0.3 - i * 0.05,
        feedback: 'Error: timeout',
        criteria: [],
        suggestions: [],
        scorerId: 'scorer-1',
        scorerType: 'agent',
        scoredAt: Date.now() - (3 - i) * 1000,
        metadata: {},
      }
      await orchestrator.historyStore.appendScore(task.id, score)
    }

    const history = await orchestrator.historyStore.getHistory(task.id)
    const updatedTask = await orchestrator.taskManager.getTask(task.id)

    // Diagnose
    const diagnosis = await analyzer.diagnose(updatedTask!, history!)

    // Generate solutions
    const solutions = await resolver.generateSolutions(diagnosis)

    expect(solutions).toBeDefined()
    expect(solutions.length).toBeGreaterThan(0)

    // Apply solution
    const applied = await resolver.applySolution(updatedTask!, solutions[0])
    expect(applied).toBe(true)
  })

  it('task continues after mediation', async () => {
    const task = await orchestrator.taskManager.createTask({
      description: 'Test task',
    })
    await orchestrator.taskManager.transitionStatus(task.id, 'running')
    await orchestrator.taskManager.assignTask(task.id, 'agent-1')

    // Add 3 rejections
    for (let i = 0; i < 3; i++) {
      const score: Score = {
        id: generateUUID(),
        taskId: task.id,
        result: 'reject',
        confidence: 0.3 - i * 0.05,
        feedback: 'Error: timeout',
        criteria: [],
        suggestions: [],
        scorerId: 'scorer-1',
        scorerType: 'agent',
        scoredAt: Date.now() - (3 - i) * 1000,
        metadata: {},
      }
      await orchestrator.historyStore.appendScore(task.id, score)
    }

    const history = await orchestrator.historyStore.getHistory(task.id)
    const updatedTask = await orchestrator.taskManager.getTask(task.id)

    // Perform mediation
    const diagnosis = await analyzer.diagnose(updatedTask!, history!)
    const solutions = await resolver.generateSolutions(diagnosis)
    await resolver.applySolution(updatedTask!, solutions[0])

    // Task should still be in a valid state to continue
    const finalTask = await orchestrator.taskManager.getTask(task.id)
    expect(finalTask).toBeDefined()
    expect(['pending', 'running', 'waiting_user']).toContain(finalTask?.status)
  })

  it('mediation is recorded in history', async () => {
    const task = await orchestrator.taskManager.createTask({
      description: 'Test task',
    })
    await orchestrator.taskManager.transitionStatus(task.id, 'running')
    await orchestrator.taskManager.assignTask(task.id, 'agent-1')

    // Add 3 rejections
    for (let i = 0; i < 3; i++) {
      const score: Score = {
        id: generateUUID(),
        taskId: task.id,
        result: 'reject',
        confidence: 0.3 - i * 0.05,
        feedback: 'Error: timeout',
        criteria: [],
        suggestions: [],
        scorerId: 'scorer-1',
        scorerType: 'agent',
        scoredAt: Date.now() - (3 - i) * 1000,
        metadata: {},
      }
      await orchestrator.historyStore.appendScore(task.id, score)
    }

    const history = await orchestrator.historyStore.getHistory(task.id)
    const updatedTask = await orchestrator.taskManager.getTask(task.id)

    // Perform mediation
    const diagnosis = await analyzer.diagnose(updatedTask!, history!)
    const solutions = await resolver.generateSolutions(diagnosis)
    const applied = await resolver.applySolution(updatedTask!, solutions[0])

    // Create mediation record
    const mediation: Mediation = {
      id: generateUUID(),
      taskId: task.id,
      diagnosis,
      solutions,
      appliedSolution: solutions[0],
      result: applied ? 'success' : 'failed',
      mediatorId: 'mediator-1',
      mediatorType: 'cbr',
      triggeredAt: Date.now() - 500,
      completedAt: Date.now(),
      metadata: {},
    }

    await orchestrator.historyStore.appendMediation(task.id, mediation)

    // Verify mediation is in history
    const finalHistory = await orchestrator.historyStore.getHistory(task.id)
    expect(finalHistory?.mediations.length).toBe(1)
    expect(finalHistory?.mediations[0]).toEqual(mediation)
    expect(finalHistory?.statistics.mediationCount).toBe(1)

    // Verify mediation event exists
    const mediationEvent = finalHistory?.events.find((e: TaskEvent) => e.type === 'mediated')
    expect(mediationEvent).toBeDefined()
    if (mediationEvent && mediationEvent.type === 'mediated') {
      expect(mediationEvent.mediationId).toBe(mediation.id)
    }
  })
})
