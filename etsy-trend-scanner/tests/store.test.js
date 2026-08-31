import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SnapshotStore } from '../src/store.js'
import { buildKeywordUniverse, formsForProfile, isUsableTerm, normaliseTerm } from '../src/keywords.js'
import { harvestDiscoveries } from '../src/scan.js'

function withStore(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-test-'))
  try {
    return fn(new SnapshotStore(dir), dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('snapshots round-trip and list in date order', () => {
  withStore((store) => {
    assert.deepEqual(store.dates(), [])
    assert.equal(store.latest(), null)

    store.save({ date: '2026-08-02', keywords: { candle: { etsy: { totalListings: 2 } } } })
    store.save({ date: '2026-08-01', keywords: { candle: { etsy: { totalListings: 1 } } } })

    assert.deepEqual(store.dates(), ['2026-08-01', '2026-08-02'])
    assert.equal(store.latest().date, '2026-08-02')
    assert.equal(store.load('2026-08-01').keywords.candle.etsy.totalListings, 1)
    assert.equal(store.load('2026-01-01'), null)
  })
})

test('seriesFor skips days a keyword was not scanned', () => {
  withStore((store) => {
    store.save({ date: '2026-08-01', keywords: { candle: { etsy: { totalListings: 1 } } } })
    store.save({ date: '2026-08-02', keywords: { mug: { etsy: { totalListings: 9 } } } })
    store.save({ date: '2026-08-03', keywords: { candle: { etsy: { totalListings: 3 } } } })

    const series = store.seriesFor('candle')
    assert.deepEqual(
      series.map((row) => row.date),
      ['2026-08-01', '2026-08-03'],
    )
  })
})

test('history is capped to the requested number of days, newest kept', () => {
  withStore((store) => {
    for (let day = 1; day <= 10; day += 1) {
      store.save({ date: `2026-08-${String(day).padStart(2, '0')}`, keywords: {} })
    }
    const history = store.history(3)
    assert.equal(history.length, 3)
    assert.equal(history[0].date, '2026-08-08')
    assert.equal(history[2].date, '2026-08-10')
  })
})

test('discovered keywords keep their original discovery date across merges', () => {
  withStore((store) => {
    store.mergeDiscovered([{ term: 'whimsigothic mirror' }], { today: '2026-08-01' })
    store.mergeDiscovered([{ term: 'whimsigothic mirror' }, { term: 'wavy mirror' }], {
      today: '2026-08-09',
    })

    const rows = store.readDiscovered()
    const first = rows.find((row) => row.term === 'whimsigothic mirror')
    assert.equal(first.discoveredAt, '2026-08-01', 'age is what proves a trend has legs')
    assert.equal(first.lastSeenAt, '2026-08-09')
    assert.equal(first.hits, 2)
    assert.equal(rows.length, 2)
  })
})

test('a corrupt store file degrades to empty rather than throwing', () => {
  withStore((store, dir) => {
    store.save({ date: '2026-08-01', keywords: {} })
    // Simulate a truncated write.
    writeFileSync(join(dir, 'snapshots', '2026-08-01.json'), '{ not json')
    assert.equal(store.load('2026-08-01'), null)
    assert.deepEqual(store.readDiscovered(), [])
  })
})

test('normaliseTerm and isUsableTerm filter the discovery feed', () => {
  assert.equal(normaliseTerm('  Whimsigothic  MIRROR!! '), 'whimsigothic mirror')
  assert.ok(isUsableTerm('whimsigothic mirror'))
  assert.ok(!isUsableTerm('etsy'), 'marketplace names are not niches')
  assert.ok(!isUsableTerm('mug'), 'a single short word carries no listing signal')
  assert.ok(!isUsableTerm(''))
})

test('the keyword universe merges seeds with discoveries and honours the cap', () => {
  const universe = buildKeywordUniverse({
    seeds: [{ term: 'soy candle', category: 'home-decor' }],
    discovered: [
      { term: 'soy candle', category: 'discovered' },
      { term: 'beeswax candle', discoveredAt: '2026-08-09' },
      { term: 'tallow candle', discoveredAt: '2026-08-01' },
    ],
    max: 2,
  })

  assert.equal(universe.length, 2)
  assert.equal(universe[0].term, 'soy candle')
  assert.equal(universe[0].origin, 'seed', 'a seed must not be shadowed by a discovery')
  assert.equal(universe[1].term, 'beeswax candle', 'the newest discovery survives the cap')
})

test('harvestDiscoveries keeps breakouts and big movers only', () => {
  const found = harvestDiscoveries('whimsigothic', {
    rising: [
      { query: 'Whimsigothic Mirror', value: 5000, breakout: true },
      { query: 'whimsigothic bedroom', value: 400 },
      { query: 'whimsigothic', value: 20 },
      { query: 'etsy', value: 9000, breakout: true },
    ],
  })

  assert.deepEqual(
    found.map((row) => row.term),
    ['whimsigothic mirror', 'whimsigothic bedroom'],
  )
  assert.equal(found[0].parent, 'whimsigothic')
})

test('formsForProfile only returns formats the shop can actually make', () => {
  const digitalOnly = formsForProfile({ formats: ['digital-download'] })
  assert.ok(digitalOnly.length > 0)
  assert.ok(digitalOnly.every((form) => form.format === 'digital-download'))
  assert.deepEqual(formsForProfile({ formats: [] }), [])
})
