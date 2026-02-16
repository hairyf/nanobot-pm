import { describe, expect, it } from 'vitest'

/**
 * Hello world 测试函数：返回 "Hello, World!"
 */
function helloWorld(): string {
  return 'Hello, World!'
}

describe('debug: hello world', () => {
  it('returns "Hello, World!"', () => {
    expect(helloWorld()).toBe('Hello, World!')
  })
})
