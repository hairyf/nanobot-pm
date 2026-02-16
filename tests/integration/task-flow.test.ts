import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseAppConfig } from '../../src/config/schema'
import { Orchestrator } from '../../src/orchestrator'
import { createMockAgent } from '../helpers'

describe('task flow integration', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    const config = parseAppConfig({})
    orchestrator = new Orchestrator({ config, storage })

    const agent = createMockAgent({
      id: 'dev-1',
      capabilities: ['coding', 'testing'],
      specialties: ['typescript'],
    })
    orchestrator.registry.register(agent)
  })

  it('submits a task and delegates to external agent (stays running)', async () => {
    const taskId = await orchestrator.submitTask('Write typescript code')

    await new Promise(resolve => setTimeout(resolve, 50))

    const task = await orchestrator.taskManager.getTask(taskId)
    expect(task).toBeDefined()
    expect(task?.status).toBe('running')
  })

  it('stores prompt and delegated flag in task metadata', async () => {
    const taskId = await orchestrator.submitTask('Write typescript code')

    await new Promise(resolve => setTimeout(resolve, 50))

    const task = await orchestrator.taskManager.getTask(taskId)
    expect(task?.metadata?.delegated).toBe(true)
    expect(task?.metadata?.prompt).toBeDefined()
    expect(task?.metadata?.prompt).toContain('Write typescript code')
  })

  it('creates task with correct type classification', async () => {
    const taskId = await orchestrator.submitTask('Choose between MySQL or PostgreSQL')
    const task = await orchestrator.taskManager.getTask(taskId)
    expect(task?.type).toBe('inquiry')
  })
})
