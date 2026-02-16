import { beforeEach, describe, expect, it } from 'vitest'
import { clearConfig, getConfig, setConfig } from '../../../src/config'
import { defineConfig } from '../../../src/config/define'
import { defaultConfig, parseAppConfig } from '../../../src/config/schema'

describe('config', () => {
  beforeEach(() => {
    clearConfig()
  })

  describe('parseAppConfig', () => {
    it('returns correct defaults when given empty object', () => {
      const config = parseAppConfig({})
      expect(config.orchestrator).toEqual({
        maxConcurrentTasks: 5,
        defaultTimeout: 1800000,
        maxRetries: 3,
        pollInterval: 10000,
        maxDepth: 10,
        memoryThreshold: 500 * 1024 * 1024,
      })
      expect(config.scorer).toEqual({
        autoScore: false,
        scoreThreshold: 0.8,
      })
      expect(config.mediator).toEqual({
        triggerThreshold: 3,
        enableCBR: true,
      })
      expect(config.storage).toEqual({
        driver: 'fs',
        basePath: '.agentic/storage',
      })
      expect(config.agents).toEqual({
        directories: ['.cursor/agents/', '.claude/agents/'],
        autoLoad: true,
      })
    })

    it('correctly merges partial config with defaults', () => {
      const config = parseAppConfig({
        orchestrator: { maxConcurrentTasks: 10 },
        storage: { driver: 'redis' },
      })
      expect(config.orchestrator.maxConcurrentTasks).toBe(10)
      expect(config.orchestrator.defaultTimeout).toBe(1800000)
      expect(config.storage.driver).toBe('redis')
      expect(config.storage.basePath).toBe('.agentic/storage')
    })
  })

  describe('defaultConfig', () => {
    it('has expected default values', () => {
      expect(defaultConfig).toBeDefined()
      expect(defaultConfig.orchestrator.maxConcurrentTasks).toBe(5)
      expect(defaultConfig.scorer).toBeDefined()
      expect(defaultConfig.mediator.triggerThreshold).toBe(3)
      expect(defaultConfig.storage.driver).toBe('fs')
      expect(defaultConfig.agents.autoLoad).toBe(true)
    })
  })

  describe('defineConfig', () => {
    it('returns the config as-is (passthrough)', () => {
      const partial = { orchestrator: { maxConcurrentTasks: 7 } }
      const result = defineConfig(partial)
      expect(result).toBe(partial)
      expect(result).toEqual(partial)
    })
  })

  describe('getConfig', () => {
    it('throws if resolveConfig not called', () => {
      expect(() => getConfig()).toThrow('Config not loaded. Call resolveConfig() first.')
    })
  })

  describe('setConfig and getConfig', () => {
    it('round-trips correctly', () => {
      const config = parseAppConfig({ orchestrator: { maxConcurrentTasks: 12 } })
      setConfig(config)
      const got = getConfig()
      expect(got).toBe(config)
      expect(got.orchestrator.maxConcurrentTasks).toBe(12)
    })
  })
})
