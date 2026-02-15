import { defineCommand, runMain } from 'citty'
import packageJSON from '../../package.json' with { type: 'json' }

/**
 * Agentic CLI (citty).
 */
const main = defineCommand({
  meta: {
    name: 'agentic',
    version: packageJSON.version,
  },
})

runMain(main)
