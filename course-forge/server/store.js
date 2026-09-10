import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * A JSON-file store, one file per course.
 *
 * Courses are small, few, and edited by one author at a time, so a directory
 * of files is the right amount of database. Writes go to a uniquely named
 * temporary file and are renamed into place, so a crash mid-write cannot
 * leave a half-written course behind.
 *
 * Writes to one course are also serialized. A running build checkpoints after
 * every stage while the request that started it is still going, so saves do
 * overlap in practice — queueing them keeps the last one written the last one
 * to land.
 */
export function createStore(directory) {
  const root = directory ?? process.env.COURSE_FORGE_DATA_DIR ?? join(process.cwd(), 'data', 'courses')

  async function ready() {
    await mkdir(root, { recursive: true })
    return root
  }

  const queues = new Map()

  function pathFor(id) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Invalid course id: ${id}`)
    return join(root, `${id}.json`)
  }

  return {
    root,

    async list() {
      await ready()
      const files = await readdir(root)
      const courses = await Promise.all(
        files
          .filter((file) => file.endsWith('.json'))
          .map(async (file) => {
            try {
              return JSON.parse(await readFile(join(root, file), 'utf8'))
            } catch {
              return null
            }
          }),
      )
      return courses
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    },

    async get(id) {
      await ready()
      try {
        return JSON.parse(await readFile(pathFor(id), 'utf8'))
      } catch (error) {
        if (error.code === 'ENOENT') return null
        throw error
      }
    },

    async save(course) {
      const target = pathFor(course.id)
      const previous = queues.get(course.id) ?? Promise.resolve()
      const write = previous
        .catch(() => {})
        .then(async () => {
          await ready()
          // A unique temp name per write: two overlapping saves must not race
          // to rename the same file, or one finds it already gone.
          const temporary = `${target}.${randomUUID().slice(0, 8)}.tmp`
          await writeFile(temporary, JSON.stringify(course, null, 2), 'utf8')
          await rename(temporary, target)
          return course
        })

      queues.set(course.id, write)
      try {
        return await write
      } finally {
        if (queues.get(course.id) === write) queues.delete(course.id)
      }
    },

    async remove(id) {
      await ready()
      await rm(pathFor(id), { force: true })
    },
  }
}
