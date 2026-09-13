import { addDays, addMonths, addYears, daysInMonth, fromDate, toDate, WEEKDAY_CODES, weekday } from '../lib/dates.js'

/**
 * RRULE expansion, to the extent a life dashboard needs it.
 *
 * Supports FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL,
 * BYDAY (including ordinals such as -1FR for "the last Friday"), BYMONTHDAY
 * and BYMONTH. That covers what real calendars emit: standups, rent, a
 * fortnightly bin day, the last Friday of the month, an annual renewal.
 *
 * Deliberately not supported: BYSETPOS, BYWEEKNO, BYYEARDAY, and sub-daily
 * frequencies. An event using those expands on its DTSTART only, rather than
 * silently landing on wrong days — see `unsupported` on the parsed rule.
 */

const SUPPORTED_FREQUENCIES = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
const UNSUPPORTED_PARTS = ['BYSETPOS', 'BYWEEKNO', 'BYYEARDAY', 'BYHOUR', 'BYMINUTE']

/** A safety net: no single rule may generate more than this many occurrences. */
const MAX_OCCURRENCES = 2000
/** ...nor iterate more periods than this looking for them. */
const MAX_PERIODS = 6000

export function parseRule(text) {
  const parts = {}
  for (const piece of String(text).split(';')) {
    const [rawName, ...rest] = piece.split('=')
    if (!rawName || rest.length === 0) continue
    parts[rawName.trim().toUpperCase()] = rest.join('=').trim()
  }

  const frequency = (parts.FREQ ?? '').toUpperCase()
  const rule = {
    frequency,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    until: parts.UNTIL ? untilToDay(parts.UNTIL) : null,
    byDay: parts.BYDAY ? parts.BYDAY.split(',').map(parseByDay).filter(Boolean) : [],
    byMonthDay: parts.BYMONTHDAY ? parts.BYMONTHDAY.split(',').map(Number).filter(Number.isInteger) : [],
    byMonth: parts.BYMONTH ? parts.BYMONTH.split(',').map(Number).filter(Number.isInteger) : [],
    weekStart: (parts.WKST ?? 'MO').toUpperCase(),
    unsupported: null,
  }

  if (!SUPPORTED_FREQUENCIES.has(frequency)) {
    rule.unsupported = frequency ? `FREQ=${frequency}` : 'a rule with no FREQ'
  } else {
    const found = UNSUPPORTED_PARTS.find((name) => name in parts)
    if (found) rule.unsupported = found
  }
  return rule
}

/** UNTIL may be a date or a UTC timestamp; either way the day is what matters. */
function untilToDay(value) {
  const digits = String(value).replace(/[^0-9]/g, '')
  if (digits.length < 8) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function parseByDay(token) {
  const match = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token.trim().toUpperCase())
  if (!match) return null
  return { ordinal: match[1] ? Number(match[1]) : 0, weekday: WEEKDAY_CODES.indexOf(match[2]) }
}

/**
 * Every day this rule falls on between `windowStart` and `windowEnd`.
 *
 * COUNT and UNTIL are counted from the series' real start, not the window, so
 * asking about next month cannot resurrect a series that already ran out.
 */
export function expandRecurrence(startDay, rule, windowStart, windowEnd, { exclude = [] } = {}) {
  if (!rule || rule.unsupported) {
    return startDay >= windowStart && startDay <= windowEnd ? [startDay] : []
  }

  const excluded = new Set(exclude)
  const limit = rule.until && rule.until < windowEnd ? rule.until : windowEnd
  const occurrences = []
  let emitted = 0

  for (const day of generate(startDay, rule, limit)) {
    if (rule.count !== null && emitted >= rule.count) break
    if (day > limit) break
    emitted += 1
    if (day >= windowStart && day <= limit && !excluded.has(day)) occurrences.push(day)
    if (occurrences.length >= MAX_OCCURRENCES) break
  }
  return occurrences
}

/** Yields every occurrence from the series start, in order, until past `limit`. */
function* generate(startDay, rule, limit) {
  const { frequency, interval } = rule
  let period = 0

  while (period < MAX_PERIODS) {
    const days = daysInPeriod(startDay, rule, period)
    let anyBeforeLimit = false

    for (const day of days) {
      if (day < startDay) continue
      if (day > limit) continue
      anyBeforeLimit = true
      yield day
    }

    // Stop once the whole period sits past the limit — but only after the
    // first period, since a period can start before the series does.
    const anchor = periodAnchor(startDay, frequency, interval, period)
    if (anchor > limit && !anyBeforeLimit) return
    period += 1
  }
}

