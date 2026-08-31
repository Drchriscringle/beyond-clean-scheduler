import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { annotateBacklog, backlogAge, backlogLabel } from '../src/analyze/backlog.js'
import { SnapshotStore } from '../src/store.js'
import { DEFAULT_CONFIG } from '../src/config.js'
import { writeDemoData } from '../src/demo.js'
import { buildReport, summarise } from '../src/report/build.js'
import { listPhrase } from '../src/report/markdown.js'

const LOG = {
  '2026-08-28': ['whimsigothic', 'sourdough gift'],
  '2026-08-29': ['whimsigothic'],
  '2026-08-30': ['whimsigothic', 'crochet plushie'],
}

test('a term never recommended before is new today', () => {
  const age = backlogAge('hollowcrown', LOG, '2026-08-31')
  assert.equal(age.isNew, true)
  assert.equal(age.daysStanding, 0)
  assert.equal(age.timesRecommended, 1)
  assert.equal(age.firstRecommendedOn, '2026-08-31')
})

test('a standing term reports how long it has been on the list', () => {
  const age = backlogAge('whimsigothic', LOG, '2026-08-31')
  assert.equal(age.isNew, false)
  assert.equal(age.firstRecommendedOn, '2026-08-28')
  assert.equal(age.daysStanding, 3)
  assert.equal(age.timesRecommended, 4, 'three prior days plus today')
})

test('a gap in the middle does not reset the clock', () => {
  // Recommended on the 28th, absent on the 29th, back on the 30th.
  const age = backlogAge('sourdough gift', { ...LOG, '2026-08-30': ['sourdough gift'] }, '2026-08-31')
  assert.equal(age.firstRecommendedOn, '2026-08-28')
  assert.equal(age.timesRecommended, 3)
})

test('future log entries are ignored when rebuilding an older report', () => {
  const withFuture = { ...LOG, '2026-09-05': ['hollowcrown'] }
  assert.equal(backlogAge('hollowcrown', withFuture, '2026-08-31').isNew, true)
})

test('an empty log makes everything new, which is right on a first run', () => {
  assert.equal(backlogAge('anything', {}, '2026-08-31').isNew, true)
  assert.equal(backlogAge('anything', undefined, '2026-08-31').isNew, true)
})

test('backlogLabel reads naturally at each age', () => {
  assert.equal(backlogLabel(null), null)
  assert.equal(backlogLabel({ isNew: true }), 'new today')
  assert.equal(backlogLabel({ isNew: false, daysStanding: 1 }), 'also on yesterday’s list')
  assert.equal(backlogLabel({ isNew: false, daysStanding: 4 }), 'on your list 4 days')
})

test('annotateBacklog counts what is actually new', () => {
  const result = annotateBacklog(
    [{ term: 'whimsigothic' }, { term: 'hollowcrown' }, { term: 'crochet plushie' }],
    LOG,
    '2026-08-31',
  )
  assert.equal(result.newCount, 1)
  assert.equal(result.standingCount, 2)
  assert.equal(result.rows.find((row) => row.term === 'hollowcrown').backlog.isNew, true)
})

