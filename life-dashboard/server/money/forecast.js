import { addDays, compareDays, eachDay } from '../lib/dates.js'
import { annualisedPence, dueBetween } from './schedule.js'

/**
 * The cashflow forecast.
 *
 * The question this answers is not "what did I spend" — a bank app already
 * does that — but "what is about to leave, and does what I have cover it".
 * So it runs the known commitments forward day by day over the real opening
 * balance and reports the *lowest point*, not the closing balance: a month
 * that ends comfortably can still bounce a direct debit on the 12th, and the
 * closing figure hides exactly that.
 */

export function totalOpeningPence(accounts) {
  return accounts
    .filter((account) => account.includeInForecast !== false)
    .reduce((sum, account) => sum + (account.balancePence ?? 0), 0)
}

/**
 * A day-by-day projection from today to the horizon.
 *
 * `bufferPence` is the float you want to keep untouched — the forecast treats
 * dipping below it as a warning rather than waiting for a real overdraft.
 */
export function forecast({
  accounts = [],
  commitments = [],
  from,
  to,
  holidays = [],
  bufferPence = 0,
  openingPence = null,
}) {
  const opening = openingPence ?? totalOpeningPence(accounts)
  const due = dueBetween(commitments, from, to, { holidays })
  const byDay = new Map()
  for (const item of due) {
    if (!byDay.has(item.day)) byDay.set(item.day, [])
    byDay.get(item.day).push(item)
  }

  const days = []
  let balance = opening
  let incomePence = 0
  let outgoingPence = 0

  for (const day of eachDay(from, to)) {
    const movements = byDay.get(day) ?? []
    const dayOpening = balance
    for (const movement of movements) {
      balance += movement.amountPence
      if (movement.amountPence >= 0) incomePence += movement.amountPence
      else outgoingPence += -movement.amountPence
    }
    days.push({ day, openingPence: dayOpening, movements, closingPence: balance })
  }

  const lowest = days.reduce(
    (worst, day) => (day.closingPence < worst.balancePence ? { day: day.day, balancePence: day.closingPence } : worst),
    { day: from, balancePence: opening },
  )

  // Only the days where something *moves* the balance below the buffer, plus
  // the day a run of them begins. A balance that simply stays low for three
  // weeks is one problem, not twenty-one, and listing every day of it would
  // bury the payments that actually caused it.
  const breaches = []
  let inBreach = false
  for (const day of days) {
    const under = day.closingPence < bufferPence
    if (under && (!inBreach || day.movements.length > 0)) {
      breaches.push({
        day: day.day,
        balancePence: day.closingPence,
        belowZero: day.closingPence < 0,
        // What caused it: the largest outgoing that day.
        trigger: day.movements
          .filter((movement) => movement.amountPence < 0)
          .sort((a, b) => a.amountPence - b.amountPence)[0]?.name ?? null,
      })
    }
    inBreach = under
  }

  return {
    from,
    to,
    openingPence: opening,
    closingPence: balance,
    days,
    due,
    lowest,
    breaches,
    firstBreach: breaches[0] ?? null,
    totals: { incomePence, outgoingPence, netPence: incomePence - outgoingPence },
  }
}

/**
 * The next time money comes in — salary first, then any other income.
 *
 * "Payday" is the unit people actually budget in, so nearly everything the
 * money panel says is framed against the next one.
 */
export function nextPayday(due, from) {
  const income = due
    .filter((item) => item.kind === 'income' && item.day >= from)
    .sort((a, b) => compareDays(a.day, b.day))
  // Wages before anything else: a one-off invoice landing tomorrow is income,
  // but it is not the date the month resets around.
  const wages = income.find((item) => item.category === 'salary' || item.category === 'benefit')
  const chosen = wages ?? income[0] ?? null
  return chosen ? { day: chosen.day, name: chosen.name, amountPence: chosen.amountPence } : null
}

/**
 * The headline the money panel leads with: what is still to leave before the
 * next payday, and what that leaves you with.
 *
 * `safeToSpendPence` is measured at the *lowest* point between now and payday,
 * minus the buffer — spending that much today still clears every commitment in
 * between.
 */
export function runway({ forecast: projection, bufferPence = 0, from }) {
  const payday = nextPayday(projection.due, from)
  const until = payday ? payday.day : projection.to

  const upcoming = projection.due.filter((item) => item.day >= from && item.day <= until)
  const outgoing = upcoming.filter((item) => item.amountPence < 0)
  const outgoingPence = outgoing.reduce((sum, item) => sum + -item.amountPence, 0)

  const window = projection.days.filter((day) => day.day >= from && day.day <= until)
  const lowestPence = window.reduce(
    (lowest, day) => Math.min(lowest, day.closingPence),
    projection.openingPence,
  )

  return {
    payday,
    daysToPayday: payday ? window.length - 1 : null,
    outgoingBeforePaydayPence: outgoingPence,
    outgoingCount: outgoing.length,
    lowestBeforePaydayPence: lowestPence,
    safeToSpendPence: Math.max(0, lowestPence - bufferPence),
    tight: lowestPence < bufferPence,
  }
}

/** Commitments due in the next `days`, for the "coming up" list. */
export function dueSoon(due, from, days = 14) {
  const to = addDays(from, days)
  return due.filter((item) => item.day >= from && item.day <= to)
}

/**
 * What the whole set of commitments costs per year, grouped by category.
 *
 * Annualising is the only honest way to compare a £14 monthly subscription
 * with a £180 annual one — and seeing subscriptions add up to four figures a
 * year is usually the moment one of them gets cancelled.
 */
export function annualBreakdown(commitments) {
  const groups = new Map()
  for (const commitment of commitments) {
    if (commitment.active === false) continue
    const annual = annualisedPence(commitment)
    if (annual === 0) continue
    const key = commitment.kind === 'income' ? 'income' : (commitment.category ?? 'other')
    groups.set(key, (groups.get(key) ?? 0) + annual)
  }
  return [...groups.entries()]
    .map(([category, annualPence]) => ({ category, annualPence, monthlyPence: Math.round(annualPence / 12) }))
    .sort((a, b) => b.annualPence - a.annualPence)
}
