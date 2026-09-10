import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { loadEnv } from './lib/env.js'
import { createStore } from './store.js'
import { createApiHandler } from './http/api.js'
import { toRequest, sendResponse } from './http/node-adapter.js'
import { runGeneration } from './generate.js'
import { hasCredentials, selectProvider } from './ai/provider.js'

const here = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(here, '..', 'dist')
const PORT = Number(process.env.PORT) || 5174

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function createCourseForgeServer(options = {}) {
  const store = options.store ?? createStore(options.dataDir)
  const api = createApiHandler({
    store,
    providerOptions: options.providerOptions ?? {},
    // Locally a build just runs in the background of this process; hosted, the
    // same work is a background function. Either way the studio polls for it.
    generatePath: '/api/courses/:id/generate',
    startGeneration: async (job) => {
      runGeneration({ store, ...job }).catch((error) => console.error('[course-forge]', error))
    },
  })

  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const response = await api(await toRequest(req, url.origin))
        return await sendResponse(res, response)
      }
      return await serveStatic(res, url.pathname)
    } catch (error) {
      const status = error.status ?? 500
      if (status >= 500) console.error('[course-forge]', error)
      if (res.headersSent) return res.end()
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: status >= 500 ? 'Internal server error.' : error.message }))
    }
  })
}

async function serveStatic(res, pathname) {
  // normalize() collapses `..`, and the resolved path is checked against the
  // build directory so a crafted URL cannot escape it.
  const requested = normalize(decodeURIComponent(pathname))
  const filePath = resolve(join(DIST, requested === '/' ? 'index.html' : requested))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const stats = await stat(filePath)
    if (stats.isDirectory()) throw Object.assign(new Error('directory'), { code: 'ENOENT' })
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    createReadStream(filePath).pipe(res)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    // Single-page app: unknown paths fall back to the shell, unless the build
    // is missing entirely — in which case say so rather than 404 silently.
    try {
      await stat(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      createReadStream(join(DIST, 'index.html')).pipe(res)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('The studio has not been built yet. Run `npm run build`, or `npm run dev` for the dev server.\n')
    }
  }
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isEntryPoint) {
  const envFile = loadEnv()
  const provider = selectProvider()
  createCourseForgeServer().listen(PORT, () => {
    console.log(`CourseForge API listening on http://localhost:${PORT}`)
    if (envFile) console.log(`Loaded ${envFile}`)
    console.log(`Generator: ${provider.name} (${provider.model})`)
    if (!hasCredentials()) {
      console.log(
        envFile
          ? `No ANTHROPIC_API_KEY in ${envFile} — running the offline mock generator, so courses will be placeholder prose.`
          : 'No ANTHROPIC_API_KEY found and no .env file — running the offline mock generator, so courses will be\n  placeholder prose. Copy .env.example to .env and add your key to generate real courses.',
      )
    }
  })
}