test('the report ledger round-trips and stays bounded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-log-'))
  try {
    const store = new SnapshotStore(dir)
    assert.deepEqual(store.readReportLog(), {})

    store.recordReport('2026-08-30', ['b', 'a', 'a'])
    assert.deepEqual(store.readReportLog()['2026-08-30'], ['a', 'b'], 'sorted and de-duplicated')

    for (let day = 1; day <= 20; day += 1) {
      store.recordReport(`2026-09-${String(day).padStart(2, '0')}`, ['x'])
    }
    const kept = Object.keys(store.readReportLog())
    assert.equal(kept.length, 21)

    store.recordReport('2026-10-01', ['x'], { keepDays: 5 })
    const trimmed = Object.keys(store.readReportLog())
    assert.equal(trimmed.length, 5)
    assert.equal(trimmed[trimmed.length - 1], '2026-10-01', 'the newest is always kept')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a second report on a later day reports the carry-over, not a fresh list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-carry-'))
  try {
    const config = {
      ...DEFAULT_CONFIG,
      etsyApiKey: '',
      dataDir: join(dir, 'data'),
      reportDir: join(dir, 'reports'),
    }
    const demo = writeDemoData({ config, today: new Date('2026-08-31T00:00:00Z') })

    const first = buildReport({ config: demo, today: new Date('2026-08-31T00:00:00Z') })
    assert.ok(first.model.newCount > 0, 'everything is new on the first run')
    assert.equal(first.model.standingCount, 0)
    assert.match(first.markdown, /new since yesterday/)

    // Same stored data, next day: nothing has changed, so nothing is new.
    const second = buildReport({ config: demo, today: new Date('2026-09-01T00:00:00Z') })
    assert.equal(second.model.newCount, 0, 'the same recommendations are not news')
    assert.ok(second.model.standingCount > 0)
    assert.match(second.markdown, /Nothing new today/)
    assert.match(second.markdown, /also on yesterday’s list/)

    // Standing items are still shown — not acting on something does not make
    // it stop being the best thing to list.
    const shown = second.model.sections.flatMap((s) => s.rows.map((r) => r.term))
    assert.ok(shown.includes('whimsigothic'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a quiet day is not worth a notification; a new trend is', () => {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-notify-'))
  try {
    const config = {
      ...DEFAULT_CONFIG,
      etsyApiKey: '',
      dataDir: join(dir, 'data'),
      reportDir: join(dir, 'reports'),
    }
    const demo = writeDemoData({ config, today: new Date('2026-08-31T00:00:00Z') })

    const first = buildReport({ config: demo, today: new Date('2026-08-31T00:00:00Z') })
    assert.equal(summarise(first.model).worthNotifying, true, 'new trends are worth a ping')

    const second = buildReport({ config: demo, today: new Date('2026-09-01T00:00:00Z') })
    const summary = summarise(second.model)
    assert.equal(summary.newCount, 0)
    assert.equal(summary.worthNotifying, false, 'the same list again is not')

    // The summary is written beside the report for a scheduler to read.
    const onDisk = JSON.parse(readFileSync(second.paths.summary, 'utf8'))
    assert.equal(onDisk.worthNotifying, false)
    assert.equal(onDisk.date, '2026-09-01')
    assert.ok(onDisk.topPick.term)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a deadline falling due is news even when nothing is new', () => {
  // The failure the list-by model exists to prevent: a standing item whose
  // work must start today passing in silence because the term is not new.
  const model = {
    date: '2026-09-01',
    newCount: 0,
    standingCount: 4,
    urgentCount: 1,
    urgentTerms: ['christmas gift'],
    sections: [{ rows: [{ term: 'christmas gift', action: 'List before the deadline' }] }],
  }
  const summary = summarise(model)
  assert.equal(summary.worthNotifying, true)
  assert.deepEqual(summary.urgentTerms, ['christmas gift'])
})

test('urgency counts only deadlines that are actually imminent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-urgent-'))
  try {
    const config = {
      ...DEFAULT_CONFIG,
      etsyApiKey: '',
      dataDir: join(dir, 'data'),
      reportDir: join(dir, 'reports'),
    }
    const demo = writeDemoData({ config, today: new Date('2026-08-31T00:00:00Z') })
    const { model } = buildReport({ config: demo, today: new Date('2026-08-31T00:00:00Z') })

    // Every urgent term must genuinely have a start date of today or tomorrow.
    for (const term of model.urgentTerms) {
      const row = model.sections.flatMap((s) => s.rows).find((r) => r.term === term)
      assert.ok(row.deadline, `${term} was called urgent without a deadline`)
      assert.ok(row.deadline.startBy <= '2026-09-01', `${term} is not actually imminent`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('listPhrase joins the way a reader expects', () => {
  assert.equal(listPhrase([]), '')
  assert.equal(listPhrase(['a']), 'a')
  assert.equal(listPhrase(['a', 'b']), 'a and b')
  assert.equal(listPhrase(['a', 'b', 'c']), 'a, b and c')
})
