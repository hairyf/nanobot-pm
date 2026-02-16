import { describe, expect, it } from 'vitest'
import { MockExecutor } from '../../../src/executor/mock'

describe('executor exports', () => {
  it('MockExecutor is importable', () => {
    const executor = new MockExecutor()
    expect(executor).toBeInstanceOf(MockExecutor)
  })

  it('creates mock executor with auto-finish', async () => {
    const executor = new MockExecutor({ autoFinish: true })
    const handle = await executor.launch('test')
    const status = await executor.getStatus(handle.executionId)
    expect(status.status).toBe('finished')
  })
})
