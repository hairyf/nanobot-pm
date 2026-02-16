import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'pathe'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const AGENTIC_X_PATH = path.resolve(__dirname, '..')
export const USER_ROOT_PATH = process.cwd()

export { PLATFORM_CONFIG, PLATFORMS } from './platforms'
export type { Platform } from './platforms'
