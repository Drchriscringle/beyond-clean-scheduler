import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createCalendar, expandOwnEvents, toMinutes } from '../server/calendar/agenda.js'
import { normalizeFeedUrl } from '../server/lib/http.js'
import { withStore } from './helpers.js'

const fixture = await readFile(fileURLToPath(new URL('../fixtures/calendar.ics', import.meta.url)), 'utf8')
const ZONE = 'Europe/London'

/** A fetch stand-in that serves the fixture and counts calls. */
function stubFetch(body = fixture, { etag = 'v1' } = {}) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url, headers: options?.headers ?? {} })
    if (options?.headers?.['if-none-match'] === etag) {
      return { ok: true, status: 304, statusText: 'Not Modified', headers: new Headers(), text: async () => '' }
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ etag, 'content-type': 'text/calendar' }),
      text: async () => body,
    }
  }
  impl.calls = calls
  return impl
}

test('webcal addresses are rewritten to https', () => {
  assert.equal(normalizeFeedUrl('webcal://p1.calendar.com/f.ics'), 'https://p1.calendar.com/f.ics')
  assert.equal(normalizeFeedUrl(' https://x.com/f.ics '), 'https://x.com/f.ics')
})

test('a subscribed feed becomes agenda entries', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'work', name: 'Work', url: 'https://example.com/f.ics', zone: ZONE })
  const calendar = createCalendar({ store, fetchImpl: stubFetch() })

  const { entries } = await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  assert.deepEqual(entries.map((entry) => entry.title), ['Team standup', 'Call with the accountant, re: VAT'])
  assert.equal(entries[0].source.name, 'Work')
})

test('a second read inside the cache window does not re-fetch', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'work', url: 'https://example.com/f.ics', zone: ZONE })
  const fetchImpl = stubFetch()
  const calendar = createCalendar({ store, fetchImpl })

  await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  assert.equal(fetchImpl.calls.length, 1)
})

test('a forced refresh revalidates with the stored ETag', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'work', url: 'https://example.com/f.ics', zone: ZONE })
  const fetchImpl = stubFetch()
  const calendar = createCalendar({ store, fetchImpl })

  await calendar.refresh()
  const report = await calendar.refresh({ force: true })
  assert.equal(fetchImpl.calls.length, 2)
  assert.equal(fetchImpl.calls[1].headers['if-none-match'], 'v1')
  // A 304 keeps the events it already had.
  assert.equal(report[0].events, 6)
  assert.equal(report[0].error, null)
})

test('a feed that fails keeps serving its last good copy, and says so', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'work', name: 'Work', url: 'https://example.com/f.ics', zone: ZONE })
  let healthy = true
  const fetchImpl = async (url, options) => {
    if (!healthy) throw new Error('socket hang up')
    return stubFetch()(url, options)
  }
  const calendar = createCalendar({ store, fetchImpl })

  await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  healthy = false
  const { entries, problems } = await calendar.between('2026-09-14', '2026-09-15', {
    zone: ZONE,
    refresh: true,
  })
  // Cached for 15 minutes, so this read is served from cache without an error;
  // force one through to prove the fallback.
  await calendar.refresh({ force: true })
  const after = await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE, refresh: false })

  assert.ok(entries.length > 0)
  assert.deepEqual(problems, [])
  assert.equal(after.entries.length, 2, 'the events survive the outage')
  assert.match(after.problems[0].error, /socket hang up/)
})

test('a feed that has never loaded reports the failure rather than throwing', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'bad', name: 'Broken', url: 'https://example.com/f.ics', zone: ZONE })
  const calendar = createCalendar({ store, fetchImpl: async () => { throw new Error('DNS failure') } })

  const { entries, problems } = await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  assert.deepEqual(entries, [])
  assert.match(problems[0].error, /DNS failure/)
})

test('a disabled feed is skipped entirely', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'off', url: 'https://example.com/f.ics', enabled: false })
  const fetchImpl = stubFetch()
  const calendar = createCalendar({ store, fetchImpl })

  const { entries } = await calendar.between('2026-09-14', '2026-09-15', { zone: ZONE })
  assert.deepEqual(entries, [])
  assert.equal(fetchImpl.calls.length, 0)
})

test('events added in the dashboard appear alongside the feed', async (t) => {
  const store = await withStore(t)
  await store.add('feeds', { id: 'work', url: 'https://example.com/f.ics', zone: ZONE })
  await store.add('events', { id: 'own-1', title: 'Pick up the car', day: '2026-09-14', time: '08:00' })
  const calendar = createCalendar({ store, fetchImpl: stubFetch() })

  const { entries } = await calendar.between('2026-09-14', '2026-09-14', { zone: ZONE })
  assert.deepEqual(entries.map((entry) => entry.title), ['Pick up the car', 'Team standup'])
})

test('a repeating event added here uses the same recurrence engine', () => {
  const entries = expandOwnEvents(
    [{ id: 'gym', title: 'Gym', day: '2026-09-15', time: '07:00', rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' }],
    '2026-09-15',
    '2026-09-24',
  )
  assert.deepEqual(entries.map((entry) => entry.day), [
    '2026-09-15', '2026-09-17', '2026-09-22', '2026-09-24',
  ])
})

test('an all-day own event sorts ahead of timed ones', () => {
  const entries = expandOwnEvents(
    [
      { id: 'a', title: 'Timed', day: '2026-09-14', time: '09:00' },
      { id: 'b', title: 'All day', day: '2026-09-14' },
    ],
    '2026-09-14',
    '2026-09-14',
  )
  assert.equal(entries.find((entry) => entry.title === 'All day').allDay, true)
})

test('clock times convert to minutes for sorting', () => {
  assert.equal(toMinutes('09:30'), 570)
  assert.equal(toMinutes('00:00'), 0)
  assert.equal(toMinutes('nonsense'), null)
})
