import type { AgentExecutor, ExecutionHandle, ExecutionResult, ExecutionStatus, LaunchOptions } from './types'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'pathe'

export interface MockExecution {
  executionId: string
  prompt: string
  options?: LaunchOptions
  status: ExecutionStatus
  summary?: string
}

interface MockState {
  counter: number
  executions: Record<string, MockExecution>
}

/**
 * Mock executor for testing and local development.
 * Supports optional file-based persistence for cross-process state sharing.
 */
export class MockExecutor implements AgentExecutor {
  public executions: Map<string, MockExecution> = new Map()
  private counter = 0
  private autoFinish: boolean
  private statePath?: string

  constructor(options?: { autoFinish?: boolean, statePath?: string }) {
    this.autoFinish = options?.autoFinish ?? true
    this.statePath = options?.statePath
    if (this.statePath) {
      this.loadState()
    }
  }

  private loadState(): void {
    if (!this.statePath)
      return
    try {
      const raw = readFileSync(this.statePath, 'utf-8')
      const state: MockState = JSON.parse(raw)
      this.counter = state.counter
      this.executions = new Map(Object.entries(state.executions))
    }
    catch {
      // File doesn't exist yet
    }
  }

  private saveState(): void {
    if (!this.statePath)
      return
    const state: MockState = {
      counter: this.counter,
      executions: Object.fromEntries(this.executions),
    }
    mkdirSync(dirname(this.statePath), { recursive: true })
    writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  async launch(prompt: string, options?: LaunchOptions): Promise<ExecutionHandle> {
    const executionId = `mock_${++this.counter}`
    const execution: MockExecution = {
      executionId,
      prompt,
      options,
      status: this.autoFinish ? 'finished' : 'running',
      summary: this.autoFinish ? `Mock execution completed: ${prompt.slice(0, 100)}` : undefined,
    }
    this.executions.set(executionId, execution)
    this.saveState()
    return { executionId, url: `https://mock.executor/${executionId}` }
  }

  async getStatus(executionId: string): Promise<ExecutionResult> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      return { status: 'error', summary: `Execution not found: ${executionId}` }
    }
    return {
      status: execution.status,
      summary: execution.summary,
    }
  }

  async stop(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId)
    if (execution) {
      execution.status = 'stopped'
      this.saveState()
    }
  }

  /** Manually transition an execution's status (for testing) */
  setStatus(executionId: string, status: ExecutionStatus, summary?: string): void {
    const execution = this.executions.get(executionId)
    if (execution) {
      execution.status = status
      if (summary !== undefined) {
        execution.summary = summary
      }
      this.saveState()
    }
  }
}
