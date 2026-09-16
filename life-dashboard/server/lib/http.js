/**
 * Fetching things from the internet, defensively.
 *
 * Everything this dashboard pulls in — calendar feeds, news feeds — comes from
 * somewhere that can be slow, rude or briefly down, and none of it is worth
 * hanging the morning brief over. So: a hard timeout, a couple of retries on
 * the failures that are worth retrying, a size cap, and an honest error the
 * caller can show next to the panel that failed.
 */

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRIES = 2
const MAX_BYTES = 12_000_000
const USER_AGENT = 'life-dashboard/0.1 (+local personal dashboard)'

export class FetchError extends Error {
  constructor(message, { status = null, url = null, cause = null } = {}) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.url = url
    this.cause = cause
  }
}

/** 408/429 and the 5xx family are worth another go; a 404 never is. */
function isRetryable(status) {
  return status === 408 || status === 429 || (status >= 500 && status < 600)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchText(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    headers = {},
    fetchImpl = globalThis.fetch,
    signal,
  } = options

  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': USER_AGENT, accept: '*/*', ...headers },
        redirect: 'follow',
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = new FetchError(`${response.status} ${response.statusText || 'error'}`, {
          status: response.status,
          url,
        })
        if (attempt < retries && isRetryable(response.status)) {
          lastError = error
          await sleep(2 ** attempt * 400)
          continue
        }
        throw error
      }

      const length = Number(response.headers.get('content-length') ?? 0)
      if (length > MAX_BYTES) {
        throw new FetchError(`Response is too large (${length} bytes).`, { url })
      }

      const text = await response.text()
      if (text.length > MAX_BYTES) throw new FetchError('Response is too large.', { url })
      return {
        text,
        status: response.status,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        contentType: response.headers.get('content-type'),
      }
    } catch (error) {
      if (error instanceof FetchError && !isRetryable(error.status ?? 0)) throw error
      lastError = error.name === 'AbortError'
        ? new FetchError(`Timed out after ${timeoutMs}ms.`, { url, cause: error })
        : new FetchError(error.message, { url, cause: error })
      if (attempt >= retries) throw lastError
      await sleep(2 ** attempt * 400)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  throw lastError ?? new FetchError('Request failed.', { url })
}

/**
 * Turns a webcal:// address into the https:// one that actually fetches.
 * Apple and Outlook hand out webcal links by default, and people paste them in
 * exactly as given.
 */
export function normalizeFeedUrl(url) {
  const trimmed = String(url).trim()
  if (/^webcal:\/\//i.test(trimmed)) return trimmed.replace(/^webcal:\/\//i, 'https://')
  return trimmed
}

/** Rejects anything that is not an http(s) URL, before it reaches fetch. */
export function assertHttpUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new FetchError(`Not a valid URL: ${url}`, { url })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchError(`Only http and https addresses are supported, not ${parsed.protocol}`, { url })
  }
  return parsed.toString()
}
