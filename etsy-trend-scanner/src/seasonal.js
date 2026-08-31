/**
 * Seasonal calendar.
 *
 * Etsy demand is overwhelmingly occasion-driven, and the money is made by
 * listing *early*: a listing needs time to accumulate views, favourites and
 * sales before the search algorithm will rank it into a peak. So for each
 * event we track three dates:
 *
 *   event date      - when the occasion happens
 *   buyer peak      - when search volume actually tops out (before the event,
 *                     because of shipping)
 *   list-by date    - buyer peak minus the time a listing needs to rank, minus
 *                     your own build and lead time
 *
 * A niche is "in window" when today is between the list-by date and the buyer
 * peak. Miss the list-by date and you are competing with listings that have a
 * year of sales history.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)
}

export function startOfDay(date) {
  const d = new Date(date)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function addDays(date, days) {
  return new Date(startOfDay(date) + days * DAY_MS)
}

export function toISODate(date) {
  return new Date(startOfDay(date)).toISOString().slice(0, 10)
}

/** Nth occurrence of a weekday in a month. `nth` of -1 means the last one. */
export function nthWeekdayOf(year, month, weekday, nth) {
  if (nth > 0) {
    const first = new Date(Date.UTC(year, month, 1))
    const offset = (weekday - first.getUTCDay() + 7) % 7
    return new Date(Date.UTC(year, month, 1 + offset + (nth - 1) * 7))
  }
  const last = new Date(Date.UTC(year, month + 1, 0))
  const offset = (last.getUTCDay() - weekday + 7) % 7
  return new Date(Date.UTC(year, month + 1, 0 - offset))
}

/** Anonymous Gregorian computus. */
export function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month, day))
}

/**
 * `peakLeadDays` is how far before the event search interest tops out.
 * `rankDays` is how long a listing typically needs to be live before it can
 * compete for that peak — bigger for the crowded events.
 */
