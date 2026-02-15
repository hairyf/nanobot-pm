import type { PromiseFn } from '@hairy/utils'
import type { AgenticConfig } from './define'
import { proxy } from '@hairy/utils'
import { loadConfig } from 'c12'

const promise = loadConfig<AgenticConfig>({ name: 'agentic' }).then(_ => _.config)

export const config = proxy<AgenticConfig & { ready: PromiseFn }>(undefined, { ready: () => promise })

// @ts-expect-error any
promise.then(config.proxy.update)
