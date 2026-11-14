// Works out the actual cleans (dates and times) from plans, one-off bookings and changes.
// Pure functions with no imports beyond pricing.js, shared by the app and the server.
// Dates are 'YYYY-MM-DD' strings and are handled in UTC so clock changes never shift a day.

import { FORTNIGHTLY, addHours } from './pricing.js'

const DAY_MS = 864e5

export function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function toISO(date) {
  return date.toISOString().slice(0, 10)
}
export function addDays(iso, n) {
  return toISO(new Date(toDate(iso).getTime() + n * DAY_MS))
}
/** 1 = Monday ... 7 = Sunday */
export function isoWeekday(iso) {
  const d = toDate(iso).getUTCDay()
  return d === 0 ? 7 : d
}
export function mondayOf(iso) {
  return addDays(iso, 1 - isoWeekday(iso))
}
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / DAY_MS)
}
/** Today's date in the UK, as 'YYYY-MM-DD'. */
export function todayUK(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
}

/** Hours from `now` until a clean starting at date + 'HH:MM' (UK time, approximately). */
export function hoursUntil(date, start, now = new Date()) {
  const [h, m] = (start || '09:00').split(':').map(Number)
  const t = toDate(date).getTime() + (h * 60 + m) * 6e4
  // Shift "now" into UK wall-clock time so the comparison is like for like.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]))
  const ukNow = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return (t - ukNow) / 36e5
}

export const LIVE_PLAN = ['active', 'past_due', 'paused']

/** First date on or after `from` that falls on `weekday`. */
function firstOnOrAfter(from, weekday) {
  return addDays(from, (weekday - isoWeekday(from) + 7) % 7)
}

/**
 * Every clean a plan has between from and to (inclusive), with changes applied.
 * changes: rows of plan_changes for this plan ({ kind, visit_date, visit_start, new_date, new_time, status, cleaner_id, extra_id, amount_pence }).
 */
export function planVisits(plan, changes, from, to) {
  if (!plan.start_date || !(plan.slots || []).length) return []
  const mine = (changes || []).filter((c) => c.subscription_id === undefined || c.subscription_id === plan.id)
  const find = (kind, date, start) => mine.filter((c) => c.kind === kind && c.visit_date === date && c.visit_start === start)
  const fortnightly = Number(plan.visits_per_week) === FORTNIGHTLY
  const visits = []

  for (const slot of plan.slots) {
    const first = firstOnOrAfter(plan.start_date, slot.day)
    let date = first > from ? first : firstOnOrAfter(from, slot.day)
    if (fortnightly && daysBetween(first, date) % 14 !== 0) date = addDays(date, 7)
    for (; date <= to; date = addDays(date, fortnightly ? 14 : 7)) {
      if (date < first) continue
      const v = {
        key: `plan:${plan.id}:${date}:${slot.start}`,
        type: 'plan', planId: plan.id, date, start: slot.start,
        end: addHours(slot.start, Number(plan.hours_per_visit)), hours: Number(plan.hours_per_visit),
        cleanerId: plan.cleaner_id || null, skipped: false, moved: null, movePending: null, extras: [],
        originalDate: date, originalStart: slot.start,
      }
      if (find('skip', date, slot.start).length) v.skipped = true
      const cover = find('cover', date, slot.start).at(-1)
      if (cover) v.cleanerId = cover.cleaner_id
      v.extras = find('extra', date, slot.start)
      const move = find('move', date, slot.start)
      const confirmed = move.find((c) => c.status === 'confirmed')
      const pending = move.find((c) => c.status === 'requested')
      if (pending) v.movePending = pending
      if (confirmed) {
        v.moved = confirmed
        v.date = confirmed.new_date
        v.start = confirmed.new_time || slot.start
        v.end = addHours(v.start, v.hours)
        v.key = `plan:${plan.id}:${date}:${slot.start}` // keep the original key so logs stay attached
      }
      visits.push(v)
    }
  }
  // Moved cleans that land inside the range from a date outside it.
  for (const c of mine) {
    if (c.kind !== 'move' || c.status !== 'confirmed' || c.new_date < from || c.new_date > to) continue
    if (visits.some((v) => v.originalDate === c.visit_date && v.originalStart === c.visit_start)) continue
    const hours = Number(plan.hours_per_visit)
    const start = c.new_time || c.visit_start
    visits.push({
      key: `plan:${plan.id}:${c.visit_date}:${c.visit_start}`, type: 'plan', planId: plan.id, date: c.new_date, start,
      end: addHours(start, hours), hours, cleanerId: plan.cleaner_id || null, skipped: false, moved: c, movePending: null,
      extras: find('extra', c.visit_date, c.visit_start), originalDate: c.visit_date, originalStart: c.visit_start,
    })
  }
  return visits.filter((v) => v.date >= from && v.date <= to).sort(byWhen)
}

function byWhen(a, b) {
  return a.date.localeCompare(b.date) || (a.start || '99').localeCompare(b.start || '99')
}

/** Booked one-off cleans between from and to. */
export function oneOffJobs(enquiries, from, to) {
  return (enquiries || [])
    .filter((e) => ['booked', 'awaiting_deposit', 'completed'].includes(e.status) && e.booked_date && e.booked_date >= from && e.booked_date <= to)
    .map((e) => ({
      key: `enq:${e.id}`, type: 'oneoff', enquiryId: e.id, date: e.booked_date, start: e.booked_time || '',
      end: e.est_hours && e.booked_time ? addHours(e.booked_time, Number(e.est_hours)) : '',
      hours: Number(e.est_hours) || 0, cleanerId: e.cleaner_id || null, skipped: false, status: e.status,
    }))
}

/** All cleans (plans + one-offs) in a date range, skipped ones included and flagged. */
export function allJobs({ plans, changes, enquiries }, from, to) {
  const jobs = []
  for (const p of plans || []) {
    if (!LIVE_PLAN.includes(p.status)) continue
    for (const v of planVisits(p, (changes || []).filter((c) => c.subscription_id === p.id), from, to)) {
      jobs.push({ ...v, paused: p.status === 'paused', plan: p })
    }
  }
  for (const j of oneOffJobs(enquiries, from, to)) {
    jobs.push({ ...j, enquiry: (enquiries || []).find((e) => e.id === j.enquiryId) })
  }
  return jobs.sort(byWhen)
}
