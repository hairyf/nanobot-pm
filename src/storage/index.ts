import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

export function createStorageInstance(basePath: string = '.agentic/storage') {
  return createStorage({
    driver: fsDriver({ base: basePath }),
  })
}

export { createStorage } from 'unstorage'
export type { Storage } from 'unstorage'
