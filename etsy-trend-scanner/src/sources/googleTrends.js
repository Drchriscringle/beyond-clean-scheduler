/**
 * Google Trends collector — the demand-side signal.
 *
 * Etsy publishes no public demand data, so search interest is the best proxy
 * available for "are people looking for this". Two things are pulled per
 * keyword:
 *
 *   interest over time  - the 12-month curve, which gives us level, slope and
 *                         a like-for-like week-over-week comparison.
 *   rising queries      - Google's own "breakout" list for the term. This is
 *                         the single best *pre-trend* signal in the whole
 *                         tool: rising queries are searches growing fast off a
 *                         small base, which is exactly the window where a new
 *                         Etsy listing can still rank.
 *
 * Caveat worth knowing: this is Google's internal widget API, not a supported
 * public one. It rate-limits aggressively (HTTP 429) and its response shape
 * can change without notice. Every failure here is non-fatal — the scan
 * records it and the report degrades to Etsy supply data plus the seasonal
 * calendar rather than dying.
 */

import { fetchWithRetry, parseGuardedJson, sleep } from './http.js'

const TRENDS_BASE = 'https://trends.google.com/trends/api'

export function parseWidgets(text) {
  const payload = parseGuardedJson(text)
  const widgets = Array.isArray(payload?.widgets) ? payload.widgets : []
  const byId = {}
  for (const widget of widgets) {
    if (!widget?.id) continue
    // Ids look like 'TIMESERIES', 'RELATED_QUERIES_0'. Keep the first of each family.
    const family = widget.id.replace(/_\d+$/, '')
    if (!byId[family]) byId[family] = widget
  }
  return byId
}

export function parseTimeline(text) {
  const payload = parseGuardedJson(text)
  const rows = payload?.default?.timelineData ?? []
  return rows
    .filter((row) => !row?.isPartial)
    .map((row) => ({
      date: new Date(Number(row.time) * 1000).toISOString().slice(0, 10),
      value: Number(row?.value?.[0] ?? 0),
    }))
    .filter((row) => Number.isFinite(row.value))
}

export function parseRelatedQueries(text) {
  const payload = parseGuardedJson(text)
  const lists = payload?.default?.rankedList ?? []
  const read = (index) =>
    (lists[index]?.rankedKeyword ?? []).map((row) => ({
      query: String(row?.query ?? '').trim(),
      value: Number(row?.value ?? 0),
      // Google reports growth over 5000% as the string 'Breakout'.
      breakout: String(row?.formattedValue ?? '').toLowerCase().includes('breakout'),
      formatted: String(row?.formattedValue ?? ''),
    }))
      .filter((row) => row.query)

  return { top: read(0), rising: read(1) }
}

export class TrendsClient {
  constructor({
    geo = 'US',
    language = 'en-US',
    limits = {},
    fetchImpl = globalThis.fetch,
    logger = () => {},
  } = {}) {
    this.geo = geo
    this.language = language
    this.limits = { trendsRequestDelayMs: 1500, requestTimeoutMs: 20000, maxRetries: 3, ...limits }
    this.fetchImpl = fetchImpl
    this.logger = logger
    this.cookie = ''
    this.tz = new Date().getTimezoneOffset()
  }

  /** Trends hands out an NID cookie on first contact; without it we get 429s sooner. */
  async ensureCookie() {
    if (this.cookie) return this.cookie
    try {
      const response = await fetchWithRetry(`https://trends.google.com/?geo=${this.geo}`, {
        timeoutMs: this.limits.requestTimeoutMs,
        maxRetries: 1,
        fetchImpl: this.fetchImpl,
      })
      const setCookie = response.headers?.getSetCookie?.() ?? []
      this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
    } catch {
      this.cookie = ''
    }
    return this.cookie
  }

  async getText(url) {
    await this.ensureCookie()
    const response = await fetchWithRetry(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': this.language,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      timeoutMs: this.limits.requestTimeoutMs,
      maxRetries: this.limits.maxRetries,
      fetchImpl: this.fetchImpl,
      onRetry: ({ attempt, waitMs }) => this.logger(`trends: retry ${attempt} in ${waitMs}ms`),
    })
    await sleep(this.limits.trendsRequestDelayMs)
    return response.text()
  }

  async explore(keyword, { timeframe = 'today 12-m' } = {}) {
    const req = {
      comparisonItem: [{ keyword, geo: this.geo, time: timeframe }],
      category: 0,
      property: '',
    }
    const url =
      `${TRENDS_BASE}/explore?hl=${encodeURIComponent(this.language)}&tz=${this.tz}` +
      `&req=${encodeURIComponent(JSON.stringify(req))}`
    return parseWidgets(await this.getText(url))
  }

  async widgetData(widget, endpoint) {
    const url =
      `${TRENDS_BASE}/widgetdata/${endpoint}?hl=${encodeURIComponent(this.language)}` +
      `&tz=${this.tz}&req=${encodeURIComponent(JSON.stringify(widget.request))}` +
      `&token=${encodeURIComponent(widget.token)}`
    return this.getText(url)
  }

  /** Full demand snapshot for one keyword. Returns `{ok:false}` rather than throwing. */
  async collect(keyword) {
    try {
      const widgets = await this.explore(keyword)
      const result = { ok: true, series: [], rising: [], top: [] }

      if (widgets.TIMESERIES) {
        result.series = parseTimeline(await this.widgetData(widgets.TIMESERIES, 'multiline'))
      }
      if (widgets.RELATED_QUERIES) {
        const related = parseRelatedQueries(
          await this.widgetData(widgets.RELATED_QUERIES, 'relatedsearches'),
        )
        result.rising = related.rising
        result.top = related.top
      }
      if (result.series.length === 0 && result.rising.length === 0) {
        return { ok: false, error: 'no data returned (term may be too niche for Google Trends)' }
      }
      return result
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }
}
