import { describe, expect, it } from 'vitest'
import { MockExecutor } from '../../../src/executor/mock'

describe('mockExecutor', () => {
  it('launches with auto-finish and returns finished status', async () => {
    const executor = new MockExecutor({ autoFinish: true })
    const handle = await executor.launch('Test prompt')

    expect(handle.executionId).toMatch(/^mock_/)
    expect(handle.url).toBeDefined()

    const status = await executor.getStatus(handle.executionId)
    expect(status.status).toBe('finished')
    expect(status.summary).toContain('Test prompt')
  })

  it('launches without auto-finish and stays running', async () => {
    const executor = new MockExecutor({ autoFinish: false })
    const handle = await executor.launch('Test prompt')

    const status = await executor.getStatus(handle.executionId)
    expect(status.status).toBe('running')
    expect(status.summary).toBeUndefined()
  })

  it('allows manual status transitions', async () => {
    const executor = new MockExecutor({ autoFinish: false })
    const handle = await executor.launch('Test prompt')

    executor.setStatus(handle.executionId, 'finished', 'Done!')
    const status = await executor.getStatus(handle.executionId)
    expect(status.status).toBe('finished')
    expect(status.summary).toBe('Done!')
  })

  it('returns error for unknown execution', async () => {
    const executor = new MockExecutor()
    const status = await executor.getStatus('nonexistent')
    expect(status.status).toBe('error')
  })

  it('stops a running execution', async () => {
    const executor = new MockExecutor({ autoFinish: false })
    const handle = await executor.launch('Test prompt')

    await executor.stop(handle.executionId)
    const status = await executor.getStatus(handle.executionId)
    expect(status.status).toBe('stopped')
  })

  it('tracks multiple executions independently', async () => {
    const executor = new MockExecutor({ autoFinish: false })
    const h1 = await executor.launch('Task 1')
    const h2 = await executor.launch('Task 2')

    executor.setStatus(h1.executionId, 'finished', 'Task 1 done')

    const s1 = await executor.getStatus(h1.executionId)
    const s2 = await executor.getStatus(h2.executionId)
    expect(s1.status).toBe('finished')
    expect(s2.status).toBe('running')
  })

  it('stores launch options', async () => {
    const executor = new MockExecutor()
    await executor.launch('Test', { repository: 'https://github.com/test/repo' })

    const execution = executor.executions.get('mock_1')
    expect(execution?.options?.repository).toBe('https://github.com/test/repo')
  })
})
