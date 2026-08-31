import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DEFAULT_CONFIG } from '../src/config.js'
import { runScan } from '../src/scan.js'

const TODAY = new Date('2026-08-31T00:00:00Z')

function withConfig(fn, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-scan-'))
  try {
    return fn({
      ...DEFAULT_CONFIG,
      etsyApiKey: 'test-key',
      dataDir: join(dir, 'data'),
      reportDir: join(dir, 'reports'),
      ...overrides,
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const okEtsy = {
  configured: true,
  async searchActiveListings() {
    return {
      total: 1234,
      listings: [
        {
          price: { amount: 2400, divisor: 100 },
          original_creation_timestamp: Math.floor(TODAY.getTime() / 1000) - 3600,
          tags: ['whimsigothic'],
          listing_type: 'download',
        },
      ],
    }
  },
}

const okSuggest = {
  async collect(term) {
    return {
      ok: true,
      suggestions: [
        { query: `${term} wall art`, rank: 0 },
        { query: `${term} bedroom`, rank: 1 },
      ],
    }
  },
}

const okTrends = {
  async collect(term) {
    return {
      ok: true,
      series: [{ date: '2026-08-01', value: 10 }],
      rising: [{ query: `${term} mirror`, value: 5000, breakout: true, formatted: 'Breakout' }],
      top: [],
    }
  },
}

test('a scan writes one snapshot row per keyword', async () => {
  await withConfig(async (config) => {
    const { snapshot, path, store } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      trendsClient: okTrends,
      suggestClient: okSuggest,
      only: ['whimsigothic', 'soy candle'],
    })

    assert.equal(snapshot.date, '2026-08-31')
    assert.deepEqual(Object.keys(snapshot.keywords), ['whimsigothic', 'soy candle'])
    assert.equal(snapshot.keywords.whimsigothic.etsy.totalListings, 1234)
    assert.equal(snapshot.keywords.whimsigothic.trends.rising.length, 1)
    assert.match(path, /2026-08-31\.json$/)
    assert.deepEqual(store.dates(), ['2026-08-31'])
  })
})

test('a scan records breakout queries as new keywords to watch', async () => {
  await withConfig(async (config) => {
    const { store } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      trendsClient: okTrends,
      suggestClient: okSuggest,
      only: ['whimsigothic'],
    })

    const discovered = store.readDiscovered()
    assert.equal(discovered[0].term, 'whimsigothic mirror')
    assert.equal(discovered[0].parent, 'whimsigothic')
    assert.equal(discovered[0].discoveredAt, '2026-08-31')
  })
})

test('a Google Trends outage still produces a usable snapshot', async () => {
  await withConfig(async (config) => {
    const { snapshot } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      trendsClient: { collect: async () => ({ ok: false, error: 'HTTP 429' }) },
      suggestClient: okSuggest,
      only: ['whimsigothic'],
    })

    assert.equal(snapshot.keywords.whimsigothic.etsy.totalListings, 1234)
    assert.equal(snapshot.keywords.whimsigothic.trends.ok, false)
    assert.match(snapshot.notes.join(' '), /rate limiting/)
  })
})

test('a missing Etsy key is reported in the snapshot rather than aborting', async () => {
  await withConfig(
    async (config) => {
      const { snapshot } = await runScan({
        config,
        today: TODAY,
        logger: () => {},
        trendsClient: okTrends,
        suggestClient: okSuggest,
        only: ['whimsigothic'],
      })

      assert.equal(snapshot.sources.etsy, false)
      assert.equal(snapshot.keywords.whimsigothic.etsy, undefined)
      assert.ok(snapshot.keywords.whimsigothic.trends.series.length > 0)
      assert.match(snapshot.notes.join(' '), /ETSY_API_KEY is not set/)
    },
    { etsyApiKey: '' },
  )
})

test('sources can be switched off individually', async () => {
  await withConfig(async (config) => {
    const { snapshot } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      useTrends: false,
      useSuggest: false,
      only: ['whimsigothic'],
    })
    assert.equal(snapshot.sources.googleTrends, false)
    assert.equal(snapshot.sources.autocomplete, false)
    assert.equal(snapshot.keywords.whimsigothic.trends, undefined)
    assert.equal(snapshot.keywords.whimsigothic.suggest, undefined)
    assert.equal(snapshot.notes.length, 0)
  })
})

test('the long tail gets its own Etsy lookup after the main pass', async () => {
  await withConfig(async (config) => {
    const looked = []
    const countingEtsy = {
      configured: true,
      async searchActiveListings(keyword) {
        looked.push(keyword)
        return {
          total: keyword.includes('wall art') ? 140 : 1234,
          listings: [{ price: { amount: 2400, divisor: 100 }, tags: ['whimsigothic'] }],
        }
      },
    }

    const { snapshot } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: countingEtsy,
      // Google's rising feed and autocomplete agree on the same phrase, which
      // is what makes it worth an extra lookup.
      trendsClient: {
        collect: async () => ({
          ok: true,
          series: [{ date: '2026-08-01', value: 10 }],
          rising: [
            { query: 'whimsigothic wall art', value: 5000, breakout: true, formatted: 'Breakout' },
          ],
          top: [],
        }),
      },
      suggestClient: okSuggest,
      only: ['whimsigothic'],
    })

    assert.ok(looked.includes('whimsigothic'), 'the niche itself is scanned')
    assert.ok(looked.includes('whimsigothic wall art'), 'and so is the long-tail phrase')

    const longTail = snapshot.longTail.find((row) => row.query === 'whimsigothic wall art')
    assert.equal(longTail.parent, 'whimsigothic')
    assert.equal(longTail.etsy.totalListings, 140)
    assert.equal(longTail.untagged, true, 'sellers here have not tagged it')
  })
})

test('the long tail is still listed when there is no Etsy key to price it', async () => {
  await withConfig(
    async (config) => {
      const { snapshot } = await runScan({
        config,
        today: TODAY,
        logger: () => {},
        trendsClient: okTrends,
        suggestClient: okSuggest,
        only: ['whimsigothic'],
      })
      assert.ok(snapshot.longTail.length > 0)
      assert.equal(snapshot.longTail[0].etsy, null)
    },
    { etsyApiKey: '' },
  )
})

test('related searches are merged and stored per keyword', async () => {
  await withConfig(async (config) => {
    const { snapshot } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      trendsClient: okTrends,
      suggestClient: okSuggest,
      only: ['whimsigothic'],
    })

    const related = snapshot.keywords.whimsigothic.related
    assert.ok(related.length > 0)
    assert.ok(related.some((row) => row.sources.includes('autocomplete')))
    assert.ok(related.some((row) => row.sources.includes('trendsRising')))
    assert.equal(snapshot.keywords.whimsigothic.suggest.suggestions.length, 2)
  })
})

test('the keyword cap is respected so a scan cannot run away with the API budget', async () => {
  await withConfig(async (config) => {
    const { snapshot } = await runScan({
      config,
      today: TODAY,
      logger: () => {},
      etsyClient: okEtsy,
      trendsClient: okTrends,
      suggestClient: okSuggest,
      limit: 3,
    })
    assert.equal(Object.keys(snapshot.keywords).length, 3)
  })
})
