import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureBankHolidays, parseBankHolidays } from '../server/money/holidays.js'
import { withStore } from './helpers.js'

const PAYLOAD = JSON.stringify({
  'england-and-wales': {
    division: 'england-and-wales',
    events: [
      { title: 'Christmas Day', date: '2026-12-25', bunting: true },
      { title: 'Boxing Day', date: '2026-12-28', bunting: true },
    ],
  },
  scotland: { division: 'scotland', events: [{ title: "St Andrew's Day", date: '2026-11-30' }] },
})

const ok = (body) => async () => ({
  ok: true, status: 200, headers: new Headers(), text: async () => body,
})

test('the published list parses to day keys', () => {
  assert.deepEqual(parseBankHolidays(PAYLOAD), ['2026-12-25', '2026-12-28'])
  assert.deepEqual(parseBankHolidays(PAYLOAD, 'scotland'), ['2026-11-30'])
})

test('a nonsense payload is refused rather than half-read', () => {
  assert.throws(() => parseBankHolidays('<html>503</html>'), /not valid JSON/)
  assert.throws(() => parseBankHolidays('{}'), /No bank holidays/)
})

test('the list is fetched once and then cached', async (t) => {
  const store = await withStore(t)
  let calls = 0
  const fetchImpl = async (...args) => { calls += 1; return ok(PAYLOAD)(...args) }

  assert.deepEqual(await ensureBankHolidays({ store, fetchImpl }), ['2026-12-25', '2026-12-28'])
  await ensureBankHolidays({ store, fetchImpl })
  assert.equal(calls, 1)
})

test('changing region re-fetches rather than serving the wrong country', async (t) => {
  const store = await withStore(t)
  let calls = 0
  const fetchImpl = async (...args) => { calls += 1; return ok(PAYLOAD)(...args) }

  await ensureBankHolidays({ store, fetchImpl })
  await store.update('profile', (profile) => ({ ...profile, bankHolidayDivision: 'scotland' }))
  assert.deepEqual(await ensureBankHolidays({ store, fetchImpl }), ['2026-11-30'])
  assert.equal(calls, 2)
})

test('a failed fetch keeps the cached list rather than emptying it', async (t) => {
  const store = await withStore(t)
  await ensureBankHolidays({ store, fetchImpl: ok(PAYLOAD) })
  await store.update('profile', (profile) => ({
    ...profile,
    bankHolidays: { ...profile.bankHolidays, fetchedAt: '2000-01-01T00:00:00.000Z' },
  }))

  const days = await ensureBankHolidays({ store, fetchImpl: async () => { throw new Error('offline') } })
  assert.deepEqual(days, ['2026-12-25', '2026-12-28'])
})

test('with no cache and no network, the forecast simply goes without', async (t) => {
  const store = await withStore(t)
  assert.deepEqual(
    await ensureBankHolidays({ store, fetchImpl: async () => { throw new Error('offline') } }),
    [],
  )
})
