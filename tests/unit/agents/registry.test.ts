import { beforeEach, describe, expect, it } from 'vitest'
import { AgentRegistry } from '../../../src/agents/registry'
import { createMockAgent } from '../../helpers'

describe('agentRegistry', () => {
  let registry: AgentRegistry

  beforeEach(() => {
    registry = new AgentRegistry()
  })

  it('register and getById', () => {
    const agent = createMockAgent({ id: 'a1', name: 'Agent One' })
    registry.register(agent)
    expect(registry.getById('a1')).toEqual(agent)
    expect(registry.getById('missing')).toBeUndefined()
  })

  it('unregister removes agent', () => {
    const agent = createMockAgent({ id: 'a1' })
    registry.register(agent)
    expect(registry.unregister('a1')).toBe(true)
    expect(registry.getById('a1')).toBeUndefined()
    expect(registry.unregister('a1')).toBe(false)
  })

  it('listAvailable returns only idle agents', () => {
    const idle = createMockAgent({ id: 'idle', status: 'idle' })
    const busy = createMockAgent({ id: 'busy', status: 'busy' })
    registry.register(idle)
    registry.register(busy)
    const available = registry.listAvailable()
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('idle')
  })

  it('listAll returns all agents', () => {
    const a = createMockAgent({ id: 'a' })
    const b = createMockAgent({ id: 'b' })
    registry.register(a)
    registry.register(b)
    const all = registry.listAll()
    expect(all).toHaveLength(2)
    expect(all.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('matchByCapabilities returns matched agents sorted by match count', () => {
    const dev = createMockAgent({ id: 'dev', capabilities: ['coding', 'testing'], specialties: ['typescript'] })
    const design = createMockAgent({ id: 'design', capabilities: ['design'], specialties: ['css'] })
    registry.register(dev)
    registry.register(design)
    const matches = registry.matchByCapabilities(['typescript', 'coding', 'design'])
    expect(matches.length).toBeGreaterThanOrEqual(1)
    const devMatch = matches.find(m => m.id === 'dev')
    const designMatch = matches.find(m => m.id === 'design')
    expect(devMatch).toBeDefined()
    expect(designMatch).toBeDefined()
    expect(matches[0].id).toBe('dev')
  })

  it('selectBest returns best matching agent', () => {
    const dev = createMockAgent({ id: 'dev', capabilities: ['coding', 'typescript'], specialties: [] })
    const other = createMockAgent({ id: 'other', capabilities: ['coding'], specialties: [] })
    registry.register(other)
    registry.register(dev)
    const best = registry.selectBest(['typescript', 'coding'])
    expect(best).toBeDefined()
    expect(best?.id).toBe('dev')
  })

  it('updateStatus changes agent status', () => {
    const agent = createMockAgent({ id: 'a1', status: 'idle' })
    registry.register(agent)
    registry.updateStatus('a1', 'busy', 'task-123')
    const updated = registry.getById('a1')
    expect(updated?.status).toBe('busy')
    expect(updated?.currentTaskId).toBe('task-123')
  })
})
