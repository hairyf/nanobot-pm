import type { QueryOption } from '../../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryStore } from '../../../src/storage/history-store'
import { TaskStore } from '../../../src/storage/task-store'
import { TaskManager } from '../../../src/task/manager'
import { UserQueryManager } from '../../../src/task/user-query'

describe('user interaction state transitions', () => {
  let taskManager: TaskManager
  let queryManager: UserQueryManager
  let taskStore: TaskStore
  let historyStore: HistoryStore
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() })
    taskStore = new TaskStore(storage)
    historyStore = new HistoryStore(storage)
    taskManager = new TaskManager(taskStore, historyStore)
    queryManager = new UserQueryManager(storage)
  })

  describe('task transitions from running → waiting_user when query is created', () => {
    it('transitions task to waiting_user when user query is created', async () => {
      const task = await taskManager.createTask({
        description: 'Need user input',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Yes', value: true },
      ]
      await queryManager.createQuery({
        taskId: task.id,
        question: 'Proceed?',
        options,
      })

      // TaskManager should automatically transition to waiting_user
      const updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')
    })

    it('creates user_query event in history when query is created', async () => {
      const task = await taskManager.createTask({
        description: 'Ask user',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'A', value: 'a' },
      ]
      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Which?',
        options,
      })

      const history = await historyStore.getHistory(task.id)
      const userQueryEvent = history?.events.find(e => e.type === 'user_query')
      expect(userQueryEvent).toBeDefined()
      if (userQueryEvent?.type === 'user_query') {
        expect(userQueryEvent.queryId).toBe(query.id)
      }
    })
  })

  describe('task transitions from waiting_user → running when response received', () => {
    it('transitions task back to running when user responds', async () => {
      const task = await taskManager.createTask({
        description: 'Waiting for user',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Continue', value: 'continue' },
      ]
      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Continue?',
        options,
      })

      // Verify it's in waiting_user
      let updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')

      // Submit response
      await queryManager.submitResponse(query.id, 'opt-1')

      // TaskManager should automatically transition back to running
      updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('running')
    })

    it('creates user_response event in history when response is submitted', async () => {
      const task = await taskManager.createTask({
        description: 'Get response',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Yes', value: true },
      ]
      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Proceed?',
        options,
      })

      await queryManager.submitResponse(query.id, 'opt-1')

      const history = await historyStore.getHistory(task.id)
      const responseEvent = history?.events.find(e => e.type === 'user_response')
      expect(responseEvent).toBeDefined()
      if (responseEvent?.type === 'user_response') {
        expect(responseEvent.response).toBe('opt-1')
      }
    })
  })

  describe('task stays in waiting_user indefinitely (no auto-timeout)', () => {
    it('does not timeout tasks in waiting_user state', async () => {
      vi.useFakeTimers()
      const task = await taskManager.createTask({
        description: 'Wait forever',
        type: 'inquiry',
        timeout: 1000, // Short timeout
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Wait', value: 'wait' },
      ]
      await queryManager.createQuery({
        taskId: task.id,
        question: 'Waiting...',
        options,
      })

      // Fast-forward time past timeout
      vi.advanceTimersByTime(2000)

      // Task should still be in waiting_user, not failed
      const updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')

      vi.useRealTimers()
    })
  })

  describe('cancellation works from waiting_user state', () => {
    it('can cancel task from waiting_user state', async () => {
      const task = await taskManager.createTask({
        description: 'Cancel me',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Option', value: 'val' },
      ]
      await queryManager.createQuery({
        taskId: task.id,
        question: 'What?',
        options,
      })

      // Verify waiting_user
      let updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')

      // Cancel
      await taskManager.transitionStatus(task.id, 'cancelled')

      updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('cancelled')
    })
  })

  describe('multiple queries for same task (sequential, not concurrent)', () => {
    it('allows sequential queries for the same task', async () => {
      const task = await taskManager.createTask({
        description: 'Multiple questions',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      // First query
      const options1: QueryOption[] = [
        { id: 'opt-1', label: 'Yes', value: true },
      ]
      const query1 = await queryManager.createQuery({
        taskId: task.id,
        question: 'First question?',
        options: options1,
      })

      let updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')

      // Respond to first query
      await queryManager.submitResponse(query1.id, 'opt-1')
      updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('running')

      // Second query
      const options2: QueryOption[] = [
        { id: 'opt-2', label: 'No', value: false },
      ]
      const query2 = await queryManager.createQuery({
        taskId: task.id,
        question: 'Second question?',
        options: options2,
      })

      updated = await taskManager.getTask(task.id)
      expect(updated?.status).toBe('waiting_user')

      // Verify both queries exist
      const retrieved1 = await queryManager.getQuery(query1.id)
      const retrieved2 = await queryManager.getQuery(query2.id)
      expect(retrieved1).toBeDefined()
      expect(retrieved2).toBeDefined()
      expect(retrieved1?.question).toBe('First question?')
      expect(retrieved2?.question).toBe('Second question?')
    })

    it('prevents concurrent queries for the same task', async () => {
      const task = await taskManager.createTask({
        description: 'No concurrent queries',
        type: 'inquiry',
      })
      await taskManager.transitionStatus(task.id, 'running')

      const options1: QueryOption[] = [
        { id: 'opt-1', label: 'A', value: 'a' },
      ]
      await queryManager.createQuery({
        taskId: task.id,
        question: 'First query',
        options: options1,
      })

      // Attempt to create second query while first is pending
      const options2: QueryOption[] = [
        { id: 'opt-2', label: 'B', value: 'b' },
      ]
      await expect(
        queryManager.createQuery({
          taskId: task.id,
          question: 'Second query',
          options: options2,
        }),
      ).rejects.toThrow(/already has.*pending.*query/i)
    })
  })
})
