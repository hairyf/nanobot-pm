import type { Agent } from '../config/define'
import { randomUUID } from 'node:crypto'
import { x } from 'tinyexec'

export const claude: Agent = {
  // 初始化系统会话、返回会话 ID
  fresh: async (system: string) => {
    const sessionId = randomUUID()
    await x(
      'claude',
      [
        ...['--session-id', sessionId],
        ...['--append-system-prompt', system],
        ...['-p', 'init'],
      ],
      {
        nodeOptions: { stdio: 'inherit' },
      },
    )
    return sessionId
  },
  // 启动交互模式
  start: async (session: string) =>
    x('claude', ['-r', session], { nodeOptions: { stdio: 'inherit' } }),
  // 系统内部对话
  reply: async (session: string, message: string) =>
    x('claude', ['-p', message, '-r', session], { nodeOptions: { stdio: 'inherit' } }),
  clear: async (session: string) =>
    x('claude', ['-r', session], { nodeOptions: { stdio: 'inherit' } }),
}

export const cursor: Agent = {
  // 创建一个新的 Cursor Agent 会话，并写入系统提示和可选的初始用户提示
  fresh: async (system: string, prompt?: string) => {
    // 1. 先创建一个空的 chat，拿到 chatId 作为会话 ID
    const { stdout } = await x('agent', ['create-chat'])
    const sessionId = stdout.toString().trim()

    if (!sessionId)
      throw new Error('Failed to create Cursor Agent chat session')

    // 2. 把系统提示（以及可选的首条用户提示）写入这个会话
    const seed = prompt ? `${system}\n\n${prompt}` : system

    await x('agent', ['--resume', sessionId, '--print', seed], {
      nodeOptions: { stdio: 'inherit' },
    })

    return sessionId
  },
  // 启动交互模式，直接在终端里接管该 chat
  start: async (session: string) =>
    x('agent', ['--resume', session], { nodeOptions: { stdio: 'inherit' } }),
  // 在已有会话中追加一条非交互消息（print 模式）
  reply: async (session: string, message: string) =>
    x('agent', ['--resume', session, '--print', message], {
      nodeOptions: { stdio: 'inherit' },
    }),
  clear: async (session: string) =>
    x('agent', ['--delete', session], { nodeOptions: { stdio: 'inherit' } }),
}
