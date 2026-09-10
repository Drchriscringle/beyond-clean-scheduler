import { createBlobStore } from '../../server/store-blobs.js'
import { runGeneration, ALL_STEPS, isRunning } from '../../server/generate.js'

/**
 * Runs a course build.
 *
 * A background function so it gets the long timeout a multi-request build
 * needs: it answers 202 straight away and writes its progress onto the course,
 * which the studio polls. That also means a build survives the author closing
 * the tab.
 */
export default async (request) => {
  const courseId = new URL(request.url).pathname.split('/').filter(Boolean).pop()
  const store = createBlobStore()

  const course = await store.get(courseId)
  if (!course) {
    console.error(`[course-forge] no course ${courseId}`)
    return
  }
  if (isRunning(course)) {
    console.log(`[course-forge] build already running for ${courseId}`)
    return
  }

  const body = await request.json().catch(() => ({}))
  await runGeneration({
    store,
    course,
    steps: Array.isArray(body.steps) && body.steps.length ? body.steps : ALL_STEPS,
    reset: Boolean(body.reset),
    // The author's key arrives with the request and is never stored.
    providerOptions: { apiKey: request.headers.get('x-anthropic-key') || undefined },
  })
}

export const config = {
  path: '/api/generate/:courseId',
}
