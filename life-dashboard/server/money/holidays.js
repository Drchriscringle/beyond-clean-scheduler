import { fetchText } from '../lib/http.js'

/**
 * Bank holidays, so a direct debit due on Christmas Day lands where it really
 * will rather than a day that no payment system is open.
 *
 * gov.uk publishes these as free JSON with no key and no rate limit, which is
 * exactly the right dependency: it is fetched once, cached in the profile, and
 * the dashboard works without it — a missing holiday list only means a payment
 * shifts to a day that turns out to be a bank holiday, which is a slightly
 * optimistic forecast rather than a broken one.
 */

const SOURCE = 'https://www.gov.uk/bank-holidays.json'

export const DIVISIONS = {
  'england-and-wales': 'England and Wales',
  scotland: 'Scotland',
  'northern-ireland': 'Northern Ireland',
}

export async function fetchBankHolidays({
  division = 'england-and-wales',
  fetchImpl = globalThis.fetch,
} = {}) {
  const { text } = await fetchText(SOURCE, { fetchImpl })
  return parseBankHolidays(text, division)
}

export function parseBankHolidays(text, division = 'england-and-wales') {
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('The bank holiday list was not valid JSON.')
  }
  const events = payload?.[division]?.events
  if (!Array.isArray(events)) throw new Error(`No bank holidays published for ${division}.`)
  return events
    .map((event) => event.date)
    .filter((day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort()
}

/**
 * Reads the cached list, refreshing it when it is missing or stale.
 *
 * gov.uk publishes about 18 months ahead, so a yearly refresh is plenty — and
 * a failure keeps whatever was cached rather than emptying the list.
 */
export async function ensureBankHolidays({ store, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const profile = await store.get('profile')
  const cached = profile.bankHolidays ?? null
  const division = profile.bankHolidayDivision ?? 'england-and-wales'

  const fresh = cached?.fetchedAt
    && cached.division === division
    && now() - Date.parse(cached.fetchedAt) < 365 * 24 * 60 * 60 * 1000
  if (fresh) return cached.days

  try {
    const days = await fetchBankHolidays({ division, fetchImpl })
    await store.update('profile', (current) => ({
      ...current,
      bankHolidays: { days, division, fetchedAt: new Date(now()).toISOString() },
    }))
    return days
  } catch {
    return cached?.days ?? []
  }
}
