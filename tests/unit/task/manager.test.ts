import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore } from '../../../src/storage/history'
import { TaskStore } from '../../../src/storage/task'
import { TaskManager } from '../../../src/task/manager'

describe('taskManager FSM', () => {
  let manager: TaskManager
  let taskStore: TaskStore
  let historyStore: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    taskStore = new TaskStore(storage)
    historyStore = new HistoryStore(storage)
    manager = new TaskManager(taskStore, historyStore)
  })

  it('creates a task with correct defaults', async () => {
    const task = await manager.createTask({ description: 'Fix bug' })
    expect(task.id).toBeDefined()
    expect(task.description).toBe('Fix bug')
    expect(task.status).toBe('pending')
    expect(task.childTaskIds).toEqual([])
    expect(task.depth).toBe(0)
    expect(task.retryCount).toBe(0)
    expect(task.maxRetries).toBe(3)
    expect(task.timeout).toBe(1800000)
    expect(task.metadata).toEqual({})
    expect(task.tags).toEqual([])
  })

  it('canTransition returns true for valid transitions (pending→running, running→completed, etc.)', () => {
    expect(manager.canTransition('pending', 'running')).toBe(true)
    expect(manager.canTransition('pending', 'cancelled')).toBe(true)
    expect(manager.canTransition('running', 'completed')).toBe(true)
    expect(manager.canTransition('running', 'failed')).toBe(true)
    expect(manager.canTransition('running', 'waiting_user')).toBe(true)
    expect(manager.canTransition('running', 'waiting_eval')).toBe(true)
    expect(manager.canTransition('waiting_user', 'running')).toBe(true)
    expect(manager.canTransition('waiting_eval', 'completed')).toBe(true)
    expect(manager.canTransition('waiting_eval', 'failed')).toBe(true)
    expect(manager.canTransition('waiting_eval', 'running')).toBe(true)
    expect(manager.canTransition('waiting_eval', 'cancelled')).toBe(true)
  })

  it('canTransition returns false for invalid transitions (completed→running, failed→pending)', () => {
    expect(manager.canTransition('completed', 'running')).toBe(false)
    expect(manager.canTransition('failed', 'pending')).toBe(false)
    expect(manager.canTransition('cancelled', 'pending')).toBe(false)
    expect(manager.canTransition('pending', 'completed')).toBe(false)
    expect(manager.canTransition('waiting_eval', 'pending')).toBe(false)
  })

  it('transitionStatus updates task status', async () => {
    const task = await manager.createTask({ description: 'Run' })
    const running = await manager.transitionStatus(task.id, 'running')
    expect(running.status).toBe('running')
    const completed = await manager.transitionStatus(task.id, 'completed')
    expect(completed.status).toBe('completed')
  })

  it('transitionStatus throws for invalid transitions', async () => {
    const task = await manager.createTask({ description: 'Run' })
    await manager.transitionStatus(task.id, 'running')
    await expect(manager.transitionStatus(task.id, 'pending')).rejects.toThrow(/Invalid transition/)
  })

  it('supports full waiting_eval flow (running→waiting_eval→completed or running)', async () => {
    const task = await manager.createTask({ description: 'Eval flow' })
    await manager.transitionStatus(task.id, 'running')
    // Agent completes -> waiting_eval
    const evalTask = await manager.transitionStatus(task.id, 'waiting_eval')
    expect(evalTask.status).toBe('waiting_eval')
    // Scorer passes -> completed
    const completed = await manager.transitionStatus(task.id, 'completed')
    expect(completed.status).toBe('completed')

    // Test reject path: waiting_eval -> running (retry)
    const task2 = await manager.createTask({ description: 'Eval retry' })
    await manager.transitionStatus(task2.id, 'running')
    await manager.transitionStatus(task2.id, 'waiting_eval')
    const retried = await manager.transitionStatus(task2.id, 'running')
    expect(retried.status).toBe('running')
  })

  it('incrementRetry updates retry count and appends event', async () => {
    const task = await manager.createTask({ description: 'Retry me' })
    const updated = await manager.incrementRetry(task.id)
    expect(updated.retryCount).toBe(1)
    const history = await historyStore.getHistory(task.id)
    const retriedEvent = history?.events.find(e => e.type === 'retried')
    expect(retriedEvent).toBeDefined()
    expect(retriedEvent?.type).toBe('retried')
    if (retriedEvent?.type === 'retried') {
      expect(retriedEvent.attempt).toBe(1)
    }
  })
})
