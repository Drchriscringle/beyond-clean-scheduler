import { createApiHandler } from '../../server/http/api.js'
import { createBlobStore } from '../../server/store-blobs.js'

/**
 * Everything except starting a build. A build takes minutes, which is far
 * longer than a synchronous function may run, so it lives in the background
 * function next door and this one serves the progress the studio polls for.
 */
export default async (request) => {
  const handler = createApiHandler({
    store: createBlobStore(),
    generatePath: '/api/generate/:id',
  })
  return handler(request)
}

export const config = {
  path: '/api/*',
  excludedPath: '/api/generate/*',
}
