import { beforeEach, describe, expect, it } from 'vitest'
import { TaskQueue } from '../../../src/task/queue'
import { createMockTask } from '../../helpers'

describe('taskQueue', () => {
  let queue: TaskQueue

  beforeEach(() => {
    queue = new TaskQueue(2)
  })

  it('enqueue adds task to queue', () => {
    const task = createMockTask()
    queue.enqueue(task)
    expect(queue.pendingCount).toBe(1)
  })

  it('dequeue returns task when not full', () => {
    const task = createMockTask()
    queue.enqueue(task)
    const out = queue.dequeue()
    expect(out).toEqual(task)
    expect(queue.pendingCount).toBe(0)
  })

  it('dequeue returns undefined when concurrency limit reached', () => {
    const a = createMockTask()
    const b = createMockTask()
    const c = createMockTask()
    queue.enqueue(a)
    queue.enqueue(b)
    queue.enqueue(c)
    queue.dequeue()
    queue.markRunning(a.id)
    queue.dequeue()
    queue.markRunning(b.id)
    const third = queue.dequeue()
    expect(third).toBeUndefined()
    expect(queue.isFull).toBe(true)
  })

  it('markRunning/markDone manages running set', () => {
    const q = new TaskQueue(1)
    const task = createMockTask()
    q.enqueue(task)
    const t = q.dequeue()!
    q.markRunning(t.id)
    expect(q.runningCount).toBe(1)
    expect(q.isFull).toBe(true)
    q.markDone(t.id)
    expect(q.runningCount).toBe(0)
    expect(q.isFull).toBe(false)
  })

  it('isFull correctly reports capacity', () => {
    expect(queue.isFull).toBe(false)
    const a = createMockTask()
    const b = createMockTask()
    queue.enqueue(a)
    queue.enqueue(b)
    queue.dequeue()
    queue.markRunning(a.id)
    queue.dequeue()
    queue.markRunning(b.id)
    expect(queue.isFull).toBe(true)
  })

  it('pendingCount and runningCount are correct', () => {
    const t1 = createMockTask()
    const t2 = createMockTask()
    queue.enqueue(t1)
    queue.enqueue(t2)
    expect(queue.pendingCount).toBe(2)
    expect(queue.runningCount).toBe(0)
    const out1 = queue.dequeue()!
    queue.markRunning(out1.id)
    expect(queue.pendingCount).toBe(1)
    expect(queue.runningCount).toBe(1)
    queue.markDone(out1.id)
    expect(queue.runningCount).toBe(0)
  })

  it('duplicate enqueue is ignored', () => {
    const task = createMockTask()
    queue.enqueue(task)
    queue.enqueue(task)
    expect(queue.pendingCount).toBe(1)
  })
})
