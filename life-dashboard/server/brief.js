import { createCalendar } from './calendar/agenda.js'
import { addDays, formatDay, relativeDay, today as todayIn } from './lib/dates.js'
import { annualBreakdown, dueSoon, forecast, runway } from './money/forecast.js'
import { ensureBankHolidays } from './money/holidays.js'
import { findUnknownRecurring, reconcile } from './money/reconcile.js'
import { review } from './objectives.js'
import { createReel } from './news/reel.js'

/**
 * The whole dashboard for one day, in one object.
 *
 * Everything the UI and the CLI show is built here, so the morning summary in
 * a terminal and the page in a browser can never drift apart. Each panel is
 * assembled independently and a panel that fails carries its error instead of
 * taking the others down — losing the news feed should not cost you today's
 * meetings.
 */

export const DEFAULT_PROFILE = {
  name: null,
  timezone: 'Europe/London',
  currency: 'GBP',
  locale: 'en-GB',
  bufferPence: 0,
  horizonDays: 60,
  agendaDays: 7,
  newsDays: 7,
  newsCountry: 'GB',
  newsLanguage: 'en-GB',
  bankHolidayDivision: 'england-and-wales',
}

export function profileOf(stored = {}) {
  return { ...DEFAULT_PROFILE, ...stored }
}

export function createBrief({ store, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const calendar = createCalendar({ store, fetchImpl, now: () => now().getTime() })
  const reel = createReel({ store, fetchImpl, now: () => now().getTime() })

  return {
    calendar,
    reel,

    async build({ day = null, refresh = true, includeNews = true } = {}) {
      const profile = profileOf(await store.get('profile'))
      const today = day ?? todayIn(profile.timezone, now())

      const [accounts, commitments, transactions, objectives, holidays] = await Promise.all([
        store.get('accounts'),
        store.get('commitments'),
        store.get('transactions'),
        store.get('objectives'),
        ensureBankHolidays({ store, fetchImpl, now: () => now().getTime() }),
      ])

      const [agenda, news] = await Promise.all([
        settled(() => calendar.between(today, addDays(today, profile.agendaDays), {
          zone: profile.timezone,
          refresh,
        })),
        includeNews
          ? settled(() => reel.build({ today, days: profile.newsDays }))
          : Promise.resolve({ value: { items: [], problems: [], targets: [] }, error: null }),
      ])

      const money = buildMoney({ profile, today, accounts, commitments, transactions, holidays })
      const plans = review(objectives, today)

      return {
        today,
        generatedAt: now().toISOString(),
        profile,
        greeting: greetingFor(now(), profile),
        heading: formatDay(today),
        agenda: buildAgenda(agenda, today, profile),
        money,
        news: {
          ...(news.value ?? { items: [], targets: [] }),
          error: news.error,
        },
        objectives: plans,
        attention: attentionFor({ money, plans, agenda: agenda.value, today }),
      }
    },
  }
}

/** Runs a panel, turning a failure into a value the UI can render. */
async function settled(task) {
  try {
    return { value: await task(), error: null }
  } catch (error) {
    return { value: null, error: error.message }
  }
}

function buildAgenda({ value, error }, today, profile) {
  const entries = value?.entries ?? []
  const tomorrow = addDays(today, 1)
  const byDay = new Map()
  for (const entry of entries) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, [])
    byDay.get(entry.day).push(entry)
  }

  return {
    today: byDay.get(today) ?? [],
    tomorrow: byDay.get(tomorrow) ?? [],
    days: [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, items]) => ({
        day,
        label: formatDay(day),
        relative: relativeDay(day, today),
        entries: items,
      })),
    next: entries.find((entry) => entry.day > today) ?? null,
    problems: value?.problems ?? [],
    error,
    windowDays: profile.agendaDays,
  }
}

