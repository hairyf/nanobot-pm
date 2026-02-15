import { access, mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { defineCommand } from 'citty'
import { join } from 'pathe'
import { logger } from '../../utils/logger'

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize agentic configuration and directories',
  },
  async run() {
    const cwd = process.cwd()

    const agenticDir = join(cwd, '.agentic')
    const storageDir = join(agenticDir, 'storage')

    await mkdir(storageDir, { recursive: true })
    logger.info('Created .agentic/storage/ directory')

    const configPath = join(cwd, 'agentic.config.ts')
    try {
      await access(configPath)
      logger.info('agentic.config.ts already exists')
    }
    catch {
      const template = `import { defineConfig } from 'agentic-x/config/define'

export default defineConfig({
  orchestrator: {
    maxConcurrentTasks: 5,
    defaultTimeout: 1800000,
    maxRetries: 3,
    pollInterval: 10000,
  },
  scorer: {
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
    directories: ['.cursor/agents/', '.claude/agents/'],
    autoLoad: true,
  },
})
`
      await writeFile(configPath, template, 'utf-8')
      logger.info('Created agentic.config.ts')
    }

    logger.success('Initialization complete')
  },
})
