import { defineCommand, runMain } from 'citty'
import packageJSON from '../../package.json' with { type: 'json' }
import { completeCommand } from './commands/complete'
import { initCommand } from './commands/init'
import { respondCommand } from './commands/respond'
import { specifyCommand } from './commands/specify'
import { statusCommand } from './commands/status'
import { subtaskCommand } from './commands/subtask'
import { waitCommand } from './commands/wait'

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
    wait: waitCommand,
    subtask: subtaskCommand,
    respond: respondCommand,
  },
})

runMain(main)