function buildMoney({ profile, today, accounts, commitments, transactions, holidays }) {
  const horizonEnd = addDays(today, profile.horizonDays)
  const projection = forecast({
    accounts,
    commitments,
    from: today,
    to: horizonEnd,
    holidays,
    bufferPence: profile.bufferPence,
  })
  const ahead = runway({ forecast: projection, bufferPence: profile.bufferPence, from: today })

  // Reconciliation looks back over the last month of statements: long enough
  // to have seen this month's bills, short enough that "missing" means
  // something is wrong now rather than in the spring.
  const checked = reconcile({
    commitments,
    transactions,
    from: addDays(today, -35),
    to: today,
    holidays,
  })

  // Spotting a subscription nobody set up needs a much longer run: a monthly
  // charge cannot repeat three times inside a month, so hunting for it in the
  // window above would only ever find weekly ones.
  const history = reconcile({
    commitments,
    transactions,
    from: addDays(today, -370),
    to: today,
    holidays,
  })

  return {
    accounts,
    openingPence: projection.openingPence,
    runway: ahead,
    dueSoon: dueSoon(projection.due, today, 14),
    breaches: projection.breaches,
    lowest: projection.lowest,
    totals: projection.totals,
    days: projection.days,
    breakdown: annualBreakdown(commitments),
    reconciliation: {
      missing: checked.missing,
      changed: checked.changed,
      paid: checked.paid.length,
      unexpected: findUnknownRecurring(history.unmatched),
    },
    hasTransactions: transactions.length > 0,
    horizonEnd,
  }
}

/**
 * The short list at the top: the handful of things that genuinely want a
 * decision today, ordered by how much they cost to ignore.
 *
 * Kept deliberately small. A dashboard that flags fifteen things flags
 * nothing, so only real breaches, overdue plans and today's commitments earn a
 * place, and the list is capped.
 */
export function attentionFor({ money, plans, agenda, today }) {
  const items = []

  const breach = money.breaches[0]
  if (breach) {
    items.push({
      kind: 'money',
      severity: breach.belowZero ? 'high' : 'medium',
      text: breach.belowZero
        ? `You go overdrawn on ${formatDay(breach.day, { weekday: false })}${breach.trigger ? ` when ${breach.trigger} goes out` : ''}.`
        : `Your balance dips below your buffer on ${formatDay(breach.day, { weekday: false })}.`,
      day: breach.day,
    })
  }

  for (const entry of money.reconciliation.missing.slice(0, 2)) {
    items.push({
      kind: 'money',
      severity: 'medium',
      text: `${entry.name} was due on ${formatDay(entry.day, { weekday: false })} but has not left your account.`,
      day: entry.day,
    })
  }

  for (const entry of money.reconciliation.changed.slice(0, 2)) {
    // Both figures are negative for an outgoing, so a *more* negative delta
    // means it took more money, not less.
    const direction = entry.deltaPence < 0 ? 'higher' : 'lower'
    items.push({
      kind: 'money',
      severity: 'low',
      text: `${entry.name} came out ${direction} than expected — ${formatPence(entry.paidPence)} against ${formatPence(entry.amountPence)}.`,
      day: entry.day,
    })
  }

  for (const objective of plans.overdue.slice(0, 2)) {
    items.push({
      kind: 'objective',
      severity: 'medium',
      text: `"${objective.title}" was due ${relativeDay(objective.dueOn, today)}.`,
      day: objective.dueOn,
    })
  }

  for (const objective of plans.stalled.slice(0, 2)) {
    items.push({
      kind: 'objective',
      severity: 'low',
      text: `"${objective.title}" has not moved in ${objective.idleDays} days.${objective.nextStep ? ` Next: ${objective.nextStep.title}` : ''}`,
      day: null,
    })
  }

  const firstToday = (agenda?.entries ?? []).find((entry) => entry.day === today && !entry.allDay)
  if (firstToday) {
    items.push({
      kind: 'event',
      severity: 'low',
      text: `First today: ${firstToday.title} at ${firstToday.time}.`,
      day: today,
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return items.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 6)
}

function greetingFor(now, profile) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: profile.timezone, hour: '2-digit', hour12: false }).format(now),
  )
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return profile.name ? `${part}, ${profile.name}` : part
}

/** Money as a person writes it. Exported because the CLI and UI both need it. */
export function formatPence(pence, { currency = 'GBP', locale = 'en-GB', signed = false } = {}) {
  const amount = (pence ?? 0) / 100
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  if (!signed) return amount < 0 ? `−${formatted}` : formatted
  return `${amount < 0 ? '−' : '+'}${formatted}`
}
