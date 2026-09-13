/**
 * Dates, as day keys.
 *
 * Every date in this dashboard that means "a day in your life" — a bill due,
 * an objective's deadline, the agenda for tomorrow — is a `YYYY-MM-DD` string,
 * not a Date. A Date is a moment in time, and a moment is the wrong type for
 * "the 3rd of the month": add a month to a Date and you inherit whatever the
 * runtime's timezone and daylight saving were doing that night.
 *
 * Day arithmetic here anchors on UTC noon. Noon rather than midnight so that a
 * ±13h timezone shift can never land the result on the previous or next day.
 */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDayKey(value) {
  return typeof value === 'string' && DAY_KEY.test(value)
}

/** Parses a day key into a UTC-noon Date for arithmetic. */
export function toDate(day) {
  if (!isDayKey(day)) throw new Error(`Not a day key: ${day}`)
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

export function fromDate(date) {
  return date.toISOString().slice(0, 10)
}

/**
 * Today, in the viewer's timezone rather than the server's. `en-CA` formats as
 * YYYY-MM-DD, which is exactly a day key.
 */
export function today(timeZone, now = new Date()) {
  if (!timeZone) return fromDate(new Date(now.getTime() - now.getTimezoneOffset() * 60_000))
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(day, count) {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + count)
  return fromDate(date)
}

/**
 * Adds months, clamping to the end of the target month. The 31st plus one
 * month is the 28th/29th/30th — which is what a direct debit set for "the
 * 31st" actually does in February, rather than silently jumping to March.
 */
export function addMonths(day, count) {
  const [year, month, date] = day.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + count, 1, 12))
  const lastDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1)
  target.setUTCDate(Math.min(date, lastDay))
  return fromDate(target)
}

export function addYears(day, count) {
  return addMonths(day, count * 12)
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / 86_400_000)
}

export function compareDays(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function minDay(a, b) {
  return a <= b ? a : b
}

export function maxDay(a, b) {
  return a >= b ? a : b
}

export function isBetween(day, start, end) {
  return day >= start && day <= end
}

/** 0 = Sunday, matching Date.getUTCDay() and the ICS BYDAY ordering below. */
export function weekday(day) {
  return toDate(day).getUTCDay()
}

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function isWeekend(day) {
  const dow = weekday(day)
  return dow === 0 || dow === 6
}

/** Every day key from start to end inclusive. */
export function eachDay(start, end) {
  const days = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatDay(day, { weekday: withWeekday = true } = {}) {
  const date = toDate(day)
  const stem = `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`
  return withWeekday ? `${DAY_NAMES[date.getUTCDay()]} ${stem}` : stem
}

/** "today", "tomorrow", "in 3 days", "5 days ago" — for a brief people skim. */
export function relativeDay(day, reference) {
  const delta = daysBetween(reference, day)
  if (delta === 0) return 'today'
  if (delta === 1) return 'tomorrow'
  if (delta === -1) return 'yesterday'
  if (delta > 0) return `in ${delta} days`
  return `${Math.abs(delta)} days ago`
}
