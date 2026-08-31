import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CLASSES, competitionScore, priceScore, scoreKeyword } from '../src/analyze/score.js'
import { DEFAULT_CONFIG } from '../src/config.js'

const TODAY = new Date('2026-08-31T00:00:00Z')
const config = { ...DEFAULT_CONFIG, etsyApiKey: '' }

function climbingSeries({ from = 8, to = 100, points = 52 } = {}) {
  // Flat for most of the year, then a sharp recent climb.
  return Array.from({ length: points }, (_, i) => ({
    date: `2026-01-01`,
    value: i < points - 8 ? from : Math.round(from + ((to - from) * (i - (points - 9))) / 8),
  }))
}

function flatSeries(value = 50, points = 52) {
  return Array.from({ length: points }, () => ({ date: '2026-01-01', value }))
}

function historyOf(totals) {
  return totals.map((total, i) => ({
    date: `2026-08-${String(i * 7 + 1).padStart(2, '0')}`,
    etsy: { totalListings: total },
  }))
}

test('competitionScore is calibrated across the range Etsy niches actually occupy', () => {
  assert.equal(competitionScore(undefined), null)
  assert.ok(competitionScore(500) > 85)
  assert.ok(competitionScore(10_000) > 50 && competitionScore(10_000) < 65)
  assert.ok(competitionScore(1_000_000) < 15)
  // Monotonically decreasing.
  assert.ok(competitionScore(2_000) > competitionScore(20_000))
  assert.ok(competitionScore(20_000) > competitionScore(200_000))
})

test('priceScore rejects niches below the fee floor', () => {
  assert.equal(priceScore(3, { minMedianPrice: 8 }), 0)
  assert.ok(priceScore(45, { minMedianPrice: 8 }) > priceScore(12, { minMedianPrice: 8 }))
  assert.equal(priceScore(null), null)
})

test('a fast-rising, thinly-listed niche is classed as starting to trend', () => {
  const result = scoreKeyword({
    term: 'whimsigothic',
    etsy: {
      totalListings: 2500,
      medianPrice: 24,
      p25Price: 14,
      p75Price: 38,
      sellerEntryRate: 0.03,
      digitalShare: 0.5,
      topTags: [{ tag: 'whimsigothic', count: 30 }],
    },
    trends: {
      series: climbingSeries(),
      rising: [{ query: 'whimsigothic mirror', value: 5000, breakout: true, formatted: 'Breakout' }],
    },
    history: historyOf([2400, 2440, 2480, 2500]),
    config,
    today: TODAY,
  })

  assert.equal(result.classification, CLASSES.EARLY)
  assert.ok(result.opportunity > 65, `expected a strong score, got ${result.opportunity}`)
  assert.equal(result.confidence, 'high')
})

test('a huge niche filling up fast is classed as saturated', () => {
  const result = scoreKeyword({
    term: 'tumbler wrap png',
    etsy: { totalListings: 120_000, medianPrice: 5, sellerEntryRate: 0.25 },
    trends: { series: flatSeries(60).map((row, i) => ({ ...row, value: Math.max(4, 95 - i * 1.6) })) },
    history: historyOf([90_000, 100_000, 112_000, 125_000]),
    config,
    today: TODAY,
  })

  assert.equal(result.classification, CLASSES.SATURATED)
  assert.ok(result.opportunity < 40)
})

test('scoring survives a total absence of Etsy data', () => {
  const result = scoreKeyword({
    term: 'cottagecore',
    etsy: {},
    trends: { series: climbingSeries() },
    config,
    today: TODAY,
  })

  assert.notEqual(result.opportunity, null)
  assert.ok(result.missing.includes('competitionGap'))
  assert.notEqual(result.confidence, 'high')
})

test('scoring survives a total absence of demand data', () => {
  const result = scoreKeyword({
    term: 'soy candle',
    etsy: { totalListings: 40_000, medianPrice: 26, sellerEntryRate: 0.04 },
    trends: {},
    config,
    today: TODAY,
  })

  assert.notEqual(result.opportunity, null)
  assert.ok(result.missing.includes('demand'))
})

test('a keyword with no signal at all is reported as such rather than scored', () => {
  const result = scoreKeyword({ term: 'nothing here', etsy: {}, trends: {}, config, today: TODAY })
  assert.equal(result.classification, CLASSES.UNKNOWN)
})

test('an absent seasonal occasion is not counted as a missing signal', () => {
  const result = scoreKeyword({
    term: 'macrame wall hanging',
    etsy: { totalListings: 30_000, medianPrice: 40, sellerEntryRate: 0.03 },
    trends: { series: flatSeries(50) },
    config,
    today: TODAY,
  })
  assert.equal(result.parts.seasonalFit, null)
  assert.ok(!result.missing.includes('seasonalFit'))
})

test('evidence explains the numbers behind the score', () => {
  const result = scoreKeyword({
    term: 'sourdough gift',
    etsy: { totalListings: 9_737, medianPrice: 29, p25Price: 18, p75Price: 45, sellerEntryRate: 0.05 },
    trends: {
      series: climbingSeries(),
      rising: [{ query: 'sourdough starter gift', value: 5000, breakout: true, formatted: 'Breakout' }],
    },
    history: historyOf([8_900, 9_200, 9_500, 9_737]),
    config,
    today: TODAY,
  })

  const text = result.evidence.join('\n')
  assert.match(text, /9,737 active Etsy listings/)
  assert.match(text, /Median asking price \$29\.00/)
  assert.match(text, /People also search for: "sourdough starter gift" \(breakout\)/)
  assert.match(text, /Competing listings \+\d+% in \d+ days/)
})

test('the raw rising feed is only reported when nothing merged', () => {
  // These rising queries are all filtered out by the related merge (too short,
  // or a marketplace name), so the term falls back to Google's raw rising list.
  const result = scoreKeyword({
    term: 'whimsigothic',
    etsy: { totalListings: 2500 },
    trends: {
      series: climbingSeries(),
      rising: [
        { query: 'mug', value: 5000, breakout: true, formatted: 'Breakout' },
        { query: 'etsy', value: 900, formatted: '+900%' },
      ],
    },
    config,
    today: TODAY,
  })
  const line = result.evidence.find((row) => row.includes('breakout'))
  assert.match(line, /^1 breakout related search on Google/)
})
