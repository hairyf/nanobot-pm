import { defineCommand, runMain } from 'citty'
import packageJSON from '../../package.json' with { type: 'json' }
import { completeCommand } from './commands/complete'
import { initCommand } from './commands/init'
import { specifyCommand } from './commands/specify'
import { statusCommand } from './commands/status'

const main = defineCommand({
  meta: {
    name: 'agentic',
    version: packageJSON.version,
    description: 'Multi-level Agent Orchestrator',
  },
  subCommands: {
    init: initCommand,
    specify: specifyCommand,
    complete: completeCommand,
    status: statusCommand,
  },
})

runMain(main)
