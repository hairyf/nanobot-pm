export const PLATFORM_CONFIG = {
  cursor: {
    name: 'Cursor',
    agentsDir: '.cursor/agents/',
    commandsDir: '.cursor/commands/',
    skillsDir: '.cursor/skills/',
  },
  claude: {
    name: 'Claude Code',
    agentsDir: '.claude/agents/',
    commandsDir: '.claude/commands/',
    skillsDir: null,
  },
} as const

export type Platform = keyof typeof PLATFORM_CONFIG
export const PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[]
