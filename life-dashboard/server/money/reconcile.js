import { addDays } from '../lib/dates.js'
import { dueBetween } from './schedule.js'

/**
 * Comparing what you expected to pay with what actually left the account.
 *
 * This is where a dashboard earns its keep over a list of bills: it catches
 * the subscription that quietly went up, the direct debit that did not come
 * out, and the recurring payment you never set up and had forgotten you were
 * making. Those three are the whole point.
 */

/** A payment may land a few days either side of its nominal date. */
const DEFAULT_TOLERANCE_DAYS = 4
/** Below this, an amount change is rounding or a fee, not a price rise. */
const MATERIAL_CHANGE_PENCE = 50

/**
 * Normalises a bank description enough to compare it with a commitment name.
 *
 * Bank narratives are shouty and full of noise: "DD NETFLIX.COM 1234567 REF
 * 887" should match a commitment called "Netflix". So: lowercase, drop the
 * payment-type prefixes and card/reference numbers, and keep the words.
 */
export function normalizeDescription(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(dd|do|so|bgc|bacs|chaps|faster payments?|fp|direct debit|standing order|card payment|payment to|bill payment|ref|reference|on \d+)\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * How well a bank description matches a commitment name, from 0 to 1.
 *
 * Token overlap rather than edit distance: "NETFLIX.COM 1234" and "Netflix"
 * share the word that matters, while their character-by-character distance is
 * enormous.
 */
export function matchScore(commitmentName, description) {
  const name = normalizeDescription(commitmentName)
  const text = normalizeDescription(description)
  if (!name || !text) return 0
  if (text === name) return 1
  if (text.includes(name) || name.includes(text)) return 0.9

  const nameWords = new Set(name.split(' ').filter((word) => word.length > 2))
  if (nameWords.size === 0) return 0
  const textWords = new Set(text.split(' ').filter((word) => word.length > 2))
  let shared = 0
  for (const word of nameWords) if (textWords.has(word)) shared += 1
  return shared / nameWords.size
}

/**
 * Reconciles expected commitments against real transactions over a window.
 *
 * Returns one entry per expected payment — matched, missing, or changed — plus
 * the transactions that matched nothing, which is where unexpected recurring
 * payments show up.
 */
export function reconcile({
  commitments = [],
  transactions = [],
  from,
  to,
  holidays = [],
  toleranceDays = DEFAULT_TOLERANCE_DAYS,
  minimumScore = 0.6,
} = {}) {
  const expected = dueBetween(commitments, from, to, { holidays })
  const available = transactions
    .filter((transaction) => transaction.day >= addDays(from, -toleranceDays) && transaction.day <= addDays(to, toleranceDays))
    .map((transaction) => ({ ...transaction, claimed: false }))

  const results = []

  for (const item of expected) {
    const wantsOutgoing = item.amountPence < 0
    const candidates = available
      .filter((transaction) => !transaction.claimed)
      .filter((transaction) => (transaction.amountPence < 0) === wantsOutgoing)
      .filter((transaction) => Math.abs(daysApart(transaction.day, item.day)) <= toleranceDays)
      .map((transaction) => ({
        transaction,
        score: matchScore(item.name, transaction.description),
        amountDelta: transaction.amountPence - item.amountPence,
        daysOff: daysApart(transaction.day, item.day),
      }))
      .filter((candidate) => candidate.score >= minimumScore)
      // Best name match first; then the closest amount; then the closest date.
      .sort(
        (a, b) =>
          b.score - a.score ||
          Math.abs(a.amountDelta) - Math.abs(b.amountDelta) ||
          Math.abs(a.daysOff) - Math.abs(b.daysOff),
      )

    const best = candidates[0]
    if (!best) {
      results.push({ ...item, status: pending(item, to) ? 'due' : 'missing', transaction: null })
      continue
    }

    best.transaction.claimed = true
    const changed = Math.abs(best.amountDelta) >= MATERIAL_CHANGE_PENCE
    results.push({
      ...item,
      status: changed ? 'changed' : 'paid',
      transaction: best.transaction,
      paidPence: best.transaction.amountPence,
      deltaPence: best.amountDelta,
      daysOff: best.daysOff,
      confidence: best.score,
    })
  }

  const unmatched = available.filter((transaction) => !transaction.claimed)
  return {
    from,
    to,
    entries: results,
    paid: results.filter((entry) => entry.status === 'paid'),
    changed: results.filter((entry) => entry.status === 'changed'),
    missing: results.filter((entry) => entry.status === 'missing'),
    due: results.filter((entry) => entry.status === 'due'),
    unmatched: unmatched.map(({ claimed: _claimed, ...transaction }) => transaction),
  }
}

/** An expected payment whose date has not arrived yet is due, not missing. */
function pending(item, to) {
  return item.day > to
}

function daysApart(a, b) {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000)
}

/**
 * Finds recurring payments in the transactions that no commitment explains.
 *
 * A charge from the same merchant, for a similar amount, roughly a month
 * apart, more than twice — that is a subscription, whether or not you remember
 * agreeing to it.
 */
export function findUnknownRecurring(unmatched, { minimumOccurrences = 3, amountTolerancePence = 200 } = {}) {
  const groups = new Map()
  for (const transaction of unmatched) {
    if (transaction.amountPence >= 0) continue
    const key = normalizeDescription(transaction.description)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(transaction)
  }

  const found = []
  for (const [key, group] of groups) {
    if (group.length < minimumOccurrences) continue
    const sorted = [...group].sort((a, b) => (a.day < b.day ? -1 : 1))
    const amounts = sorted.map((transaction) => Math.abs(transaction.amountPence))
    const spread = Math.max(...amounts) - Math.min(...amounts)
    if (spread > amountTolerancePence) continue

    const gaps = []
    for (let index = 1; index < sorted.length; index += 1) {
      gaps.push(daysApart(sorted[index].day, sorted[index - 1].day))
    }
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    const regular = gaps.every((gap) => Math.abs(gap - averageGap) <= 5)
    if (!regular || averageGap < 5) continue

    found.push({
      description: sorted[sorted.length - 1].description,
      key,
      occurrences: sorted.length,
      amountPence: amounts[amounts.length - 1],
      averageGapDays: Math.round(averageGap),
      frequency: describeGap(averageGap),
      lastSeen: sorted[sorted.length - 1].day,
      annualPence: Math.round((amounts[amounts.length - 1] * 365) / averageGap),
    })
  }
  return found.sort((a, b) => b.annualPence - a.annualPence)
}

function describeGap(days) {
  if (days <= 8) return 'weekly'
  if (days <= 16) return 'fortnightly'
  if (days <= 32) return 'monthly'
  if (days <= 95) return 'quarterly'
  if (days <= 200) return 'six-monthly'
  return 'annual'
}
