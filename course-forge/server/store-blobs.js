import { getStore } from '@netlify/blobs'

const COURSE_PREFIX = 'course/'

/**
 * The store backed by Netlify Blobs, for the hosted studio.
 *
 * Strongly consistent because a build writes from a background function while
 * the studio is polling for its progress from another — eventual consistency
 * would show the author a stale course for up to a minute.
 */
export function createBlobStore(name = 'course-forge') {
  const blobs = getStore({ name, consistency: 'strong' })

  return {
    root: `netlify-blobs:${name}`,

    async list() {
      const { blobs: entries } = await blobs.list({ prefix: COURSE_PREFIX })
      const courses = await Promise.all(
        entries.map(async (entry) => {
          try {
            return await blobs.get(entry.key, { type: 'json' })
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
      return (await blobs.get(key(id), { type: 'json' })) ?? null
    },

    async save(course) {
      await blobs.setJSON(key(course.id), course)
      return course
    },

    async remove(id) {
      await blobs.delete(key(id))
    },
  }
}

function key(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Invalid course id: ${id}`)
  return `${COURSE_PREFIX}${id}`
}
