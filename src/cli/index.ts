import { defineCommand, runMain } from 'citty'
import packageJSON from '../../package.json' with { type: 'json' }
import { initCommand } from './commands/init'
import { specifyCommand } from './commands/specify'

const main = defineCommand({
  meta: {
    name: 'agentic',
    version: packageJSON.version,
    description: 'Multi-level Agent Orchestrator',
  },
  subCommands: {
    init: initCommand,
    specify: specifyCommand,
  },
})

runMain(main)
