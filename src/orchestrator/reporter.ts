import type { Task } from '../task/types'
import type { ReporterOptions } from './types'

export interface SessionReporterBinding {
  sessionId: string
  taskId: string
  pollInterval: number
  boundAt: number
  lastActiveAt: number
  status: 'active' | 'disconnected' | 'closed'
}

export class SessionReporter {
  private binding: SessionReporterBinding | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private options: ReporterOptions
  private getTask: (taskId: string) => Promise<Task | undefined>

  constructor(options: ReporterOptions, getTask: (taskId: string) => Promise<Task | undefined>) {
    this.options = options
    this.getTask = getTask
  }

  get onProgress() {
    return this.options.onProgress
  }

  set onProgress(fn: (task: Task) => void) {
    this.options.onProgress = fn
  }

  bind(sessionId: string, taskId: string): void {
    const now = Date.now()
    this.binding = {
      sessionId,
      taskId,
      pollInterval: this.options.pollInterval,
      boundAt: now,
      lastActiveAt: now,
      status: 'active',
    }
  }

  start(): void {
    if (!this.binding)
      return
    this.intervalId = setInterval(() => this.tick(), this.binding.pollInterval)
  }

  private async tick(): Promise<void> {
    if (!this.binding)
      return
    const task = await this.getTask(this.binding.taskId)
    if (task) {
      this.binding.lastActiveAt = Date.now()
      this.options.onProgress(task)
    }
  }

  markDisconnected(): void {
    if (this.binding)
      this.binding.status = 'disconnected'
  }

  unbind(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.binding = null
  }

  async complete(task: Task): Promise<void> {
    this.options.onComplete(task)
    this.unbind()
  }

  getBinding(): SessionReporterBinding | null {
    return this.binding
  }
}
