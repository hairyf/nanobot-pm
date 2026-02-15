#!/usr/bin/env node
/* eslint-disable antfu/no-top-level-await */
'use strict'

import { register } from 'tsx/esm/api'

const unregister = register()

await import('../src/cli/index.ts')

unregister()
