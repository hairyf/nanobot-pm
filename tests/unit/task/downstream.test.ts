import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore } from '../../../src/storage/history-store'
import { TaskStore } from '../../../src/storage/task-store'
import { TaskManager } from '../../../src/task/manager'

describe('taskManager - Downstream Task Creation (T055)', () => {
  let manager: TaskManager
  let taskStore: TaskStore
  let historyStore: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    taskStore = new TaskStore(storage)
    historyStore = new HistoryStore(storage)
    manager = new TaskManager(taskStore, historyStore)
  })

  describe('createChildTask', () => {
    it('creates a child task with correct parentTaskId', async () => {
      const parent = await manager.createTask({ description: 'Parent task', type: 'local' })
      const child = await manager.createChildTask(parent.id, { description: 'Child task', type: 'local' })

      expect(child.parentTaskId).toBe(parent.id)
      expect(child.depth).toBe(parent.depth + 1)
    })

    it('increments depth from parent task', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local', depth: 2 })
      const child = await manager.createChildTask(parent.id, { description: 'Child', type: 'local' })

      expect(child.depth).toBe(3)
      expect(child.depth).toBe(parent.depth + 1)
    })

    it('updates parent task childTaskIds when child is created', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local' })
      const child1 = await manager.createChildTask(parent.id, { description: 'Child 1', type: 'local' })
      const child2 = await manager.createChildTask(parent.id, { description: 'Child 2', type: 'local' })

      const updatedParent = await manager.getTask(parent.id)
      expect(updatedParent?.childTaskIds).toContain(child1.id)
      expect(updatedParent?.childTaskIds).toContain(child2.id)
      expect(updatedParent?.childTaskIds).toHaveLength(2)
    })

    it('tracks depth correctly up to 10 levels', async () => {
      let currentTask = await manager.createTask({ description: 'Root', type: 'local', depth: 0 })

      for (let i = 1; i <= 10; i++) {
        const child = await manager.createChildTask(currentTask.id, {
          description: `Level ${i}`,
          type: 'local',
        })
        expect(child.depth).toBe(i)
        currentTask = child
      }
    })

    it('rejects task creation when depth exceeds 10', async () => {
      const currentTask = await manager.createTask({ description: 'Root', type: 'local', depth: 9 })

      // Create task at depth 10 (should succeed)
      const depth10Task = await manager.createChildTask(currentTask.id, {
        description: 'Depth 10',
        type: 'local',
      })
      expect(depth10Task.depth).toBe(10)

      // Attempting to create child at depth 11 should fail
      await expect(
        manager.createChildTask(depth10Task.id, {
          description: 'Depth 11 - should fail',
          type: 'local',
        }),
      ).rejects.toThrow(/max depth|depth.*10|exceeds.*depth/i)
    })

    it('creates child task with depth 0 when parent has no depth specified', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local' })
      expect(parent.depth).toBe(0)

      const child = await manager.createChildTask(parent.id, { description: 'Child', type: 'local' })
      expect(child.depth).toBe(1)
    })

    it('creates nested child tasks with correct depth progression', async () => {
      const root = await manager.createTask({ description: 'Root', type: 'local' })
      const level1 = await manager.createChildTask(root.id, { description: 'Level 1', type: 'local' })
      const level2 = await manager.createChildTask(level1.id, { description: 'Level 2', type: 'local' })
      const level3 = await manager.createChildTask(level2.id, { description: 'Level 3', type: 'local' })

      expect(root.depth).toBe(0)
      expect(level1.depth).toBe(1)
      expect(level2.depth).toBe(2)
      expect(level3.depth).toBe(3)

      const updatedRoot = await manager.getTask(root.id)
      const updatedLevel1 = await manager.getTask(level1.id)
      const updatedLevel2 = await manager.getTask(level2.id)

      expect(updatedRoot?.childTaskIds).toContain(level1.id)
      expect(updatedLevel1?.childTaskIds).toContain(level2.id)
      expect(updatedLevel2?.childTaskIds).toContain(level3.id)
    })
  })

  describe('getChildTasks', () => {
    it('returns empty array when parent has no children', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local' })
      const children = await manager.getChildTasks(parent.id)

      expect(children).toEqual([])
    })

    it('returns all child tasks for a parent', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local' })
      const child1 = await manager.createChildTask(parent.id, { description: 'Child 1', type: 'local' })
      const child2 = await manager.createChildTask(parent.id, { description: 'Child 2', type: 'local' })
      const child3 = await manager.createChildTask(parent.id, { description: 'Child 3', type: 'local' })

      const children = await manager.getChildTasks(parent.id)

      expect(children).toHaveLength(3)
      expect(children.map(c => c.id)).toContain(child1.id)
      expect(children.map(c => c.id)).toContain(child2.id)
      expect(children.map(c => c.id)).toContain(child3.id)
    })

    it('returns only direct children, not grandchildren', async () => {
      const parent = await manager.createTask({ description: 'Parent', type: 'local' })
      const child = await manager.createChildTask(parent.id, { description: 'Child', type: 'local' })
      const grandchild = await manager.createChildTask(child.id, { description: 'Grandchild', type: 'local' })

      const parentChildren = await manager.getChildTasks(parent.id)
      const childChildren = await manager.getChildTasks(child.id)

      expect(parentChildren).toHaveLength(1)
      expect(parentChildren[0].id).toBe(child.id)
      expect(parentChildren.map(c => c.id)).not.toContain(grandchild.id)

      expect(childChildren).toHaveLength(1)
      expect(childChildren[0].id).toBe(grandchild.id)
    })
  })
})
