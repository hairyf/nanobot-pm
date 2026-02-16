import type { TaskAgent } from '../../../src/agents/types'
import type { OrchestratorLoopDeps } from '../../../src/orchestrator/loop'
import type { Task, TaskResult } from '../../../src/task/types'

import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistry } from '../../../src/agents/registry'
import { runLoop } from '../../../src/orchestrator/loop'
import { HistoryStore } from '../../../src/storage/history-store'
import { TaskStore } from '../../../src/storage/task-store'
import { TaskManager } from '../../../src/task/manager'
import { createMockAgent } from '../../helpers'

describe('orchestrator main loop', () => {
  let taskStore: TaskStore
  let historyStore: HistoryStore
  let taskManager: TaskManager
  let registry: AgentRegistry
  const mockExecute = vi.fn<
    (task: Task, agent: TaskAgent) => Promise<TaskResult>
  >()
  const mockClassify = vi.fn<(description: string, agents: TaskAgent[]) => import('../../../src/task/types').TaskType>()

  beforeEach(() => {
    vi.mocked(mockExecute).mockReset()
    vi.mocked(mockClassify).mockReset()
    const storage = createStorage({ driver: memoryDriver() })
    taskStore = new TaskStore(storage)
    historyStore = new HistoryStore(storage)
    taskManager = new TaskManager(taskStore, historyStore)
    registry = new AgentRegistry()
  })

  it('task goes through full lifecycle (pending → running → completed) without scorer', async () => {
    const task = await taskManager.createTask({ description: 'coding task', type: 'local' })
    const agent = createMockAgent({ id: 'ag-1', capabilities: ['coding'], specialties: [] })
    registry.register(agent)
    mockClassify.mockReturnValue('local')
    mockExecute.mockResolvedValue({
      taskId: task.id,
      success: true,
      duration: 50,
      metadata: {},
    })
    const deps: OrchestratorLoopDeps = {
      taskManager,
      classifyTask: mockClassify,
      registry,
      execute: mockExecute,
    }
    await runLoop(task.id, deps)
    const updated = await taskManager.getTask(task.id)
    expect(updated?.status).toBe('completed')
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('task transitions to waiting_eval when scorerAgentId is configured', async () => {
    const task = await taskManager.createTask({ description: 'coding with scorer', type: 'local' })
    const agent = createMockAgent({ id: 'ag-1', capabilities: ['coding'], specialties: [] })
    registry.register(agent)
    mockClassify.mockReturnValue('local')
    mockExecute.mockResolvedValue({
      taskId: task.id,
      success: true,
      duration: 50,
      metadata: {},
    })
    const deps: OrchestratorLoopDeps = {
      taskManager,
      classifyTask: mockClassify,
      registry,
      execute: mockExecute,
      scorerAgentId: 'scorer',
    }
    await runLoop(task.id, deps)
    const updated = await taskManager.getTask(task.id)
    expect(updated?.status).toBe('waiting_eval')
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('task fails when execution fails and max retries exceeded', async () => {
    const task = await taskManager.createTask({
      description: 'coding always fail',
      type: 'local',
      maxRetries: 0,
    })
    const agent = createMockAgent({ id: 'ag-1', capabilities: ['coding'], specialties: [] })
    registry.register(agent)
    mockClassify.mockReturnValue('local')
    mockExecute.mockResolvedValue({ taskId: task.id, success: false, duration: 5, metadata: {} })
    const deps: OrchestratorLoopDeps = {
      taskManager,
      classifyTask: mockClassify,
      registry,
      execute: mockExecute,
    }
    await runLoop(task.id, deps)
    const updated = await taskManager.getTask(task.id)
    expect(updated?.status).toBe('failed')
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('task fails when no agent is available', async () => {
    const task = await taskManager.createTask({ description: 'no agent', type: 'local' })
    mockClassify.mockReturnValue('local')
    const deps: OrchestratorLoopDeps = {
      taskManager,
      classifyTask: mockClassify,
      registry,
      execute: mockExecute,
    }
    await runLoop(task.id, deps)
    const updated = await taskManager.getTask(task.id)
    expect(updated?.status).toBe('failed')
    expect(mockExecute).not.toHaveBeenCalled()
  })
})
