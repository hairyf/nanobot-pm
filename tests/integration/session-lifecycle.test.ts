import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseAppConfig } from '../../src/config/schema'
import { Orchestrator } from '../../src/orchestrator'
import { generateUUID } from '../../src/utils/validator'
import { createMockAgent } from '../helpers'

describe('session lifecycle integration', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    const config = parseAppConfig({})
    orchestrator = new Orchestrator({ config, storage })
    orchestrator.registry.register(createMockAgent({ id: 'dev-1', capabilities: ['coding'] }))
  })

  it('binds session to task and reports progress', async () => {
    const taskId = await orchestrator.submitTask('Write coding task')
    const reporter = orchestrator.createReporter(1000)
    const sessionId = generateUUID()

    reporter.bind(sessionId, taskId)

    expect(reporter.getBinding()).toBeDefined()
    expect(reporter.getBinding()?.sessionId).toBe(sessionId)
    expect(reporter.getBinding()?.taskId).toBe(taskId)
  })

  it('session disconnect does not stop task', async () => {
    const taskId = await orchestrator.submitTask('Write coding task')
    const reporter = orchestrator.createReporter()
    reporter.bind(generateUUID(), taskId)

    reporter.markDisconnected()
    expect(reporter.getBinding()?.status).toBe('disconnected')

    await new Promise(resolve => setTimeout(resolve, 50))
    const task = await orchestrator.taskManager.getTask(taskId)
    expect(task).toBeDefined()
  })
})
