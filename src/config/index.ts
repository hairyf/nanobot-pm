import type { AppConfig } from './schema'
import process from 'node:process'
import { loadConfig } from 'c12'
import { logger } from '../utils/logger'
import { parseAppConfig } from './schema'

let _config: AppConfig | undefined

export async function resolveConfig(): Promise<AppConfig> {
  if (_config)
    return _config
  const { config: raw, configFile } = await loadConfig<Partial<AppConfig>>({ name: 'agentic' })
  if (configFile) {
    logger.debug(`Config loaded from: ${configFile}`)
  }
  else {
    logger.warn(`No agentic.config.ts found in ${process.cwd()} — using default config`)
  }
  _config = parseAppConfig(raw ?? {})
  if (!_config.platform) {
    logger.debug('Config: platform is not set — agent delegation will be skipped')
  }
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
