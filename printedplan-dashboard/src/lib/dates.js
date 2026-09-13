// Date helpers that respect the user's chosen timezone (UK or UTC).
// All "dates" in the app are ISO strings (YYYY-MM-DD); comparisons are string comparisons.

export function todayISO(timeZone = 'Europe/London', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export function diffDays(fromISO, toISO) {
  const a = Date.UTC(...isoParts(fromISO))
  const b = Date.UTC(...isoParts(toISO))
  return Math.round((b - a) / 86400000)
}

function isoParts(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m - 1, d]
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso) {
  const day = new Date(Date.UTC(...isoParts(iso))).getUTCDay() // 0 = Sunday
  return (day + 6) % 7
}

/** Monday of the week containing `iso`. */
export function weekStart(iso) {
  return addDays(iso, -weekdayIndex(iso))
}

/** Sunday of the week containing `iso`. */
export function weekEnd(iso) {
  return addDays(weekStart(iso), 6)
}

export function weekDays(iso) {
  const start = weekStart(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function range(fromISO, toISO) {
  const days = []
  let cur = fromISO
  while (cur <= toISO) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  const [y, m, d] = isoParts(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: opts.weekday ?? 'short',
    day: 'numeric',
    month: 'short',
    ...(opts.year ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(y, m, d)))
}

export function formatLongDate(iso) {
  const [y, m, d] = isoParts(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m, d)))
}

/** "14:30:00" -> "14:30" */
export function formatTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5)
}

/**
 * Minutes from `now` until `dateISO` at `time` (HH:MM) in the given timezone.
 * Returns null when there is no time.
 */
export function minutesUntil(dateISO, time, timeZone = 'Europe/London', now = new Date()) {
  if (!dateISO || !time) return null
  const [hh, mm] = String(time).split(':').map(Number)
  const [y, m, d] = isoParts(dateISO)
  // Find the UTC instant that displays as y-m-d hh:mm in the timezone.
  const guess = Date.UTC(y, m, d, hh, mm)
  const offset = tzOffsetMinutes(timeZone, new Date(guess))
  const target = guess - offset * 60000
  return Math.round((target - now.getTime()) / 60000)
}

function tzOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** ISO week label like "2026-W37" used by weekly analytics buckets. */
export function isoWeekKey(iso) {
  return weekStart(iso)
}

export function monthKey(iso) {
  return iso.slice(0, 7)
}
