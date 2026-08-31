/**
 * Search autocomplete — what people are actually typing.
 *
 * Trends tells you how interest in a phrase is moving. Autocomplete tells you
 * the phrasing itself: the long-tail completions real people reach for, ranked
 * by how often they are typed. On Etsy that matters more than it does almost
 * anywhere else, because a new shop cannot rank for "wall art" but can rank for
 * "whimsigothic wavy mirror wall art" — and only if it knows people type it.
 *
 * Each keyword is probed with a few variants. The bare term returns the
 * strongest completions; the trailing space forces Google past the term itself
 * into the modifiers that follow it, which is where the long tail lives.
 *
 * Caveat, same as Google Trends: this is an undocumented endpoint used by
 * browser search bars, not a supported API. It is fast and rarely rate-limits,
 * but failures here are non-fatal and recorded like any other.
 */

import { fetchWithRetry, sleep } from './http.js'

const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search'

/**
 * Both response shapes Google serves:
 *   client=firefox -> ["term", ["a", "b"]]
 *   client=chrome  -> ["term", ["a", "b"], [], [], {metadata}]
 * Either way the completions are the second element.
 */
export function parseSuggestions(text) {
  const payload = JSON.parse(text)
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return []
  return payload[1]
    .map((row) => (typeof row === 'string' ? row : row?.[0]))
    .filter((row) => typeof row === 'string' && row.trim())
    .map((row) => row.trim().toLowerCase())
}

export class SuggestClient {
  constructor({
    language = 'en',
    geo = 'US',
    limits = {},
    fetchImpl = globalThis.fetch,
    logger = () => {},
  } = {}) {
    this.language = language.split('-')[0]
    this.geo = geo.toLowerCase()
    this.limits = {
      suggestRequestDelayMs: 300,
      suggestVariantsPerKeyword: 2,
      requestTimeoutMs: 20000,
      maxRetries: 2,
      ...limits,
    }
    this.fetchImpl = fetchImpl
    this.logger = logger
  }

  /**
   * Probe variants, most productive first. The caller takes a prefix of this
   * list, so the order is the cost/benefit ordering.
   */
  variantsFor(term) {
    return [term, `${term} `, `${term} for`, `${term} with`]
  }

  async fetchVariant(query) {
    const url =
      `${SUGGEST_URL}?client=firefox&hl=${encodeURIComponent(this.language)}` +
      `&gl=${encodeURIComponent(this.geo)}&q=${encodeURIComponent(query)}`
    const response = await fetchWithRetry(url, {
      headers: { Accept: 'application/json, text/javascript, */*' },
      timeoutMs: this.limits.requestTimeoutMs,
      maxRetries: this.limits.maxRetries,
      fetchImpl: this.fetchImpl,
      onRetry: ({ attempt, waitMs }) => this.logger(`suggest: retry ${attempt} in ${waitMs}ms`),
    })
    await sleep(this.limits.suggestRequestDelayMs)
    return parseSuggestions(await response.text())
  }

  /**
   * Completions for one keyword, de-duplicated across variants and ordered by
   * best rank achieved — a phrase Google offers first for the bare term is a
   * more common search than one that only shows up under a modifier.
   */
  async collect(term) {
    const variants = this.variantsFor(term).slice(
      0,
      Math.max(1, this.limits.suggestVariantsPerKeyword),
    )

    const best = new Map()
    const errors = []
    for (const variant of variants) {
      try {
        const suggestions = await this.fetchVariant(variant)
        suggestions.forEach((query, index) => {
          const prior = best.get(query)
          if (!prior || index < prior.rank) best.set(query, { query, rank: index })
        })
      } catch (err) {
        errors.push(err.message)
      }
    }

    if (best.size === 0) {
      return { ok: false, error: errors[0] ?? 'no suggestions returned', suggestions: [] }
    }
    return {
      ok: true,
      suggestions: [...best.values()].sort((a, b) => a.rank - b.rank),
      partial: errors.length > 0,
    }
  }
}
