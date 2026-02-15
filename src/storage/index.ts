import type { Storage } from 'unstorage'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

let _storage: Storage | undefined

export function createStorageInstance(basePath: string = '.agentic/storage'): Storage {
  return createStorage({
    driver: fsDriver({ base: basePath }),
  })
}

export function getStorage(): Storage {
  if (!_storage) {
    _storage = createStorageInstance()
  }
  return _storage
}

export function setStorage(storage: Storage): void {
  _storage = storage
}

export { createStorage } from 'unstorage'
export type { Storage } from 'unstorage'
