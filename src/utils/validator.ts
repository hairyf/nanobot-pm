export function generateUUID(): string {
  return crypto.randomUUID()
}

export function validateTaskInput(description: string): { valid: true } | { valid: false, error: string } {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Task description is required' }
  }
  const trimmed = description.trim()
  if (!trimmed) {
    return { valid: false, error: 'Task description cannot be empty' }
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Task description must not exceed 1000 characters' }
  }
  return { valid: true }
}

export function validateConfig(config: unknown): { valid: true } | { valid: false, error: string } {
  if (config === null || config === undefined) {
    return { valid: false, error: 'Config is required' }
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, error: 'Config must be an object' }
  }
  const obj = config as Record<string, unknown>
  if (!obj.agent || typeof obj.agent !== 'object') {
    return { valid: false, error: 'Config must have an agent property' }
  }
  return { valid: true }
}
