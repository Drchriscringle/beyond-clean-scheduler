import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * A JSON-file store, one file per collection.
 *
 * This is one person's life, not a multi-tenant service: a few hundred
 * commitments, events and objectives, edited by one human at a time. A
 * directory of readable JSON files is the right amount of database, and it
 * means your data stays something you can open, diff, back up and take
 * elsewhere without an export feature.
 *
 * Writes go to a uniquely named temporary file and are renamed into place, so
 * a crash mid-write can never truncate a collection. Writes to one collection
 * are serialized, so two overlapping saves land in order rather than
 * clobbering each other.
 */

export const COLLECTIONS = {
  profile: {},
  accounts: [],
  commitments: [],
  transactions: [],
  events: [],
  feeds: [],
  targets: [],
  objectives: [],
  newsSources: [],
  newsItems: [],
  dismissals: [],
  connections: [],
}

/**
 * Collections holding credentials. These are written user-only, because an
 * Open Banking refresh token is a key to your bank statements sitting in a
 * file — the default umask on a shared machine is not good enough for that.
 */
const SECRET_COLLECTIONS = new Set(['connections'])

export function createStore(directory) {
  const root = directory ?? process.env.LIFE_DASHBOARD_DATA_DIR ?? join(process.cwd(), 'data')
  const queues = new Map()
  const cache = new Map()

  async function ready() {
    await mkdir(root, { recursive: true })
    return root
  }

  function pathFor(name) {
    if (!Object.hasOwn(COLLECTIONS, name)) throw new Error(`Unknown collection: ${name}`)
    return join(root, `${name}.json`)
  }

  async function read(name) {
    if (cache.has(name)) return cache.get(name)
    await ready()
    let value
    try {
      value = JSON.parse(await readFile(pathFor(name), 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      value = structuredClone(COLLECTIONS[name])
    }
    cache.set(name, value)
    return value
  }

  async function write(name, value) {
    await ready()
    const target = pathFor(name)
    const temporary = `${target}.${randomUUID()}.tmp`
    const mode = SECRET_COLLECTIONS.has(name) ? 0o600 : 0o644
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode })
    await rename(temporary, target)
    cache.set(name, value)
    return value
  }

  /** Serializes work per collection, so concurrent saves queue instead of racing. */
  function enqueue(name, task) {
    const previous = queues.get(name) ?? Promise.resolve()
    const next = previous.then(task, task)
    queues.set(
      name,
      next.catch(() => {}),
    )
    return next
  }

  return {
    root,

    get(name) {
      return read(name)
    },

    set(name, value) {
      return enqueue(name, () => write(name, value))
    },

    /** Read-modify-write inside the queue, so updater sees the latest value. */
    update(name, updater) {
      return enqueue(name, async () => {
        const current = await read(name)
        const next = await updater(structuredClone(current))
        return write(name, next)
      })
    },

    /** Appends to a list collection and returns the saved record. */
    async add(name, record) {
      const saved = { id: record.id ?? randomUUID(), createdAt: new Date().toISOString(), ...record }
      await this.update(name, (list) => [...list, saved])
      return saved
    },

    async patch(name, id, changes) {
      let updated = null
      await this.update(name, (list) =>
        list.map((item) => {
          if (item.id !== id) return item
          updated = { ...item, ...changes, id: item.id, updatedAt: new Date().toISOString() }
          return updated
        }),
      )
      return updated
    },

    async remove(name, id) {
      let removed = false
      await this.update(name, (list) => {
        removed = list.some((item) => item.id === id)
        return list.filter((item) => item.id !== id)
      })
      return removed
    },

    /** Drops the in-memory cache; used by tests and after an external edit. */
    forget() {
      cache.clear()
    },
  }
}
