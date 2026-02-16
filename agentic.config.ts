import { defineConfig } from 'agentic-x'

export default defineConfig({
  platform: 'cursor',
  orchestrator: {
    maxConcurrentTasks: 5,
    defaultTimeout: 1800000,
    maxRetries: 3,
    pollInterval: 10000,
  },
  scorer: {
    agentId: 'scorer',
    autoScore: true,
    scoreThreshold: 0.8,
  },
  mediator: {
    triggerThreshold: 3,
    enableCBR: true,
  },
  storage: {
    driver: 'fs',
    basePath: '.agentic/storage',
  },
  agents: {
    directories: ['.cursor/agents/'],
    autoLoad: true,
  },
})
