import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionReporter } from '../../../src/orchestrator/reporter'
import { createMockTask } from '../../helpers'

describe('session reporter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('binds session to task', () => {
    const getTask = vi.fn().mockResolvedValue(createMockTask({ id: 't1' }))
    const reporter = new SessionReporter(
      { pollInterval: 1000, onProgress: () => {}, onComplete: () => {}, onError: () => {} },
      getTask,
    )
    reporter.bind('session-1', 't1')
    expect(reporter.getBinding()).toMatchObject({
      sessionId: 'session-1',
      taskId: 't1',
      status: 'active',
    })
    reporter.unbind()
  })

  it('reports progress at configured interval', async () => {
    const task = createMockTask({ id: 't1' })
    const getTask = vi.fn().mockResolvedValue(task)
    const onProgress = vi.fn()
    const reporter = new SessionReporter(
      { pollInterval: 2000, onProgress, onComplete: () => {}, onError: () => {} },
      getTask,
    )
    reporter.bind('s1', 't1')
    reporter.start()
    expect(onProgress).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(onProgress).toHaveBeenCalledWith(task)
    await vi.advanceTimersByTimeAsync(2000)
    expect(onProgress).toHaveBeenCalledTimes(2)
    reporter.unbind()
  })

  it('detects session disconnect', () => {
    const reporter = new SessionReporter(
      { pollInterval: 1000, onProgress: () => {}, onComplete: () => {}, onError: () => {} },
      () => Promise.resolve(undefined),
    )
    reporter.bind('s1', 't1')
    expect(reporter.getBinding()?.status).toBe('active')
    reporter.markDisconnected()
    expect(reporter.getBinding()?.status).toBe('disconnected')
    reporter.unbind()
  })

  it('unbinds session on completion', async () => {
    const task = createMockTask({ id: 't1' })
    const getTask = vi.fn().mockResolvedValue(task)
    const onComplete = vi.fn()
    const reporter = new SessionReporter(
      { pollInterval: 10000, onProgress: () => {}, onComplete, onError: () => {} },
      getTask,
    )
    reporter.bind('s1', 't1')
    reporter.start()
    await reporter.complete(task)
    expect(onComplete).toHaveBeenCalledWith(task)
    expect(reporter.getBinding()).toBeNull()
  })
})
