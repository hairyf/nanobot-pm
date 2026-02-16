import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore } from '../../../src/storage/history'
import { TaskStore } from '../../../src/storage/task'
import { TaskManager } from '../../../src/task/manager'

describe('taskManager - Circular Dependency Detection (T056)', () => {
  let manager: TaskManager
  let taskStore: TaskStore
  let historyStore: HistoryStore

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    taskStore = new TaskStore(storage)
    historyStore = new HistoryStore(storage)
    manager = new TaskManager(taskStore, historyStore)
  })

  describe('hasCircularDependency', () => {
    it('detects direct circular dependency (A→B→A)', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'Task B' })

      // Attempt to create circular dependency: B → A
      const hasCircular = await manager.hasCircularDependency(taskA.id, [taskB.id])
      expect(hasCircular).toBe(true)
    })

    it('detects indirect circular dependency (A→B→C→A)', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'Task B' })
      const taskC = await manager.createChildTask(taskB.id, { description: 'Task C' })

      // Check if creating C → A would create a cycle
      const hasCircular = await manager.hasCircularDependency(taskA.id, [taskC.id, taskB.id])
      expect(hasCircular).toBe(true)
    })

    it('allows valid task chains without cycles', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'Task B' })
      const taskC = await manager.createChildTask(taskB.id, { description: 'Task C' })

      // Check if creating a new child of C would create a cycle (should not)
      const hasCircular = await manager.hasCircularDependency(taskC.id, [])
      expect(hasCircular).toBe(false)
    })

    it('prevents creating child that would create direct cycle', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'Task B' })

      // Attempting to make B a child of A when A is already parent of B should fail
      const hasCircular = await manager.hasCircularDependency(taskB.id, [taskA.id])
      expect(hasCircular).toBe(true)
    })

    it('prevents creating child that would create indirect cycle', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'Task B' })
      const taskC = await manager.createChildTask(taskB.id, { description: 'Task C' })

      // Attempting to make A a child of C (A→B→C→A cycle)
      const hasCircular = await manager.hasCircularDependency(taskC.id, [taskA.id, taskB.id])
      expect(hasCircular).toBe(true)
    })

    it('allows creating sibling tasks without cycles', async () => {
      const parent = await manager.createTask({ description: 'Parent' })
      const child1 = await manager.createChildTask(parent.id, { description: 'Child 1' })
      const child2 = await manager.createChildTask(parent.id, { description: 'Child 2' })

      // Siblings should not create cycles
      const hasCircular1 = await manager.hasCircularDependency(child1.id, [])
      const hasCircular2 = await manager.hasCircularDependency(child2.id, [])

      expect(hasCircular1).toBe(false)
      expect(hasCircular2).toBe(false)
    })

    it('enforces max depth of 10 when checking dependencies', async () => {
      let currentTask = await manager.createTask({ description: 'Root', depth: 0 })

      // Create chain up to depth 10
      for (let i = 1; i <= 10; i++) {
        currentTask = await manager.createChildTask(currentTask.id, {
          description: `Level ${i}`,
        })
      }

      expect(currentTask.depth).toBe(10)

      // Attempting to create child at depth 11 should fail due to max depth
      await expect(
        manager.createChildTask(currentTask.id, {
          description: 'Depth 11',
        }),
      ).rejects.toThrow(/max depth|depth.*10|exceeds.*depth/i)
    })

    it('detects self-referential cycle (task as its own parent)', async () => {
      const task = await manager.createTask({ description: 'Task' })

      // A task cannot be its own parent
      const hasCircular = await manager.hasCircularDependency(task.id, [task.id])
      expect(hasCircular).toBe(true)
    })

    it('handles complex dependency graph without cycles', async () => {
      // Create: Root → A → B
      //         Root → C → D
      const root = await manager.createTask({ description: 'Root' })
      const taskA = await manager.createChildTask(root.id, { description: 'A' })
      const taskB = await manager.createChildTask(taskA.id, { description: 'B' })
      const taskC = await manager.createChildTask(root.id, { description: 'C' })
      const taskD = await manager.createChildTask(taskC.id, { description: 'D' })

      // No cycles should exist
      expect(await manager.hasCircularDependency(taskB.id, [])).toBe(false)
      expect(await manager.hasCircularDependency(taskD.id, [])).toBe(false)
      expect(await manager.hasCircularDependency(taskA.id, [])).toBe(false)
      expect(await manager.hasCircularDependency(taskC.id, [])).toBe(false)
    })

    it('prevents cycle when attempting to link existing tasks', async () => {
      const taskA = await manager.createTask({ description: 'Task A' })
      const taskB = await manager.createTask({ description: 'Task B' })
      const taskC = await manager.createChildTask(taskB.id, { description: 'Task C' })

      // If we try to make C a child of A, and A a child of C, that's a cycle
      // First check: can A be child of C? (would create A→C→A cycle if C is already child of A)
      // But since A and C are not yet linked, this should be false
      const hasCircularBefore = await manager.hasCircularDependency(taskC.id, [taskA.id])
      expect(hasCircularBefore).toBe(false)

      // Now create A → C
      await manager.createChildTask(taskA.id, { description: 'Task C (duplicate)' })

      // Now if we try to make A a child of C, it should detect the cycle
      // (Actually, we need to check: if C is child of A, can A be child of C? Yes, that's a cycle)
      const taskCFromA = await manager.getChildTasks(taskA.id)
      if (taskCFromA.length > 0) {
        const hasCircularAfter = await manager.hasCircularDependency(taskCFromA[0].id, [taskA.id])
        expect(hasCircularAfter).toBe(true)
      }
    })
  })
})
