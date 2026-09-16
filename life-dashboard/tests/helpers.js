import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../server/store.js'

/** A store in a throwaway directory, cleaned up when the test ends. */
export async function withStore(t) {
  const directory = await mkdtemp(join(tmpdir(), 'life-dashboard-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return createStore(directory)
}
