/**
 * Open-ended trend discovery — the sources that are not seeded by anything.
 *
 * Everything else in this tool answers "how is this niche doing?". These
 * sources answer "what is happening?", with no keyword supplied at all. That
 * distinction is the whole point: a seeded scanner can only ever find trends
 * adjacent to the list someone wrote in advance, so it structurally cannot see
 * the thing nobody thought to watch for.
 *
 * Two feeds, chosen because they are genuinely unseeded and independent of
 * each other:
 *
 *   Google trending searches  what people are searching *today*, ranked by
 *                             traffic. Catches a trend the moment it becomes
 *                             a search, which is the earliest it exists.
 *   Wikipedia pageview spikes what people are suddenly reading about. Slower
 *                             than search but far less noisy, and it surfaces
 *                             the cultural moment behind a trend — a show, a
 *                             character, a person — rather than the headline.
 *
 * Neither is filtered for commerce here. Most of what trends on any given day
 * is news, sport or weather and cannot be sold at all; screening that out is
 * `analyze/sellable.js`, deliberately kept separate so the harvest stays
 * honest about what it saw.
 */

import { fetchWithRetry, sleep } from './http.js'

const TRENDING_RSS = 'https://trends.google.com/trending/rss'
const WIKI_TOP = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top'

const USER_AGENT =
  'etsy-trend-scanner/0.1 (https://github.com/Drchriscringle/beyond-clean-scheduler)'

/* ------------------------------------------------------------------ *
 * Minimal XML reading.
 *
 * The trending feed is a small, well-formed RSS document with a fixed shape,
 * so a targeted extractor beats taking on an XML parser dependency. It is not
 * a general XML parser and is not used as one.
 * ------------------------------------------------------------------ */

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
}

export function decodeXmlText(value) {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .trim()
}

/** Inner content of every `<tag>...</tag>` block, in document order. */
export function extractBlocks(xml, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
  return [...String(xml ?? '').matchAll(pattern)].map((match) => match[1])
}

/** Text of the first `<tag>` in a block, or null. Self-closing tags yield null. */
export function extractTag(xml, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(String(xml ?? ''))
  return match ? decodeXmlText(match[1]) : null
}

/** "500,000+" -> 500000. Google only ever reports these as rounded bands. */
export function parseApproxTraffic(value) {
  if (!value) return null
  const digits = String(value).replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

/**
 * Parse the Google trending-searches RSS feed.
 *
 * Shape (namespace ht = trends.google.com/trends/trendingsearches/daily):
 *   <item>
 *     <title>whimsigothic</title>
 *     <ht:approx_traffic>20,000+</ht:approx_traffic>
 *     <pubDate>...</pubDate>
 *     <ht:news_item><ht:news_item_title>...</ht:news_item_title>...</ht:news_item>
 *   </item>
 *
 * The news headlines matter as much as the term: they are the cheapest way to
 * tell whether "Cardinals" is a bird, a sports fixture or a papal conclave.
 */
export function parseTrendingRss(xml) {
  return extractBlocks(xml, 'item')
    .map((item) => {
      const term = extractTag(item, 'title')
      if (!term) return null
      const headlines = extractBlocks(item, 'ht:news_item')
        .map((block) => extractTag(block, 'ht:news_item_title'))
        .filter(Boolean)
      return {
        term,
        source: 'google-trending',
        traffic: parseApproxTraffic(extractTag(item, 'ht:approx_traffic')),
        publishedAt: extractTag(item, 'pubDate'),
        headlines,
        // The feed's own description sometimes carries the related queries.
        context: extractTag(item, 'description') || null,
      }
    })
    .filter(Boolean)
}

/** Wikipedia namespaces and housekeeping pages that are never a trend. */
const WIKI_NON_ARTICLE =
  /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|Category:|File:|Template:|Talk:|User:|Draft:)/i

export function normaliseWikiTitle(article) {
  return String(article ?? '')
    .replace(/_/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/, '') // drop the disambiguator: "Wicked (film)"
    .trim()
}

/**
 * Rank movement between two days of Wikipedia's most-viewed list.
 *
 * Comparing against the same weekday a week back rather than yesterday keeps
 * the weekly reading rhythm from reading as a spike, and articles absent from
 * the earlier list entirely are the strongest signal there is — something
 * arrived from nowhere.
 */