function periodAnchor(startDay, frequency, interval, period) {
  const step = interval * period
  if (frequency === 'DAILY') return addDays(startDay, step)
  if (frequency === 'WEEKLY') return addDays(startDay, step * 7)
  if (frequency === 'MONTHLY') return addMonths(startDay, step)
  return addYears(startDay, step)
}

/** The days this rule produces inside one period, sorted. */
function daysInPeriod(startDay, rule, period) {
  const { frequency, interval, byDay, byMonthDay, byMonth } = rule

  if (frequency === 'DAILY') {
    const day = addDays(startDay, interval * period)
    return matchesFilters(day, rule) ? [day] : []
  }

  if (frequency === 'WEEKLY') {
    const weekStartIndex = WEEKDAY_CODES.indexOf(rule.weekStart)
    const offsetToWeekStart = (weekday(startDay) - (weekStartIndex < 0 ? 1 : weekStartIndex) + 7) % 7
    const weekBegan = addDays(startDay, -offsetToWeekStart)
    const thisWeek = addDays(weekBegan, interval * period * 7)
    const weekdays = byDay.length > 0 ? byDay.map((entry) => entry.weekday) : [weekday(startDay)]
    return weekdays
      .map((target) => addDays(thisWeek, (target - weekday(thisWeek) + 7) % 7))
      .filter((day) => matchesFilters(day, rule))
      .sort()
  }

  if (frequency === 'MONTHLY') {
    const month = addMonths(firstOfMonth(startDay), interval * period)
    return monthDays(month, byDay, byMonthDay, toDate(startDay).getUTCDate())
      .filter((day) => matchesFilters(day, rule))
      .sort()
  }

  // YEARLY
  const startDate = toDate(startDay)
  const year = startDate.getUTCFullYear() + interval * period
  const months = byMonth.length > 0 ? byMonth : [startDate.getUTCMonth() + 1]
  return months
    .flatMap((month) => {
      const first = `${year}-${String(month).padStart(2, '0')}-01`
      return monthDays(first, byDay, byMonthDay, startDate.getUTCDate())
    })
    .filter((day) => !byMonth.length || byMonth.includes(Number(day.slice(5, 7))))
    .sort()
}

function firstOfMonth(day) {
  return `${day.slice(0, 7)}-01`
}

/** The matching days within the month that `monthStart` begins. */
function monthDays(monthStart, byDay, byMonthDay, fallbackDate) {
  const [year, month] = monthStart.split('-').map(Number)
  const length = daysInMonth(year, month)

  if (byDay.length > 0) {
    const days = []
    for (const { ordinal, weekday: target } of byDay) {
      const matching = []
      for (let date = 1; date <= length; date += 1) {
        const day = `${monthStart.slice(0, 7)}-${String(date).padStart(2, '0')}`
        if (weekday(day) === target) matching.push(day)
      }
      if (ordinal === 0) days.push(...matching)
      else if (ordinal > 0 && matching[ordinal - 1]) days.push(matching[ordinal - 1])
      else if (ordinal < 0 && matching[matching.length + ordinal]) days.push(matching[matching.length + ordinal])
    }
    // BYMONTHDAY alongside BYDAY narrows rather than adds.
    return byMonthDay.length > 0
      ? days.filter((day) => byMonthDay.includes(Number(day.slice(8, 10))))
      : [...new Set(days)]
  }

  const dates = byMonthDay.length > 0 ? byMonthDay : [fallbackDate]
  return dates
    .map((date) => (date < 0 ? length + date + 1 : date))
    // A rule for the 31st simply does not occur in a 30-day month. That is the
    // spec's behaviour, and differs from a monthly bill, which clamps instead.
    .filter((date) => date >= 1 && date <= length)
    .map((date) => `${monthStart.slice(0, 7)}-${String(date).padStart(2, '0')}`)
}

function matchesFilters(day, rule) {
  const { byMonth, byDay, frequency } = rule
  if (byMonth.length > 0 && !byMonth.includes(Number(day.slice(5, 7)))) return false
  // For DAILY, BYDAY filters; for WEEKLY and MONTHLY it already generated them.
  if (frequency === 'DAILY' && byDay.length > 0) {
    return byDay.some((entry) => entry.weekday === weekday(day))
  }
  return true
}

export { fromDate }
