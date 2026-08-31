import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isFlickering,
  persistenceVerdict,
  trendPersistence,
} from '../src/analyze/persistence.js'
import { CLASSES, scoreKeyword, trendingMomentum } from '../src/analyze/score.js'
import { DEFAULT_CONFIG } from '../src/config.js'

const TODAY = new Date('2026-08-31T00:00:00Z')
const config = { ...DEFAULT_CONFIG, etsyApiKey: '' }

function trendingOn(dates) {
  return dates.map((date) => ({ date, origin: 'trending', trending: { traffic: 5000 } }))
}

test('a term never seen trending has no persistence to report', () => {
  assert.equal(trendPersistence([]), null)
  assert.equal(trendPersistence([{ date: '2026-08-30', origin: 'watchlist' }]), null)
})

test('a first-day trend is marked unproven', () => {
  const p = trendPersistence(trendingOn(['2026-08-31']), { scanDates: ['2026-08-30', '2026-08-31'] })
  assert.equal(p.appearances, 1)
  assert.equal(p.isNew, true)
  assert.equal(p.proven, false)
  assert.equal(p.sustained, false)
  assert.equal(p.firstSeen, '2026-08-31')
  // Scans that predate the trend are not counted against it.
  assert.equal(p.opportunities, 1)
})

test('two scans agreeing is the point a spike stops looking like an artefact', () => {
  const p = trendPersistence(trendingOn(['2026-08-30', '2026-08-31']), {
    scanDates: ['2026-08-29', '2026-08-30', '2026-08-31'],
  })
  assert.equal(p.proven, true)
  assert.equal(p.sustained, false)
  assert.equal(p.consistency, 1)
})

test('a trend present in every scan since discovery is sustained', () => {
  const dates = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31']
  const p = trendPersistence(trendingOn(dates), { scanDates: dates })
  assert.equal(p.sustained, true)
  assert.equal(p.appearances, 5)
  assert.equal(p.daysKnown, 5)
  assert.equal(p.consistency, 1)
})

test('a missed scan is our outage, not the trend going quiet', () => {
  // The scanner did not run on the 29th. The trend should not be penalised.
  const p = trendPersistence(trendingOn(['2026-08-28', '2026-08-30', '2026-08-31']), {
    scanDates: ['2026-08-28', '2026-08-30', '2026-08-31'],
  })
  assert.equal(p.consistency, 1, 'days we did not look are not counted against it')
  assert.equal(p.sustained, true)
})

test('a trend that comes and goes is flagged as episodic, not building', () => {
  const scanDates = [
    '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28',
    '2026-08-29', '2026-08-30', '2026-08-31',
  ]
  const flicker = trendPersistence(trendingOn(['2026-08-25', '2026-08-31']), { scanDates })
  assert.ok(flicker.consistency < 0.5)
  assert.equal(isFlickering(flicker), true)

  const steady = trendPersistence(trendingOn(scanDates), { scanDates })
  assert.equal(isFlickering(steady), false)
  // Too little data to call anything episodic yet.
  assert.equal(isFlickering(trendPersistence(trendingOn(['2026-08-31']), { scanDates: ['2026-08-31'] })), false)
})

test('persistenceVerdict says which of the three states a trend is in', () => {
  assert.equal(persistenceVerdict(null), null)
  assert.equal(persistenceVerdict({ appearances: 1, proven: false, sustained: false }).label, 'unproven')
  assert.equal(
    persistenceVerdict({ appearances: 2, proven: true, sustained: false, firstSeen: '2026-08-30' }).label,
    'confirmed',
  )
  assert.equal(
    persistenceVerdict({ appearances: 5, proven: true, sustained: true, firstSeen: '2026-08-27' }).label,
    'sustained',
  )
  assert.match(persistenceVerdict({ appearances: 1 }).note, /no way to tell yet/)
})

test('persistence adds to momentum and never subtracts', () => {
  const trending = { traffic: 50_000, sources: ['google-trending'] }
  const fresh = trendingMomentum(trending, { proven: false, sustained: false })
  const proven = trendingMomentum(trending, { proven: true, sustained: false })
  const sustained = trendingMomentum(trending, { proven: true, sustained: true })
  const none = trendingMomentum(trending, null)

  assert.equal(fresh, none, 'a new trend is not scored down for being new')
  assert.ok(proven > fresh)
  assert.ok(sustained > proven)
  assert.ok(sustained <= 100)
})

test('a one-day spike cannot reach high confidence, but is still recommended', () => {
  const base = {
    term: 'hollowcrown',
    etsy: {
      totalListings: 580,
      medianPrice: 22,
      sellerEntryRate: 0.03,
      digitalShare: 0.6,
      sampleSize: 100,
    },
    trends: { series: Array.from({ length: 52 }, (_, i) => ({ value: i < 46 ? 3 : i * 2 })) },
    trending: { sources: ['google-trending', 'wikipedia'], traffic: 200_000, formatScore: 90 },
    history: [
      { date: '2026-08-30', etsy: { totalListings: 400 } },
      { date: '2026-08-31', etsy: { totalListings: 580 } },
    ],
    config,
    today: TODAY,
  }

  const unproven = scoreKeyword({
    ...base,
    persistence: { appearances: 1, isNew: true, proven: false, sustained: false },
  })
  const sustained = scoreKeyword({
    ...base,
    persistence: {
      appearances: 5,
      isNew: false,
      proven: true,
      sustained: true,
      firstSeen: '2026-08-27',
      consistency: 1,
    },
  })

  // Persistence must not change the call, only how sure we are of it. Being
  // early is the whole thesis, so a new trend is still recommended.
  assert.equal(unproven.classification, sustained.classification)
  assert.ok(
    [CLASSES.EARLY, CLASSES.HOT].includes(unproven.classification),
    `expected an actionable call, got ${unproven.classification}`,
  )

  // But the report is honest about which one has proven itself.
  assert.notEqual(unproven.confidence, 'high')
  assert.ok(sustained.opportunity >= unproven.opportunity)
  assert.match(unproven.evidence.join('\n'), /First seen trending today/)
  assert.match(sustained.evidence.join('\n'), /this one has legs/)
})