export function wikipediaSpikes(todayArticles = [], baselineArticles = [], { limit = 40 } = {}) {
  const baselineRank = new Map()
  for (const row of baselineArticles) {
    baselineRank.set(row.article, row.rank)
  }

  const rows = []
  for (const row of todayArticles) {
    if (WIKI_NON_ARTICLE.test(row.article)) continue
    const term = normaliseWikiTitle(row.article)
    if (!term || term.length < 3) continue

    const before = baselineRank.get(row.article)
    const isNew = before === undefined

    // An article absent from last week's list entirely is treated as its own
    // category rather than as a very large rank climb. Expressing it as a climb
    // would make the score depend on how long the baseline list happened to be,
    // which is an artefact of the request, not of the trend.
    if (!isNew && before - row.rank <= 0) continue

    rows.push({
      term,
      source: 'wikipedia',
      views: row.views,
      rank: row.rank,
      priorRank: isNew ? null : before,
      climb: isNew ? null : before - row.rank,
      isNew,
      article: row.article,
    })
  }

  // Arrivals from nowhere first, then the biggest climbers.
  return rows
    .sort(
      (a, b) =>
        Number(b.isNew) - Number(a.isNew) ||
        (b.climb ?? 0) - (a.climb ?? 0) ||
        b.views - a.views,
    )
    .slice(0, limit)
}

export class TrendingClient {
  constructor({
    geo = 'US',
    language = 'en-US',
    limits = {},
    fetchImpl = globalThis.fetch,
    logger = () => {},
  } = {}) {
    this.geo = geo
    this.language = language
    this.limits = {
      trendingRequestDelayMs: 500,
      requestTimeoutMs: 20000,
      maxRetries: 2,
      ...limits,
    }
    this.fetchImpl = fetchImpl
    this.logger = logger
  }

  async getText(url) {
    const response = await fetchWithRetry(url, {
      headers: { Accept: 'application/xml, text/xml, application/json, */*', 'User-Agent': USER_AGENT },
      timeoutMs: this.limits.requestTimeoutMs,
      maxRetries: this.limits.maxRetries,
      fetchImpl: this.fetchImpl,
      onRetry: ({ attempt, waitMs }) => this.logger(`trending: retry ${attempt} in ${waitMs}ms`),
    })
    await sleep(this.limits.trendingRequestDelayMs)
    return response.text()
  }

  /** Today's trending searches for the configured market. */
  async googleTrending() {
    try {
      const xml = await this.getText(`${TRENDING_RSS}?geo=${encodeURIComponent(this.geo)}`)
      const rows = parseTrendingRss(xml)
      if (rows.length === 0) return { ok: false, error: 'trending feed returned no items', rows: [] }
      return { ok: true, rows }
    } catch (err) {
      return { ok: false, error: err.message, rows: [] }
    }
  }

  async wikipediaTop(date) {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const project = this.language.toLowerCase().startsWith('en') ? 'en.wikipedia.org' : 'en.wikipedia.org'
    const payload = JSON.parse(
      await this.getText(`${WIKI_TOP}/${project}/all-access/${year}/${month}/${day}`),
    )
    return payload?.items?.[0]?.articles ?? []
  }

  /**
   * Wikipedia articles climbing hardest against the same weekday a week ago.
   *
   * Yesterday rather than today, because the current day's pageview totals are
   * still accumulating and the ranking is not stable until the day closes.
   */
  async wikipediaTrending(today = new Date()) {
    const DAY = 24 * 3600 * 1000
    try {
      const [current, baseline] = await Promise.all([
        this.wikipediaTop(new Date(today.getTime() - DAY)),
        this.wikipediaTop(new Date(today.getTime() - 8 * DAY)),
      ])
      const rows = wikipediaSpikes(current, baseline)
      if (rows.length === 0) return { ok: false, error: 'no pageview spikes found', rows: [] }
      return { ok: true, rows }
    } catch (err) {
      return { ok: false, error: err.message, rows: [] }
    }
  }

  /**
   * Everything trending right now, from every unseeded feed, merged.
   *
   * A term both feeds surface is a strong signal — people are searching it and
   * reading about it — so cross-feed agreement is recorded rather than
   * de-duplicated away.
   */
  async collect(today = new Date()) {
    const [google, wiki] = await Promise.all([this.googleTrending(), this.wikipediaTrending(today)])

    const merged = new Map()
    const add = (row) => {
      const key = row.term.toLowerCase()
      const prior = merged.get(key)
      if (prior) {
        prior.sources.push(row.source)
        prior.traffic = prior.traffic ?? row.traffic
        prior.views = prior.views ?? row.views
        prior.headlines = [...(prior.headlines ?? []), ...(row.headlines ?? [])]
        return
      }
      merged.set(key, { ...row, sources: [row.source] })
    }

    for (const row of google.rows) add(row)
    for (const row of wiki.rows) add(row)

    return {
      ok: google.ok || wiki.ok,
      candidates: [...merged.values()],
      errors: [
        google.ok ? null : `google trending: ${google.error}`,
        wiki.ok ? null : `wikipedia: ${wiki.error}`,
      ].filter(Boolean),
    }
  }
}
