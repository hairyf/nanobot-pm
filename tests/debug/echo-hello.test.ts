import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/**
 * 调试用冒烟测试：验证测试环境中能执行 shell 命令并捕获输出。
 * 用于排查 CI/本地 shell 执行问题。
 */
describe('debug: echo hello', () => {
  it('runs echo hello and captures output', () => {
    const out = execSync('echo hello', { encoding: 'utf-8' })
    expect(out.trim()).toBe('hello')
  })
})
