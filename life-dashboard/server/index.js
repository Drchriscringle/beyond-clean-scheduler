import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.js'
import { createApi } from './routes.js'
import { bankingConfig, isConfigured } from './money/banking.js'

const here = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(here, '..', 'dist')
const PORT = Number(process.env.PORT) || 5175

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

export function createDashboardServer(options = {}) {
  const store = options.store ?? createStore(options.dataDir)
  const api = createApi({ store, fetchImpl: options.fetchImpl, now: options.now })

  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return await api(req, res, url)
      }
      return await serveStatic(res, url.pathname)
    } catch (error) {
      const status = error.status ?? 500
      if (status >= 500) console.error('[life-dashboard]', error)
      if (res.headersSent) return res.end()
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: status >= 500 ? 'Something went wrong.' : error.message }))
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
      res.end('The dashboard has not been built yet. Run `npm run build`, or `npm run dev` for the dev server.\n')
    }
  }
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isEntryPoint) {
  const store = createStore()
  createDashboardServer({ store }).listen(PORT, '127.0.0.1', () => {
    // Bound to the loopback address on purpose: this is one person's calendar,
    // bank balance and plans, and it should not be reachable from the network
    // just because the laptop joined a café wifi.
    console.log(`Life Dashboard  →  http://localhost:${PORT}`)
    console.log(`Data            →  ${store.root}`)
    console.log(`Open Banking    →  ${isConfigured(bankingConfig()) ? `configured (${bankingConfig().environment})` : 'not configured (optional)'}`)
  })
}
