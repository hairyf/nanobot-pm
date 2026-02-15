import { readdir, readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAgents } from '../../../src/agents/loader'

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

const mockReaddir = vi.mocked(readdir) as unknown as ReturnType<typeof vi.fn>
const mockReadFile = vi.mocked(readFile) as unknown as ReturnType<typeof vi.fn>

describe('agentLoader (loadAgents)', () => {
  beforeEach(() => {
    mockReaddir.mockReset()
    mockReadFile.mockReset()
  })

  it('loads agents from directory with JSON files', async () => {
    mockReaddir.mockResolvedValueOnce(['dev.json'])
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      id: 'dev-1',
      name: 'Developer',
      type: 'developer',
      capabilities: ['coding'],
      specialties: ['typescript'],
    }))
    const agents = await loadAgents(['/tmp/agents'])
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('dev-1')
    expect(agents[0].name).toBe('Developer')
    expect(agents[0].type).toBe('developer')
    expect(agents[0].capabilities).toEqual(['coding'])
    expect(agents[0].specialties).toEqual(['typescript'])
    expect(agents[0].status).toBe('idle')
  })

  it('skips non-JSON files', async () => {
    mockReaddir.mockResolvedValueOnce(['dev.json', 'readme.txt', 'config.yaml'])
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ id: 'dev-1', name: 'Dev' }))
    const agents = await loadAgents(['/tmp/agents'])
    expect(mockReadFile).toHaveBeenCalledTimes(1)
    expect(agents).toHaveLength(1)
  })

  it('handles non-existent directory gracefully', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT'))
    const agents = await loadAgents(['/nonexistent'])
    expect(agents).toEqual([])
  })

  it('handles invalid JSON gracefully', async () => {
    mockReaddir.mockResolvedValueOnce(['bad.json'])
    mockReadFile.mockResolvedValueOnce('not valid json {')
    const agents = await loadAgents(['/tmp/agents'])
    expect(agents).toEqual([])
  })

  it('creates TaskAgent with defaults for missing fields', async () => {
    mockReaddir.mockResolvedValueOnce(['minimal.json'])
    mockReadFile.mockResolvedValueOnce(JSON.stringify({}))
    const agents = await loadAgents(['/tmp/agents'])
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBeDefined()
    expect(agents[0].name).toBe('Unknown')
    expect(agents[0].type).toBe('generic')
    expect(agents[0].capabilities).toEqual([])
    expect(agents[0].specialties).toEqual([])
    expect(agents[0].status).toBe('idle')
    expect(agents[0].config.maxConcurrentTasks).toBe(1)
    expect(agents[0].config.timeout).toBe(1800000)
    expect(agents[0].statistics.totalTasks).toBe(0)
    expect(agents[0].metadata).toEqual({})
  })
})
