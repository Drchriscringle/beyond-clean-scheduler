import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseGuardedJson } from '../src/sources/http.js'
import {
  parseRelatedQueries,
  parseTimeline,
  parseWidgets,
  TrendsClient,
} from '../src/sources/googleTrends.js'
import { EtsyClient, collectEtsyMetrics, median, percentile, summariseListings } from '../src/sources/etsy.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const fixture = (name) => readFileSync(join(fixtures, name), 'utf8')

test('parseGuardedJson strips Google’s anti-hijacking prefix', () => {
  assert.deepEqual(parseGuardedJson(")]}',\n{\"a\":1}"), { a: 1 })
  assert.deepEqual(parseGuardedJson(")]}'\n{\"a\":1}"), { a: 1 })
  assert.throws(() => parseGuardedJson('not json'), /No JSON object/)
})

test('parseWidgets keys widgets by family, dropping the numeric suffix', () => {
  const widgets = parseWidgets(fixture('trends-explore.txt'))
  assert.equal(widgets.TIMESERIES.token, 'TOKEN_TIMESERIES')
  assert.equal(widgets.RELATED_QUERIES.token, 'TOKEN_RELATED')
  assert.ok(widgets.RELATED_TOPICS)
})

test('parseTimeline drops the partial trailing week', () => {
  const series = parseTimeline(fixture('trends-multiline.txt'))
  assert.equal(series.length, 4, 'the isPartial point must be excluded')
  assert.deepEqual(
    series.map((row) => row.value),
    [12, 15, 41, 88],
  )
  assert.match(series[0].date, /^\d{4}-\d{2}-\d{2}$/)
})

test('parseRelatedQueries separates top from rising and marks breakouts', () => {
  const { top, rising } = parseRelatedQueries(fixture('trends-related.txt'))
  assert.equal(top.length, 2)
  assert.equal(rising.length, 2, 'the empty-query row must be dropped')
  assert.equal(rising[0].query, 'whimsigothic wall art')
  assert.equal(rising[0].breakout, true)
  assert.equal(rising[1].breakout, false)
  assert.equal(rising[1].formatted, '+900%')
})

test('TrendsClient.collect reports failure instead of throwing', async () => {
  const client = new TrendsClient({
    limits: { trendsRequestDelayMs: 0, maxRetries: 0, requestTimeoutMs: 100 },
    fetchImpl: async () => {
      throw new Error('network down')
    },
  })
  const result = await client.collect('anything')
  assert.equal(result.ok, false)
  assert.match(result.error, /network down/)
})

test('TrendsClient.collect assembles a snapshot from the widget responses', async () => {
  const responses = {
    explore: fixture('trends-explore.txt'),
    multiline: fixture('trends-multiline.txt'),
    relatedsearches: fixture('trends-related.txt'),
  }
  const client = new TrendsClient({
    limits: { trendsRequestDelayMs: 0, maxRetries: 0, requestTimeoutMs: 100 },
    fetchImpl: async (url) => {
      const key = Object.keys(responses).find((name) => String(url).includes(name)) ?? 'explore'
      return {
        ok: true,
        headers: { getSetCookie: () => [] },
        text: async () => responses[key],
      }
    },
  })

  const result = await client.collect('whimsigothic')
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 4)
  assert.equal(result.rising[0].query, 'whimsigothic wall art')
})

test('median and percentile ignore non-numeric entries', () => {
  assert.equal(median([]), null)
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
  assert.equal(median([1, NaN, 3]), 2)
  assert.equal(percentile([1, 2, 3, 4, 5], 25), 2)
  assert.equal(percentile([1, 2, 3, 4, 5], 75), 4)
})

test('summariseListings reduces a listing page to storable metrics', () => {
  const payload = JSON.parse(fixture('etsy-listings.json'))
  const summary = summariseListings(
    { total: payload.count, listings: payload.results },
    { now: new Date('2026-08-31T00:00:00Z') },
  )

  assert.equal(summary.totalListings, 2518)
  assert.equal(summary.sampleSize, 4)
  // Two listings were created within the week before 2026-08-31.
  assert.equal(summary.newListings7d, 2)
  assert.equal(summary.sellerEntryRate, 0.5)
  // The zero-divisor price must be discarded rather than becoming Infinity.
  assert.equal(summary.medianPrice, 24)
  assert.equal(summary.digitalShare, 0.25)
  assert.equal(summary.personalisableShare, 0.25)
  assert.equal(summary.topTags[0].tag, 'whimsigothic')
  assert.equal(summary.topTags[0].count, 3)
})

test('a median is never taken across mixed currencies', () => {
  const listings = [
    { price: { amount: 1000, divisor: 100, currency_code: 'GBP' }, tags: [] },
    { price: { amount: 2000, divisor: 100, currency_code: 'GBP' }, tags: [] },
    { price: { amount: 3000, divisor: 100, currency_code: 'GBP' }, tags: [] },
    // A single USD listing must not drag the GBP median.
    { price: { amount: 90000, divisor: 100, currency_code: 'USD' }, tags: [] },
  ]
  const summary = summariseListings({ total: 4, listings })

  assert.equal(summary.priceCurrency, 'GBP', 'the dominant currency wins')
  assert.equal(summary.medianPrice, 20, 'the USD outlier is excluded, not averaged in')
  assert.deepEqual(summary.currencyMix, { GBP: 3, USD: 1 })
  assert.equal(summary.priceCoverage, 0.75)
})

test('an all-one-currency page reports full price coverage', () => {
  const listings = [
    { price: { amount: 1000, divisor: 100, currency_code: 'GBP' }, tags: [] },
    { price: { amount: 3000, divisor: 100, currency_code: 'GBP' }, tags: [] },
  ]
  const summary = summariseListings({ total: 2, listings })
  assert.equal(summary.priceCoverage, 1)
  assert.equal(summary.medianPrice, 20)
})

test('a page with no usable prices reports no currency rather than guessing', () => {
  const summary = summariseListings({ total: 1, listings: [{ tags: [] }] })
  assert.equal(summary.priceCurrency, null)
  assert.equal(summary.medianPrice, null)
  assert.equal(summary.priceCoverage, null)
})

test('EtsyClient refuses to call the API without a key', async () => {
  const client = new EtsyClient({})
  assert.equal(client.configured, false)
  await assert.rejects(() => client.ping(), /ETSY_API_KEY/)
})

test('EtsyClient sends the key as a header and parses the listing page', async () => {
  let seenUrl
  let seenHeaders
  const client = new EtsyClient({
    apiKey: 'test-key',
    limits: { etsyRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async (url, init) => {
      seenUrl = String(url)
      seenHeaders = init.headers
      return { ok: true, json: async () => JSON.parse(fixture('etsy-listings.json')) }
    },
  })

  const page = await client.searchActiveListings('whimsigothic')
  assert.equal(seenHeaders['x-api-key'], 'test-key')
  assert.match(seenUrl, /listings\/active/)
  assert.match(seenUrl, /keywords=whimsigothic/)
  assert.match(seenUrl, /sort_on=created/)
  assert.equal(page.total, 2518)
  assert.equal(page.listings.length, 4)
})

test('collectEtsyMetrics records an API failure rather than aborting the scan', async () => {
  const client = new EtsyClient({
    apiKey: 'k',
    limits: { etsyRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'forbidden' }),
  })
  const result = await collectEtsyMetrics(client, 'anything')
  assert.equal(result.ok, false)
  assert.match(result.error, /403/)
  assert.equal(result.totalListings, null)
})
