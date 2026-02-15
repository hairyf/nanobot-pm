import type { AppConfig } from './schema'
import { loadConfig } from 'c12'
import { parseAppConfig } from './schema'

let _config: AppConfig | undefined

export async function resolveConfig(): Promise<AppConfig> {
  if (_config)
    return _config
  const { config: raw } = await loadConfig<Partial<AppConfig>>({ name: 'agentic' })
  _config = parseAppConfig(raw ?? {})
  return _config
}

export function getConfig(): AppConfig {
  if (!_config)
    throw new Error('Config not loaded. Call resolveConfig() first.')
  return _config
}

export function setConfig(config: AppConfig): void {
  _config = config
}

export function clearConfig(): void {
  _config = undefined
}

export { AppConfigSchema, parseAppConfig } from './schema'
export type { AppConfig } from './schema'
