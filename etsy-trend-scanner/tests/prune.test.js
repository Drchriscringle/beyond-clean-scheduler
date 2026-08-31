import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DEFAULT_RETENTION, prune, pruneReports, pruneSnapshots, thinSnapshot } from '../src/prune.js'
import { SnapshotStore, ensureDir } from '../src/store.js'
import { supplyMomentum } from '../src/analyze/momentum.js'
import { emergingTags } from '../src/analyze/tags.js'
import { trendPersistence } from '../src/analyze/persistence.js'

const TODAY = new Date('2026-08-31T00:00:00Z')

function fullSnapshot(date) {
  return {
    date,
    generatedAt: `${date}T06:00:00.000Z`,
    geo: 'GB',
    notes: ['some note'],
    keywords: {
      whimsigothic: {
        category: 'trending',
        origin: 'trending',
        trending: { sources: ['google-trending'], traffic: 20000 },
        etsy: {
          ok: true,
          totalListings: 2500,
          sampleSize: 100,
          medianPrice: 24,
          topTags: [{ tag: 'whimsigothic', count: 30 }],
        },
        // The bulky fields, used once on the day and never read back.
        trends: { series: Array.from({ length: 52 }, (_, i) => ({ date, value: i })), rising: [], top: [] },
        suggest: { suggestions: Array.from({ length: 10 }, (_, i) => ({ query: `q${i}`, rank: i })) },
        related: Array.from({ length: 12 }, (_, i) => ({ query: `r${i}`, sources: ['autocomplete'] })),
      },
    },
    longTail: Array.from({ length: 12 }, (_, i) => ({ query: `lt${i}`, etsy: { totalListings: i } })),
  }
}