export const EVENTS = [
  {
    id: 'valentines',
    name: "Valentine's Day",
    date: (y) => new Date(Date.UTC(y, 1, 14)),
    peakLeadDays: 12,
    rankDays: 45,
    themes: ['valentines gift', 'couples gift', 'anniversary gift', 'love print', 'galentines'],
  },
  {
    id: 'easter',
    name: 'Easter',
    date: easterSunday,
    peakLeadDays: 10,
    rankDays: 35,
    themes: ['easter basket', 'easter printable', 'spring decor', 'bunny gift'],
  },
  {
    id: 'mothers-day-us',
    name: "Mother's Day (US/CA/AU)",
    date: (y) => nthWeekdayOf(y, 4, 0, 2),
    peakLeadDays: 14,
    rankDays: 45,
    themes: ['mothers day gift', 'gift for mum', 'grandma gift', 'new mum gift'],
  },
  {
    id: 'mothers-day-uk',
    name: "Mother's Day (UK, Mothering Sunday)",
    date: (y) => addDays(easterSunday(y), -21),
    peakLeadDays: 12,
    rankDays: 35,
    themes: ['mothers day gift uk', 'mum gift', 'mothering sunday'],
  },
  {
    id: 'graduation',
    name: 'Graduation season',
    date: (y) => new Date(Date.UTC(y, 4, 25)),
    peakLeadDays: 21,
    rankDays: 40,
    themes: ['graduation gift', 'grad party decor', 'graduation card', 'teacher retirement gift'],
  },
  {
    id: 'fathers-day',
    name: "Father's Day",
    date: (y) => nthWeekdayOf(y, 5, 0, 3),
    peakLeadDays: 12,
    rankDays: 40,
    themes: ['fathers day gift', 'gift for dad', 'grandad gift', 'new dad gift'],
  },
  {
    id: 'wedding-season',
    name: 'Peak wedding season',
    date: (y) => new Date(Date.UTC(y, 6, 1)),
    peakLeadDays: 90,
    rankDays: 60,
    themes: ['wedding sign', 'bridesmaid gift', 'wedding favour', 'wedding invitation template'],
  },
  {
    id: 'back-to-school',
    name: 'Back to school',
    date: (y) => new Date(Date.UTC(y, 7, 20)),
    peakLeadDays: 21,
    rankDays: 40,
    themes: ['teacher gift', 'back to school', 'classroom decor', 'student planner'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    date: (y) => new Date(Date.UTC(y, 9, 31)),
    peakLeadDays: 18,
    rankDays: 55,
    themes: ['halloween decor', 'spooky print', 'halloween costume accessory', 'fall decor'],
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    date: (y) => nthWeekdayOf(y, 10, 4, 4),
    peakLeadDays: 14,
    rankDays: 40,
    themes: ['thanksgiving decor', 'friendsgiving', 'gratitude printable', 'table setting'],
  },
  {
    id: 'q4-gifting',
    name: 'Q4 gifting rush (Black Friday to Christmas)',
    date: (y) => new Date(Date.UTC(y, 11, 12)),
    peakLeadDays: 28,
    rankDays: 55,
    themes: [
      'christmas gift',
      'stocking filler',
      'secret santa gift',
      'christmas decor',
      'personalised christmas',
      'advent calendar',
    ],
  },
  {
    id: 'new-year',
    name: 'New Year reset',
    date: (y) => new Date(Date.UTC(y, 0, 1)),
    peakLeadDays: 5,
    rankDays: 35,
    themes: ['{year} planner', 'goal planner', 'habit tracker', 'new year printable'],
  },
]

/**
 * The next occurrence of every event relative to `today`, with the derived
 * listing deadlines. Events already past this year roll to next year.
 */
export function upcomingEvents(today = new Date(), { horizonDays = 365 } = {}) {
  const now = new Date(startOfDay(today))
  const year = now.getUTCFullYear()
  const rows = []

  for (const event of EVENTS) {
    for (const candidateYear of [year, year + 1]) {
      const date = event.date(candidateYear)
      const peakDate = addDays(date, -event.peakLeadDays)
      const daysToEvent = daysBetween(now, date)
      const daysToPeak = daysBetween(now, peakDate)
      // Once the buyer peak has passed, this year's run is over.
      if (daysToPeak < -3) continue
      if (daysToEvent > horizonDays) continue
      rows.push({
        ...event,
        // Themes may carry a {year} placeholder ("2027 planner"), which only
        // becomes concrete once we know which year's occurrence this is.
        themes: event.themes.map((theme) => theme.replace('{year}', String(candidateYear))),
        year: candidateYear,
        date,
        peakDate,
        daysToEvent,
        daysToPeak,
      })
      break
    }
  }

  return rows.sort((a, b) => a.daysToPeak - b.daysToPeak)
}

/**
 * Words that appear in almost every Etsy theme and therefore carry no
 * occasion-specific signal. Without this list, any term containing "gift"
 * matches every gifting holiday on the calendar.
 */
const GENERIC_THEME_WORDS = new Set([
  'gift',
  'gifts',
  'decor',
  'print',
  'prints',
  'card',
  'cards',
  'sign',
  'signs',
  'template',
  'printable',
  'planner',
  'party',
  'accessory',
  'setting',
  'filler',
  'season',
  'personalised',
  'personalized',
  'custom',
  'lover',
])

export function themeMatches(term, theme) {
  const haystack = String(term).toLowerCase()
  if (haystack.includes(theme)) return true
  return theme
    .split(' ')
    .filter((word) => word.length > 3 && !GENERIC_THEME_WORDS.has(word))
    .some((word) => haystack.includes(word))
}

/**
 * Seasonal fit for one candidate, in 0..100, or null when the term has no
 * occasion attached at all. Null rather than zero matters: an evergreen niche
 * should be scored on its other merits, not penalised for the absence of a
 * holiday it was never going to have.
 *
 * Where a term does match an event, the score peaks at the list-by date — the
 * point where you still have runway to rank but are not sitting on stock for
 * months. It falls off sharply once that date passes.
 */
export function seasonalFit({
  term,
  today = new Date(),
  profile = {},
  effortDays = 2,
  events = upcomingEvents(today),
} = {}) {
  const buildDays = (profile.leadTimeDays ?? 7) + effortDays
  let best = null

  for (const event of events) {
    if (!event.themes.some((theme) => themeMatches(term, theme))) continue

    const rampDays = Math.max(profile.rankRampDays ?? 21, event.rankDays)
    const listByDate = addDays(event.peakDate, -(rampDays + buildDays))
    const daysToListBy = daysBetween(today, listByDate)

    // Score shape: 100 on the list-by date, decaying either side. Being early
    // is a mild penalty — you can simply wait. Being late decays from a
    // ceiling below the "seasonal window" threshold, so a window you have
    // already missed can never outrank one that is still open, however
    // narrowly it was missed.
    const score =
      daysToListBy >= 0
        ? Math.max(0, 100 - daysToListBy * 1.2)
        : Math.max(0, 55 + daysToListBy * 5.5)

    if (!best || score > best.score) {
      best = {
        score: Math.round(score),
        event: event.name,
        eventId: event.id,
        eventDate: toISODate(event.date),
        peakDate: toISODate(event.peakDate),
        listByDate: toISODate(listByDate),
        daysToListBy,
        missed: daysToListBy < 0,
      }
    }
  }

  return best ?? { score: null, event: null, eventId: null, missed: false }
}

/** Every seasonal theme currently worth watching, for keyword expansion. */
export function activeSeasonalThemes(today = new Date(), { withinDays = 150 } = {}) {
  const out = []
  for (const event of upcomingEvents(today)) {
    if (event.daysToPeak > withinDays) continue
    for (const theme of event.themes) out.push({ term: theme, category: 'seasonal', event: event.id })
  }
  return out
}
