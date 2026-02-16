import type { Platform } from '../../constants/platforms'
import { access, mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { join } from 'pathe'
import { PLATFORM_CONFIG, PLATFORMS } from '../../constants/platforms'
import { logger } from '../../utils/logger'

const DEVELOPER_AGENT_MD = `---
name: developer
description: A general-purpose developer agent for coding tasks
---

## Capabilities

- coding
- testing
- debugging

## Specialties

- typescript
- javascript
`

const AGENTIC_SPECIFY_CMD = `---
description: Create and execute a task via the agentic orchestrator
---

## Task

\`\`\`text
$ARGUMENTS
\`\`\`

## Steps

### 1. Analyze agents

Read all \`.md\` files in the agents directory (e.g. \`.cursor/agents/\`).
Each file has frontmatter (\`name\`, \`description\`) and Markdown sections (\`Capabilities\`, \`Specialties\`).
Based on the task description, decide which agent is best suited for the job.

### 2. Register, assign, and launch

Run the following command (one step — registers the task, assigns the agent, and launches a Cloud Agent):

\`\`\`bash
pnpm agentic specify <agentId> "$ARGUMENTS"
\`\`\`

Parse the JSON output and save \`taskId\` for subsequent steps.

### 3. Poll status

Continuously poll the task status until it reaches a terminal state:

\`\`\`bash
pnpm agentic status <taskId> --json
\`\`\`

- If \`status\` is \`running\`, wait a few seconds and poll again.
- If \`status\` is \`completed\`, report the result (including score and summary) to the user.
- If \`status\` is \`failed\`, report the error to the user.
`

const AGENTIC_STATUS_CMD = `---
description: Check the status of agentic tasks
---

## Usage

\`\`\`text
$ARGUMENTS
\`\`\`

## Steps

1. If a task ID is provided in \`$ARGUMENTS\`, run \`pnpm agentic status <taskId>\`
2. Otherwise, run \`pnpm agentic status\` to list all tasks
3. Report the results to the user
`

interface CommandTemplate {
  filename: string
  content: string
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  { filename: 'agentic.specify.md', content: AGENTIC_SPECIFY_CMD },
  { filename: 'agentic.status.md', content: AGENTIC_STATUS_CMD },
]

function generateConfigTemplate(platform: Platform): string {
  const agentsDir = PLATFORM_CONFIG[platform].agentsDir
  return `import { defineConfig } from 'agentic-x/config/define'

export default defineConfig({
  platform: '${platform}',
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
    directories: ['${agentsDir}'],
    autoLoad: true,
  },
})
`
}

async function writeIfNotExists(filePath: string, content: string, label: string): Promise<boolean> {
  try {
    await access(filePath)
    p.log.info(`${label} already exists, skipping`)
    return false
  }
  catch {
    await writeFile(filePath, content, 'utf-8')
    p.log.success(`Created ${label}`)
    return true
  }
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize agentic configuration and directories',
  },
  args: {
    platform: {
      type: 'string',
      description: 'AI platform to use (cursor, claude)',
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd()

    p.intro('agentic init')

    // Resolve platform: from --platform arg or interactive prompt
    let platform: Platform
    const argPlatform = args.platform as string | undefined

    if (argPlatform && PLATFORMS.includes(argPlatform as Platform)) {
      platform = argPlatform as Platform
      p.log.info(`Platform: ${PLATFORM_CONFIG[platform].name}`)
    }
    else {
      const selected = await p.select({
        message: 'Which AI platform are you using?',
        options: PLATFORMS.map(key => ({
          value: key,
          label: PLATFORM_CONFIG[key].name,
        })),
      })

      if (p.isCancel(selected)) {
        p.cancel('Init cancelled.')
        process.exit(0)
      }

      platform = selected as Platform
    }

    const platformConfig = PLATFORM_CONFIG[platform]

    // 1. Create .agentic/storage/
    const storageDir = join(cwd, '.agentic', 'storage')
    await mkdir(storageDir, { recursive: true })
    p.log.success('Created .agentic/storage/')

    // 2. Create platform agents directory + example agent
    const agentsDir = join(cwd, platformConfig.agentsDir)
    await mkdir(agentsDir, { recursive: true })
    p.log.success(`Created ${platformConfig.agentsDir}`)

    await writeIfNotExists(
      join(agentsDir, 'developer.md'),
      DEVELOPER_AGENT_MD,
      `${platformConfig.agentsDir}developer.md`,
    )

    // 3. Create platform commands directory + command files
    if (platformConfig.commandsDir) {
      const commandsDir = join(cwd, platformConfig.commandsDir)
      await mkdir(commandsDir, { recursive: true })
      p.log.success(`Created ${platformConfig.commandsDir}`)

      for (const tmpl of COMMAND_TEMPLATES) {
        await writeIfNotExists(
          join(commandsDir, tmpl.filename),
          tmpl.content,
          `${platformConfig.commandsDir}${tmpl.filename}`,
        )
      }
    }

    // 4. Create platform skills directory (if supported)
    if (platformConfig.skillsDir) {
      const skillsDir = join(cwd, platformConfig.skillsDir)
      await mkdir(skillsDir, { recursive: true })
      p.log.success(`Created ${platformConfig.skillsDir}`)
    }

    // 5. Write agentic.config.ts
    await writeIfNotExists(
      join(cwd, 'agentic.config.ts'),
      generateConfigTemplate(platform),
      'agentic.config.ts',
    )

    p.outro('Initialization complete!')
    logger.info(`Next: run \`agentic specify "your task description"\` to create a task`)
    logger.info(`Or use /agentic.specify in your ${platformConfig.name} chat`)
  },
})
