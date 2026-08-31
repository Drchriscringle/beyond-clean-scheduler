import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  dampSaturation,
  entryRateScore,
  linearSlope,
  pctChange,
  risingBoost,
  seriesMomentum,
  squash,
  supplyMomentum,
} from '../src/analyze/momentum.js'

test('linearSlope measures direction and magnitude', () => {
  assert.equal(linearSlope([1, 2, 3, 4]), 1)
  assert.equal(linearSlope([4, 3, 2, 1]), -1)
  assert.equal(linearSlope([5, 5, 5, 5]), 0)
  assert.equal(linearSlope([7]), 0, 'a single point has no slope')
})

test('pctChange handles a zero baseline without dividing by zero', () => {
  assert.equal(pctChange(10, 5), 1)
  assert.equal(pctChange(5, 10), -0.5)
  assert.equal(pctChange(3, 0), 1)
  assert.equal(pctChange(0, 0), 0)
  assert.equal(pctChange(1, NaN), null)
})

test('squash is centred on 50 and monotonic', () => {
  assert.equal(squash(0), 50)
  assert.ok(squash(1) > squash(0))
  assert.ok(squash(-1) < squash(0))
  assert.ok(squash(100) <= 100 && squash(-100) >= 0)
})

test('seriesMomentum separates a climbing term from a flat one', () => {
  const flat = Array.from({ length: 40 }, () => 50)
  const climbing = [...Array.from({ length: 30 }, () => 10), 20, 30, 45, 60, 70, 80, 88, 95, 99, 100]

  const flatResult = seriesMomentum(flat)
  const climbingResult = seriesMomentum(climbing)

  assert.equal(flatResult.score, 50, 'no change reads as neutral')
  assert.ok(climbingResult.score > 85, `expected a strong score, got ${climbingResult.score}`)
  assert.ok(climbingResult.growth > 1)
})

test('seriesMomentum reports low confidence on short series and none on empty', () => {
  assert.equal(seriesMomentum([]).score, null)
  assert.equal(seriesMomentum([]).confidence, 'none')
  assert.equal(seriesMomentum([1, 2, 3]).confidence, 'none', 'under four points is unusable')
  assert.equal(seriesMomentum([10, 12, 11, 13, 14, 15]).confidence, 'low')
})

test('seriesMomentum accepts both raw numbers and {value} rows', () => {
  const raw = [10, 12, 14, 16, 20, 26, 30, 34]
  const rows = raw.map((value, i) => ({ date: `2026-01-0${i + 1}`, value }))
  assert.equal(seriesMomentum(raw).score, seriesMomentum(rows).score)
})

test('seriesMomentum compares against the immediately prior window, not the year', () => {
  // Spiked a year ago, flat since. Should not read as currently rising.
  const series = [100, 95, 90, ...Array.from({ length: 30 }, () => 20)]
  assert.ok(seriesMomentum(series).score <= 55)
})

test('risingBoost rewards breakouts', () => {
  assert.equal(risingBoost([]).score, 0)
  const modest = risingBoost([{ query: 'a', value: 120, formatted: '+120%' }])
  const breakout = risingBoost([{ query: 'a', value: 5000, breakout: true, formatted: 'Breakout' }])
  assert.ok(breakout.score > modest.score)
  assert.equal(breakout.breakouts, 1)
})

test('supplyMomentum needs at least two dated points', () => {
  assert.equal(supplyMomentum([]).score, null)
  assert.equal(supplyMomentum([{ date: '2026-01-01', etsy: { totalListings: 100 } }]).score, null)
})

test('supplyMomentum flags sellers piling in and stays calm on normal churn', () => {
  const history = (values) =>
    values.map((total, i) => ({
      date: `2026-0${i + 1}-01`.replace(/-0(\d\d)-/, '-$1-'),
      etsy: { totalListings: total },
    }))

  const rush = supplyMomentum([
    { date: '2026-08-01', etsy: { totalListings: 10000 } },
    { date: '2026-08-29', etsy: { totalListings: 14000 } },
  ])
  const churn = supplyMomentum([
    { date: '2026-08-01', etsy: { totalListings: 10000 } },
    { date: '2026-08-29', etsy: { totalListings: 10500 } },
  ])

  assert.ok(rush.score > 80, `gold rush should score high, got ${rush.score}`)
  assert.ok(churn.score < 55, `background churn should be near neutral, got ${churn.score}`)
  assert.equal(rush.days, 28)
  assert.equal(history([1, 2]).length, 2)
})

test('dampSaturation ignores percentage growth from a tiny base', () => {
  // Same 74% growth, wildly different meaning.
  assert.ok(dampSaturation(100, 580) < 55, 'a 580-listing niche cannot be crowded')
  assert.equal(dampSaturation(100, 125_000), 100, 'a 125k-listing niche is taken at face value')

  // Neutral readings stay neutral at any size.
  assert.equal(dampSaturation(50, 300), 50)
  assert.equal(dampSaturation(50, 500_000), 50)

  // Monotonic in niche size.
  assert.ok(dampSaturation(90, 1_000) < dampSaturation(90, 20_000))

  // Missing inputs pass straight through.
  assert.equal(dampSaturation(null, 1000), null)
  assert.equal(dampSaturation(80, undefined), 80)
})

test('entryRateScore turns share-of-new-listings into a crowding score', () => {
  assert.equal(entryRateScore(undefined), null)
  assert.ok(entryRateScore(0.02) < 50)
  assert.ok(entryRateScore(0.2) > 80)
})
