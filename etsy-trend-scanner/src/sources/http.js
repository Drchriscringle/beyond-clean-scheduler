/**
 * Shared HTTP helpers: timeouts, bounded retries with exponential backoff, and
 * polite pacing. Every collector goes through here so rate limits are handled
 * in one place.
 */

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} for ${url}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.body = body
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export async function fetchWithRetry(
  url,
  { timeoutMs = 20000, maxRetries = 3, fetchImpl = globalThis.fetch, onRetry, ...init } = {},
) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal })
      if (response.ok) return response
      const body = await response.text().catch(() => '')
      const error = new HttpError(response.status, url, body.slice(0, 500))
      if (!RETRYABLE_STATUSES.has(response.status)) throw error
      lastError = error
    } catch (err) {
      if (err instanceof HttpError && !RETRYABLE_STATUSES.has(err.status)) throw err
      lastError = err
    } finally {
      clearTimeout(timer)
    }

    if (attempt < maxRetries) {
      const backoff = 2 ** attempt * 1000 + Math.floor(Math.random() * 250)
      onRetry?.({ attempt: attempt + 1, url, error: lastError, waitMs: backoff })
      await sleep(backoff)
    }
  }
  throw lastError
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(url, options)
  return response.json()
}

/**
 * Google's internal APIs prefix JSON with an anti-hijacking guard such as
 * `)]}'` or `)]}',`. Strip whatever leads up to the first brace.
 */
export function parseGuardedJson(text) {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in response')
  return JSON.parse(text.slice(start))
}
