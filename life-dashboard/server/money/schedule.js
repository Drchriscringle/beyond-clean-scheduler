import { addDays, addMonths, compareDays, isWeekend } from '../lib/dates.js'

/**
 * When money actually moves.
 *
 * This is deliberately not the calendar's RRULE engine, because bills do not
 * behave like meetings. A meeting set for the 31st simply does not happen in
 * February; rent set for the 31st comes out on the 28th. And a direct debit
 * due on a Sunday does not come out on the Sunday — it moves to a working day,
 * which is the difference between "I have enough on Monday" and a failed
 * payment.
 */

export const FREQUENCIES = {
  'one-off': { label: 'One-off', perYear: 0 },
  weekly: { label: 'Weekly', perYear: 52 },
  fortnightly: { label: 'Fortnightly', perYear: 26 },
  'four-weekly': { label: 'Every 4 weeks', perYear: 13 },
  monthly: { label: 'Monthly', perYear: 12 },
  quarterly: { label: 'Quarterly', perYear: 4 },
  'six-monthly': { label: 'Every 6 months', perYear: 2 },
  annual: { label: 'Annually', perYear: 1 },
}

export const CATEGORIES = [
  'direct-debit', 'standing-order', 'subscription', 'bill', 'card',
  'rent-mortgage', 'salary', 'invoice', 'benefit', 'transfer', 'other',
]

/** How a payment falling on a non-working day is moved. */
export const SHIFTS = {
  none: 'Leave it where it falls',
  after: 'Next working day',
  before: 'Previous working day',
}

const DAY_STEPS = { weekly: 7, fortnightly: 14, 'four-weekly': 28 }
const MONTH_STEPS = { monthly: 1, quarterly: 3, 'six-monthly': 6, annual: 12 }

/** A safety net against a malformed schedule spinning forever. */
const MAX_OCCURRENCES = 1000

export function normalizeSchedule(schedule = {}) {
  const frequency = Object.hasOwn(FREQUENCIES, schedule.frequency) ? schedule.frequency : 'monthly'
  return {
    frequency,
    anchor: schedule.anchor ?? null,
    interval: Math.max(1, Number(schedule.interval ?? 1) || 1),
    endOn: schedule.endOn ?? null,
    shift: Object.hasOwn(SHIFTS, schedule.shift) ? schedule.shift : 'none',
  }
}

/**
 * Every date this commitment is due between `from` and `to`.
 *
 * Occurrences are generated from the anchor rather than from the window, so
 * the same schedule always lands on the same days no matter what you ask
 * about — a monthly bill anchored on the 31st keeps returning to the 31st
 * rather than walking backwards a day each February.
 */
export function occurrences(commitment, from, to, { holidays = [] } = {}) {
  const schedule = normalizeSchedule(commitment.schedule)
  const { anchor, frequency, interval } = schedule
  if (!anchor) return []

  const horizon = schedule.endOn && schedule.endOn < to ? schedule.endOn : to
  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays)
  const dates = []

  if (frequency === 'one-off') {
    const moved = shiftToWorkingDay(anchor, schedule.shift, holidaySet)
    return moved >= from && moved <= horizon ? [occurrence(anchor, moved, schedule)] : []
  }

  const dayStep = DAY_STEPS[frequency]
  const monthStep = MONTH_STEPS[frequency]

  // Jump most of the way to the window in one go rather than stepping from the
  // anchor one period at a time — a weekly bill anchored years ago should not
  // cost hundreds of iterations to answer "what is due this month".
  let index = 0
  if (dayStep) {
    const elapsed = Math.floor((Date.parse(`${from}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86_400_000)
    index = Math.max(0, Math.floor(elapsed / (dayStep * interval)) - 1)
  } else if (monthStep) {
    const months = monthsBetween(anchor, from)
    index = Math.max(0, Math.floor(months / (monthStep * interval)) - 1)
  }

  for (let guard = 0; guard < MAX_OCCURRENCES; guard += 1, index += 1) {
    const due = dayStep
      ? addDays(anchor, dayStep * interval * index)
      : addMonths(anchor, monthStep * interval * index)
    if (due > horizon) break
    const moved = shiftToWorkingDay(due, schedule.shift, holidaySet)
    if (moved >= from && moved <= horizon && due >= anchor) {
      dates.push(occurrence(due, moved, schedule))
    }
  }

  return dates.sort((a, b) => compareDays(a.day, b.day))
}

function occurrence(nominal, day, schedule) {
  return { day, nominalDay: nominal, moved: day !== nominal, frequency: schedule.frequency }
}

function monthsBetween(from, to) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/**
 * Moves a date off a weekend or bank holiday, in the direction the payment
 * actually travels. Loops because bank holidays cluster — Christmas can push a
 * payment through four non-working days in a row.
 */
export function shiftToWorkingDay(day, shift, holidays = new Set()) {
  if (shift !== 'after' && shift !== 'before') return day
  const step = shift === 'after' ? 1 : -1
  let moved = day
  for (let guard = 0; guard < 14; guard += 1) {
    if (!isWeekend(moved) && !holidays.has(moved)) return moved
    moved = addDays(moved, step)
  }
  return moved
}

/** What a commitment costs over a year, for comparing unlike frequencies. */
export function annualisedPence(commitment) {
  const schedule = normalizeSchedule(commitment.schedule)
  const perYear = FREQUENCIES[schedule.frequency]?.perYear ?? 0
  return Math.round((commitment.amountPence ?? 0) * (perYear / schedule.interval))
}

/** Signed pence: outgoings are negative, income positive. */
export function signedAmount(commitment) {
  const amount = Math.abs(commitment.amountPence ?? 0)
  return commitment.kind === 'income' ? amount : -amount
}

/**
 * The dated money movements for a set of commitments within a window — the
 * list a forecast runs over.
 */
export function dueBetween(commitments, from, to, { holidays = [] } = {}) {
  const due = []
  for (const commitment of commitments) {
    if (commitment.active === false) continue
    for (const slot of occurrences(commitment, from, to, { holidays })) {
      due.push({
        id: `${commitment.id}:${slot.day}`,
        commitmentId: commitment.id,
        name: commitment.name,
        category: commitment.category ?? 'other',
        kind: commitment.kind === 'income' ? 'income' : 'outgoing',
        accountId: commitment.accountId ?? null,
        amountPence: signedAmount(commitment),
        estimated: Boolean(commitment.variable),
        day: slot.day,
        nominalDay: slot.nominalDay,
        moved: slot.moved,
        frequency: slot.frequency,
      })
    }
  }
  return due.sort((a, b) => compareDays(a.day, b.day) || a.name.localeCompare(b.name))
}
