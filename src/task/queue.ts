import type { Task } from './types'

export class TaskQueue {
  private queue: Task[] = []
  private running: Set<string> = new Set()

  constructor(private maxConcurrent: number = 5) {}

  get pendingCount(): number { return this.queue.length }
  get runningCount(): number { return this.running.size }
  get isFull(): boolean { return this.running.size >= this.maxConcurrent }

  enqueue(task: Task): void {
    if (!this.queue.find(t => t.id === task.id)) {
      this.queue.push(task)
    }
  }

  dequeue(): Task | undefined {
    if (this.isFull)
      return undefined
    return this.queue.shift()
  }

  markRunning(taskId: string): void { this.running.add(taskId) }
  markDone(taskId: string): void { this.running.delete(taskId) }
  isRunning(taskId: string): boolean { return this.running.has(taskId) }
}