function withDirs(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-prune-'))
  try {
    return fn({ dataDir: join(dir, 'data'), reportDir: join(dir, 'reports') })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function seedSnapshots(dataDir, dates) {
  const store = new SnapshotStore(dataDir)
  for (const date of dates) store.save(fullSnapshot(date))
  return store
}

test('thinning drops the bulky fields and keeps what history reads', () => {
  const { snapshot, changed } = thinSnapshot(fullSnapshot('2026-06-01'))
  const row = snapshot.keywords.whimsigothic

  assert.equal(changed, true)
  assert.equal(row.trends, undefined)
  assert.equal(row.suggest, undefined)
  assert.equal(row.related, undefined)
  assert.equal(snapshot.longTail, undefined)

  // Everything the three backward-looking consumers need survives.
  assert.equal(row.etsy.totalListings, 2500)
  assert.deepEqual(row.etsy.topTags, [{ tag: 'whimsigothic', count: 30 }])
  assert.equal(row.origin, 'trending')
  assert.ok(row.trending)
})

test('thinning is idempotent, so the daily job can run it every day', () => {
  const once = thinSnapshot(fullSnapshot('2026-06-01'))
  const twice = thinSnapshot(once.snapshot)
  assert.equal(twice.changed, false)
  assert.deepEqual(twice.snapshot, once.snapshot)
})

test('a thinned history still produces identical readings', () => {
  const dates = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']
  const full = dates.map((date) => ({ date, ...fullSnapshot(date).keywords.whimsigothic }))
  const thin = dates.map((date) => ({
    date,
    ...thinSnapshot(fullSnapshot(date)).snapshot.keywords.whimsigothic,
  }))

  // The three consumers that look backwards must not notice.
  assert.deepEqual(supplyMomentum(thin), supplyMomentum(full))
  assert.deepEqual(
    emergingTags(thin.at(-1).etsy.topTags, thin[0].etsy.topTags),
    emergingTags(full.at(-1).etsy.topTags, full[0].etsy.topTags),
  )
  assert.deepEqual(
    trendPersistence(thin, { scanDates: dates }),
    trendPersistence(full, { scanDates: dates }),
  )
})

test('recent snapshots are left at full detail', () => {
  withDirs(({ dataDir }) => {
    seedSnapshots(dataDir, ['2026-08-20', '2026-08-30', '2026-08-31'])
    const result = pruneSnapshots(dataDir, { today: TODAY })

    assert.deepEqual(result.thinned, [], 'nothing inside the full-detail window is touched')
    assert.deepEqual(result.deleted, [])
    const store = new SnapshotStore(dataDir)
    assert.ok(store.load('2026-08-20').keywords.whimsigothic.trends)
  })
})

test('older snapshots are thinned and expired ones deleted', () => {
  withDirs(({ dataDir }) => {
    seedSnapshots(dataDir, ['2024-01-01', '2026-06-01', '2026-08-30', '2026-08-31'])
    const result = pruneSnapshots(dataDir, { today: TODAY })

    assert.deepEqual(result.deleted, ['2024-01-01'], 'past maxDays')
    assert.deepEqual(result.thinned, ['2026-06-01'], 'past fullDetailDays')
    assert.ok(result.bytesSaved > 0)

    const store = new SnapshotStore(dataDir)
    assert.equal(store.load('2024-01-01'), null)
    assert.equal(store.load('2026-06-01').keywords.whimsigothic.trends, undefined)
    assert.ok(store.load('2026-08-30').keywords.whimsigothic.trends, 'recent one untouched')
  })
})

test('the newest snapshot is never touched, whatever its date says', () => {
  withDirs(({ dataDir }) => {
    // Every snapshot is old enough to delete. The newest must still survive,
    // because the next report is built from it.
    seedSnapshots(dataDir, ['2020-01-01', '2020-01-02'])
    const result = pruneSnapshots(dataDir, { today: TODAY })

    assert.deepEqual(result.deleted, ['2020-01-01'])
    const store = new SnapshotStore(dataDir)
    assert.ok(store.load('2020-01-02'), 'the newest snapshot survives')
    assert.ok(store.load('2020-01-02').keywords.whimsigothic.trends, 'and at full detail')
  })
})

test('a dry run reports without writing', () => {
  withDirs(({ dataDir }) => {
    seedSnapshots(dataDir, ['2024-01-01', '2026-06-01', '2026-08-31'])
    const result = pruneSnapshots(dataDir, { today: TODAY, dryRun: true })

    assert.deepEqual(result.deleted, ['2024-01-01'])
    assert.deepEqual(result.thinned, ['2026-06-01'])

    const store = new SnapshotStore(dataDir)
    assert.ok(store.load('2024-01-01'), 'nothing was actually deleted')
    assert.ok(store.load('2026-06-01').keywords.whimsigothic.trends, 'nothing was actually thinned')
  })
})

test('a corrupt snapshot is left alone rather than rewritten', () => {
  withDirs(({ dataDir }) => {
    seedSnapshots(dataDir, ['2026-06-01', '2026-08-31'])
    const path = join(dataDir, 'snapshots', '2026-06-01.json')
    writeFileSync(path, '{ truncated')

    const result = pruneSnapshots(dataDir, { today: TODAY })
    assert.deepEqual(result.thinned, [])
    assert.equal(readFileSync(path, 'utf8'), '{ truncated')
  })
})

test('stale report HTML goes; markdown and latest.* stay', () => {
  withDirs(({ reportDir }) => {
    ensureDir(reportDir)
    for (const name of [
      '2026-01-01.html', '2026-01-01.md',
      '2026-08-30.html', '2026-08-30.md',
      'latest.html', 'latest.md',
    ]) {
      writeFileSync(join(reportDir, name), 'x'.repeat(100))
    }

    const result = pruneReports(reportDir, { today: TODAY })
    const left = readdirSync(reportDir).sort()

    assert.deepEqual(result.deleted, ['2026-01-01'])
    assert.deepEqual(left, [
      '2026-01-01.md',
      '2026-08-30.html',
      '2026-08-30.md',
      'latest.html',
      'latest.md',
    ])
  })
})

test('prune runs both halves and totals the saving', () => {
  withDirs(({ dataDir, reportDir }) => {
    seedSnapshots(dataDir, ['2026-06-01', '2026-08-31'])
    ensureDir(reportDir)
    writeFileSync(join(reportDir, '2026-01-01.html'), 'x'.repeat(5000))

    const result = prune({ config: { dataDir, reportDir }, today: TODAY })
    assert.equal(result.snapshots.thinned.length, 1)
    assert.equal(result.reports.deleted.length, 1)
    assert.equal(result.bytesSaved, result.snapshots.bytesSaved + result.reports.bytesSaved)
    assert.ok(result.bytesSaved > 5000)
  })
})

test('the full-detail window comfortably exceeds the momentum lookback', () => {
  // supplyMomentum looks back 28 days; thinning inside that window would not
  // break it (totalListings survives) but would remove the ability to rebuild
  // a report at full detail for a period still being actively scored.
  assert.ok(DEFAULT_RETENTION.fullDetailDays > 28)
  assert.ok(DEFAULT_RETENTION.maxDays > DEFAULT_RETENTION.fullDetailDays)
})
