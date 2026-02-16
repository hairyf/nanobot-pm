import type { Task } from '../../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { TaskStore } from '../../../src/storage/task'
import { generateUUID } from '../../../src/utils/validator'

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: generateUUID(),
    description: 'Test task',
    status: 'pending',
    childTaskIds: [],
    depth: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timeout: 1800000,
    maxRetries: 3,
    retryCount: 0,
    metadata: {},
    tags: [],
    ...overrides,
  }
}

describe('taskStore', () => {
  let store: TaskStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    store = new TaskStore(storage)
  })

  describe('save and get', () => {
    it('save and get a task', async () => {
      const task = createTestTask({ description: 'My task' })
      await store.save(task)
      const got = await store.get(task.id)
      expect(got).toBeDefined()
      expect(got?.id).toBe(task.id)
      expect(got?.description).toBe('My task')
    })
  })

  describe('list', () => {
    it('returns all tasks', async () => {
      const a = createTestTask({ description: 'A' })
      const b = createTestTask({ description: 'B' })
      await store.save(a)
      await store.save(b)
      const list = await store.list()
      expect(list).toHaveLength(2)
      expect(list.map(t => t.id).sort()).toEqual([a.id, b.id].sort())
    })
  })

  describe('delete', () => {
    it('removes task and cleans indices', async () => {
      const task = createTestTask({ status: 'pending', assignedAgent: 'agent-1', parentTaskId: 'parent-1' })
      await store.save(task)
      await store.delete(task.id)
      const got = await store.get(task.id)
      expect(got).toBeUndefined()
      const byStatus = await store.getByStatus('pending')
      expect(byStatus.find(t => t.id === task.id)).toBeUndefined()
      const byAgent = await store.getByAgent('agent-1')
      expect(byAgent.find(t => t.id === task.id)).toBeUndefined()
      const byParent = await store.getByParent('parent-1')
      expect(byParent.find(t => t.id === task.id)).toBeUndefined()
    })
  })

  describe('updateStatus', () => {
    it('changes status and updates indices', async () => {
      const task = createTestTask({ status: 'pending' })
      await store.save(task)
      await store.updateStatus(task.id, 'running')
      const got = await store.get(task.id)
      expect(got?.status).toBe('running')
      const pending = await store.getByStatus('pending')
      expect(pending.find(t => t.id === task.id)).toBeUndefined()
      const running = await store.getByStatus('running')
      expect(running.find(t => t.id === task.id)).toBeDefined()
    })
  })

  describe('getByStatus', () => {
    it('returns correct tasks', async () => {
      const p1 = createTestTask({ status: 'pending' })
      const p2 = createTestTask({ status: 'pending' })
      const r1 = createTestTask({ status: 'running' })
      await store.save(p1)
      await store.save(p2)
      await store.save(r1)
      const pending = await store.getByStatus('pending')
      expect(pending).toHaveLength(2)
      expect(pending.map(t => t.id).sort()).toEqual([p1.id, p2.id].sort())
      const running = await store.getByStatus('running')
      expect(running).toHaveLength(1)
      expect(running[0].id).toBe(r1.id)
    })
  })

  describe('getByAgent', () => {
    it('returns correct tasks', async () => {
      const a1 = createTestTask({ assignedAgent: 'agent-x' })
      const a2 = createTestTask({ assignedAgent: 'agent-x' })
      const b1 = createTestTask({ assignedAgent: 'agent-y' })
      await store.save(a1)
      await store.save(a2)
      await store.save(b1)
      const byX = await store.getByAgent('agent-x')
      expect(byX).toHaveLength(2)
      expect(byX.map(t => t.id).sort()).toEqual([a1.id, a2.id].sort())
      const byY = await store.getByAgent('agent-y')
      expect(byY).toHaveLength(1)
      expect(byY[0].id).toBe(b1.id)
    })
  })

  describe('getByParent', () => {
    it('returns correct tasks', async () => {
      const parentId = 'parent-1'
      const c1 = createTestTask({ parentTaskId: parentId })
      const c2 = createTestTask({ parentTaskId: parentId })
      const other = createTestTask({ parentTaskId: 'other' })
      await store.save(c1)
      await store.save(c2)
      await store.save(other)
      const children = await store.getByParent(parentId)
      expect(children).toHaveLength(2)
      expect(children.map(t => t.id).sort()).toEqual([c1.id, c2.id].sort())
    })
  })
})
