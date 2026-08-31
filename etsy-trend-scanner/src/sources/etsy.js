/**
 * Etsy Open API v3 collector.
 *
 * What Etsy's public API will and will not tell you matters a lot here, so it
 * is worth being explicit:
 *
 *   IT WILL      total active listings for a search (competition), each
 *                listing's price, tags, materials, and creation date.
 *   IT WILL NOT  views, favourites, sales counts or revenue for listings you
 *                do not own. There is no public "trending on Etsy" feed.
 *
 * So we do not guess at sales. We measure the *supply* side directly — how
 * many sellers are in a niche, how fast new ones are arriving, what they
 * charge — and pair it with an independent demand signal (Google Trends) in
 * the scoring step. Sellers rushing into a niche is itself a leading
 * indicator: they are reacting to demand we cannot see.
 *
 * Everything here uses the documented API with an application key. No
 * scraping of etsy.com, which would breach Etsy's terms of use.
 */

import { fetchWithRetry, sleep } from './http.js'

const API_BASE = 'https://openapi.etsy.com/v3/application'

export class EtsyClient {
  constructor({ apiKey, limits = {}, fetchImpl = globalThis.fetch, logger = () => {} } = {}) {
    this.apiKey = apiKey
    this.limits = {
      etsyListingsPerKeyword: 100,
      etsyRequestDelayMs: 250,
      requestTimeoutMs: 20000,
      maxRetries: 3,
      ...limits,
    }
    this.fetchImpl = fetchImpl
    this.logger = logger
  }

  get configured() {
    return Boolean(this.apiKey)
  }

  async request(path, params = {}) {
    if (!this.configured) throw new Error('ETSY_API_KEY is not set')
    const url = new URL(`${API_BASE}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
    const response = await fetchWithRetry(url.toString(), {
      headers: { 'x-api-key': this.apiKey, Accept: 'application/json' },
      timeoutMs: this.limits.requestTimeoutMs,
      maxRetries: this.limits.maxRetries,
      fetchImpl: this.fetchImpl,
      onRetry: ({ attempt, waitMs }) =>
        this.logger(`etsy: retry ${attempt} for ${path} in ${waitMs}ms`),
    })
    await sleep(this.limits.etsyRequestDelayMs)
    return response.json()
  }

  async ping() {
    return this.request('/openapi-ping')
  }

  /**
   * Active listings for a keyword. `sortOn: 'created'` gives the newest
   * listings, which is what the seller-entry-rate signal needs.
   */
  async searchActiveListings(keyword, { limit, sortOn = 'created', sortOrder = 'desc' } = {}) {
    const payload = await this.request('/listings/active', {
      keywords: keyword,
      limit: Math.min(limit ?? this.limits.etsyListingsPerKeyword, 100),
      sort_on: sortOn,
      sort_order: sortOrder,
    })
    return {
      total: Number(payload?.count ?? 0),
      listings: Array.isArray(payload?.results) ? payload.results : [],
    }
  }
}

function priceToNumber(price) {
  if (!price) return null
  if (typeof price === 'number') return price
  const amount = Number(price.amount)
  const divisor = Number(price.divisor)
  if (!Number.isFinite(amount) || !Number.isFinite(divisor) || divisor === 0) return null
  return amount / divisor
}

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function percentile(values, p) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[index]
}

/**
 * Reduce a page of listings to the metrics we store daily.
 *
 * `newListings7d` / `newListings30d` are counts within the newest-first page,
 * so they measure how fast sellers are entering relative to the page window.
 * `sellerEntryRate` normalises that to "share of the newest 100 listings that
 * appeared in the last week" — comparable across niches of any size.
 */
export function summariseListings({ total, listings }, { now = new Date() } = {}) {
  const nowSec = Math.floor(now.getTime() / 1000)
  const week = 7 * 24 * 3600
  const month = 30 * 24 * 3600

  // Etsy returns each listing's price in the seller's own currency, so a median
  // taken across a mixed page is a number with no meaning. Prices are bucketed
  // by currency and only the dominant one is reported, with the mix recorded so
  // the caller can see how much was set aside.
  const pricesByCurrency = new Map()
  const tagCounts = new Map()
  let newListings7d = 0
  let newListings30d = 0
  let digitalCount = 0
  let personalisableCount = 0

  for (const listing of listings) {
    const price = priceToNumber(listing?.price)
    if (price !== null) {
      const currency = String(listing?.price?.currency_code ?? 'UNKNOWN').toUpperCase()
      if (!pricesByCurrency.has(currency)) pricesByCurrency.set(currency, [])
      pricesByCurrency.get(currency).push(price)
    }

    const created = Number(listing?.original_creation_timestamp ?? listing?.creation_timestamp ?? 0)
    if (created) {
      if (nowSec - created <= week) newListings7d += 1
      if (nowSec - created <= month) newListings30d += 1
    }

    if (listing?.listing_type === 'download' || listing?.is_digital) digitalCount += 1
    if (listing?.is_personalizable) personalisableCount += 1

    for (const tag of listing?.tags ?? []) {
      const key = String(tag).toLowerCase().trim()
      if (!key) continue
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1)
    }
  }

  const sampleSize = listings.length

  const currencyMix = Object.fromEntries(
    [...pricesByCurrency.entries()].map(([currency, values]) => [currency, values.length]),
  )
  const dominant = [...pricesByCurrency.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const prices = dominant ? dominant[1] : []
  const priceCurrency = dominant ? dominant[0] : null
  const pricedListings = [...pricesByCurrency.values()].reduce((sum, v) => sum + v.length, 0)

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25)
    .map(([tag, count]) => ({ tag, count }))

  return {
    totalListings: total,
    sampleSize,
    newListings7d,
    newListings30d,
    sellerEntryRate: sampleSize ? newListings7d / sampleSize : null,
    medianPrice: median(prices),
    p25Price: percentile(prices, 25),
    p75Price: percentile(prices, 75),
    priceCurrency,
    currencyMix,
    // Fraction of priced listings the median actually rests on. A low number
    // means the niche is split across currencies and the band is thin.
    priceCoverage: pricedListings ? prices.length / pricedListings : null,
    digitalShare: sampleSize ? digitalCount / sampleSize : null,
    personalisableShare: sampleSize ? personalisableCount / sampleSize : null,
    topTags,
  }
}

/** Collect one keyword's Etsy supply snapshot. Never throws: failures are recorded. */
export async function collectEtsyMetrics(client, keyword, { now = new Date() } = {}) {
  try {
    const page = await client.searchActiveListings(keyword)
    return { ok: true, ...summariseListings(page, { now }) }
  } catch (err) {
    return { ok: false, error: err.message, totalListings: null }
  }
}
