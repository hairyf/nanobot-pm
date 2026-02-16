import type { QueryOption } from '../../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { UserQueryManager } from '../../../src/task/user-query'
import { createMockTask } from '../../helpers'

describe('userQueryManager', () => {
  let queryManager: UserQueryManager
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() })
    queryManager = new UserQueryManager(storage)
  })

  describe('createQuery', () => {
    it('creates a UserQuery with question and options', async () => {
      const task = createMockTask({ id: 'task-1', type: 'inquiry' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Option A', value: 'a' },
        { id: 'opt-2', label: 'Option B', value: 'b' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Which option do you prefer?',
        options,
      })

      expect(query.id).toBeDefined()
      expect(query.taskId).toBe(task.id)
      expect(query.question).toBe('Which option do you prefer?')
      expect(query.options).toEqual(options)
      expect(query.waitIndefinitely).toBe(true)
      expect(query.reminderInterval).toBe(86400000)
      expect(query.createdAt).toBeGreaterThan(0)
      expect(query.metadata).toEqual({})
      expect(query.response).toBeUndefined()
      expect(query.selectedOption).toBeUndefined()
      expect(query.respondedAt).toBeUndefined()
    })

    it('creates a UserQuery with context and metadata', async () => {
      const task = createMockTask({ id: 'task-2' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Yes', value: true },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Proceed?',
        context: 'This will delete all data',
        options,
        metadata: { source: 'test' },
      })

      expect(query.context).toBe('This will delete all data')
      expect(query.metadata).toEqual({ source: 'test' })
    })

    it('validates that at least 1 option is required', async () => {
      const task = createMockTask({ id: 'task-3' })

      await expect(
        queryManager.createQuery({
          taskId: task.id,
          question: 'No options?',
          options: [],
        }),
      ).rejects.toThrow(/at least 1 option/i)
    })

    it('stores the query in unstorage', async () => {
      const task = createMockTask({ id: 'task-4' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'A', value: 'a' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Test?',
        options,
      })

      const stored = await queryManager.getQuery(query.id)
      expect(stored).toBeDefined()
      expect(stored?.id).toBe(query.id)
      expect(stored?.taskId).toBe(task.id)
    })
  })

  describe('getQuery', () => {
    it('retrieves a query by id', async () => {
      const task = createMockTask({ id: 'task-5' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Option', value: 'val' },
      ]

      const created = await queryManager.createQuery({
        taskId: task.id,
        question: 'Test question',
        options,
      })

      const retrieved = await queryManager.getQuery(created.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.question).toBe('Test question')
    })

    it('returns undefined for non-existent query', async () => {
      const retrieved = await queryManager.getQuery('non-existent-id')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('getQueryByTask', () => {
    it('retrieves query by taskId', async () => {
      const task = createMockTask({ id: 'task-6' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'A', value: 'a' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Which?',
        options,
      })

      const retrieved = await queryManager.getQueryByTask(task.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(query.id)
      expect(retrieved?.taskId).toBe(task.id)
    })

    it('returns undefined when no query exists for task', async () => {
      const retrieved = await queryManager.getQueryByTask('no-query-task')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('submitResponse', () => {
    it('processes user response and sets selectedOption and respondedAt', async () => {
      const task = createMockTask({ id: 'task-7' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Option A', value: 'a' },
        { id: 'opt-2', label: 'Option B', value: 'b' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Choose one',
        options,
      })

      const beforeTime = Date.now()
      const updated = await queryManager.submitResponse(query.id, 'opt-1')
      const afterTime = Date.now()

      expect(updated.selectedOption).toBe('opt-1')
      expect(updated.respondedAt).toBeDefined()
      expect(updated.respondedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(updated.respondedAt).toBeLessThanOrEqual(afterTime)
      expect(updated.response).toBeUndefined() // response is optional
    })

    it('rejects invalid responses (option not in list)', async () => {
      const task = createMockTask({ id: 'task-8' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'A', value: 'a' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Choose',
        options,
      })

      await expect(
        queryManager.submitResponse(query.id, 'invalid-option-id'),
      ).rejects.toThrow(/invalid option/i)
    })

    it('allows setting optional response text', async () => {
      const task = createMockTask({ id: 'task-9' })
      const options: QueryOption[] = [
        { id: 'opt-1', label: 'Custom', value: 'custom' },
      ]

      const query = await queryManager.createQuery({
        taskId: task.id,
        question: 'Enter custom value',
        options,
      })

      const updated = await queryManager.submitResponse(query.id, 'opt-1', 'Custom response text')

      expect(updated.selectedOption).toBe('opt-1')
      expect(updated.response).toBe('Custom response text')
      expect(updated.respondedAt).toBeDefined()
    })

    it('throws error for non-existent query', async () => {
      await expect(
        queryManager.submitResponse('non-existent-id', 'opt-1'),
      ).rejects.toThrow(/not found/i)
    })
  })
})
