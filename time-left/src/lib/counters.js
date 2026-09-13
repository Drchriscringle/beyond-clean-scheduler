import {
  MS_PER_DAY,
  addYears,
  countAnniversaries,
  countWeekdays,
  daysBetween,
  daysInMonth,
} from './dates.js'

const SYNODIC_MONTH_DAYS = 29.530588853
// A full moon everyone agrees on, to count forwards and backwards from.
const REFERENCE_FULL_MOON = Date.UTC(2000, 0, 21, 4, 40)

export const SEASONS = [
  { id: 'spring', label: 'Springs', northStartMonth: 2 },
  { id: 'summer', label: 'Summers', northStartMonth: 5 },
  { id: 'autumn', label: 'Autumns', northStartMonth: 8 },
  { id: 'winter', label: 'Winters', northStartMonth: 11 },
]

/**
 * Counts meteorological seasons that are still to come, or are happening now.
 * A season you are standing in the middle of counts: it is not over yet.
 */
export function countSeasons(from, to, season, hemisphere = 'n') {
  if (to <= from) return 0
  const startMonth = hemisphere === 's' ? (season.northStartMonth + 6) % 12 : season.northStartMonth
  let count = 0
  for (let year = from.getFullYear() - 1; year <= to.getFullYear() + 1; year += 1) {
    const start = new Date(year, startMonth, 1)
    const end = new Date(year, startMonth + 3, 1)
    if (end > from && start <= to) count += 1
  }
  return count
}

/** Full moons falling in `(from, to]`. */
export function countFullMoons(from, to) {
  if (to <= from) return 0
  const cycles = (time) => (time - REFERENCE_FULL_MOON) / (SYNODIC_MONTH_DAYS * MS_PER_DAY)
  const first = Math.ceil(cycles(from.getTime()))
  const last = Math.floor(cycles(to.getTime()))
  return Math.max(0, last - first + 1)
}

/** Events that repeat every `interval` years, counted from a known edition. */
function countRecurringEvent(from, to, { month, day, knownYear, interval }) {
  if (to <= from) return 0
  let count = 0
  const firstYear = knownYear + Math.ceil((from.getFullYear() - knownYear) / interval) * interval
  for (let year = firstYear; year <= to.getFullYear() + interval; year += interval) {
    const when = new Date(year, month, Math.min(day, daysInMonth(year, month)))
    if (when > from && when <= to) count += 1
  }
  return count
}

const ROUGH_RATES = {
  heartBeatsPerMinute: 72,
  breathsPerMinute: 16,
  mealsPerDay: 3,
  cupsPerDay: 2,
  booksPerYear: 12,
  sleepHoursPerDay: 8,
}

/**
 * Everything that can be counted between now and the estimated end date.
 * Grouped the way the app shows them, so the UI stays a thin layer over this.
 */
export function buildCounters({ now, endDate, birth, hemisphere = 'n' }) {
  const days = Math.max(0, daysBetween(now, endDate))
  const weeks = Math.floor(days / 7)
  const months = Math.max(
    0,
    (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth()),
  )
  const minutes = Math.max(0, (endDate.getTime() - now.getTime()) / 60000)

  const season = (id) => {
    const found = SEASONS.find((entry) => entry.id === id)
    return countSeasons(now, endDate, found, hemisphere)
  }

  return [
    {
      id: 'seasons',
      title: 'Seasons',
      note: hemisphere === 's' ? 'Southern hemisphere seasons' : 'Northern hemisphere seasons',
      items: [
        { id: 'summers', label: 'Summers', value: season('summer'), accent: true },
        { id: 'winters', label: 'Winters', value: season('winter'), accent: true },
        { id: 'springs', label: 'Springs', value: season('spring') },
        { id: 'autumns', label: 'Autumns', value: season('autumn') },
      ],
    },
    {
      id: 'weeks',
      title: 'The shape of a week',
      items: [
        { id: 'weekends', label: 'Weekends', value: countWeekdays(now, endDate, 6), accent: true },
        { id: 'fridays', label: 'Friday nights', value: countWeekdays(now, endDate, 5) },
        { id: 'mondays', label: 'Monday mornings', value: countWeekdays(now, endDate, 1) },
        { id: 'weeks', label: 'Weeks', value: weeks },
      ],
    },
    {
      id: 'calendar',
      title: 'Dates that come round',
      items: [
        {
          id: 'birthdays',
          label: 'Birthdays',
          value: countAnniversaries(now, endDate, birth.getMonth(), birth.getDate()),
          accent: true,
        },
        {
          id: 'newyears',
          label: 'New Year Eves',
          value: countAnniversaries(now, endDate, 11, 31),
        },
        {
          id: 'december25',
          label: '25 Decembers',
          value: countAnniversaries(now, endDate, 11, 25),
        },
        {
          id: 'leapdays',
          label: 'Leap days',
          value: countAnniversaries(now, endDate, 1, 29),
        },
      ],
    },
    {
      id: 'sky',
      title: 'Overhead',
      items: [
        { id: 'sunrises', label: 'Sunrises', value: days, accent: true },
        { id: 'fullmoons', label: 'Full moons', value: countFullMoons(now, endDate) },
        {
          id: 'olympics',
          label: 'Summer Olympics',
          value: countRecurringEvent(now, endDate, {
            month: 6,
            day: 20,
            knownYear: 2028,
            interval: 4,
          }),
        },
        {
          id: 'worldcups',
          label: 'World Cups',
          value: countRecurringEvent(now, endDate, {
            month: 5,
            day: 15,
            knownYear: 2026,
            interval: 4,
          }),
        },
      ],
    },
    {
      id: 'ordinary',
      title: 'Ordinary things, at a rough rate',
      note: 'Assumes 72 beats and 16 breaths a minute, three meals and two hot drinks a day, a book a month.',
      items: [
        {
          id: 'heartbeats',
          label: 'Heartbeats',
          value: Math.round(minutes * ROUGH_RATES.heartBeatsPerMinute),
          compact: true,
        },
        {
          id: 'breaths',
          label: 'Breaths',
          value: Math.round(minutes * ROUGH_RATES.breathsPerMinute),
          compact: true,
        },
        { id: 'meals', label: 'Meals', value: days * ROUGH_RATES.mealsPerDay },
        { id: 'sleeps', label: 'Nights of sleep', value: days },
        { id: 'cups', label: 'Hot drinks', value: days * ROUGH_RATES.cupsPerDay },
        {
          id: 'books',
          label: 'Books, one a month',
          value: Math.floor((days / 365.2425) * ROUGH_RATES.booksPerYear),
        },
      ],
    },
    {
      id: 'span',
      title: 'The whole span',
      items: [
        { id: 'days', label: 'Days', value: days, accent: true },
        { id: 'months', label: 'Months', value: months },
        {
          id: 'sleeping',
          label: 'Hours you will be asleep',
          value: days * ROUGH_RATES.sleepHoursPerDay,
        },
        {
          id: 'awake',
          label: 'Hours awake',
          value: days * (24 - ROUGH_RATES.sleepHoursPerDay),
        },
      ],
    },
  ]
}

/** The same counting, run backwards over the life already lived. */
export function buildLivedCounters({ birth, now, hemisphere = 'n' }) {
  const days = Math.max(0, daysBetween(birth, now))
  return [
    { id: 'days-lived', label: 'Days lived', value: days },
    {
      id: 'weekends-lived',
      label: 'Weekends had',
      value: countWeekdays(birth, now, 6),
    },
    {
      id: 'summers-lived',
      label: 'Summers seen',
      value: countSeasons(
        birth,
        now,
        SEASONS.find((season) => season.id === 'summer'),
        hemisphere,
      ),
    },
    { id: 'moons-lived', label: 'Full moons', value: countFullMoons(birth, now) },
  ]
}

/**
 * One-off dates worth knowing about, each marked with whether the estimate has
 * you there to see it.
 */
export function buildMilestones({ birth, now, endDate }) {
  const milestones = []
  const currentAge = now.getFullYear() - birth.getFullYear()

  for (let age = 30; age <= 100; age += 10) {
    if (age <= currentAge) continue
    const date = addYears(birth, age)
    if (date <= now) continue
    milestones.push({ id: `birthday-${age}`, label: `Your ${age}th birthday`, date })
    if (milestones.length >= 4) break
  }

  milestones.push(
    { id: 'olympics-2028', label: 'Los Angeles Olympics', date: new Date(2028, 6, 14) },
    { id: 'worldcup-2030', label: 'World Cup centenary', date: new Date(2030, 5, 8) },
    { id: 'midcentury', label: 'The year 2050', date: new Date(2050, 0, 1) },
    { id: 'halley', label: "Halley's Comet returns", date: new Date(2061, 6, 28) },
    { id: 'century', label: 'The 22nd century', date: new Date(2100, 0, 1) },
  )

  return milestones
    .filter((milestone) => milestone.date > now)
    .sort((a, b) => a.date - b.date)
    .map((milestone) => ({ ...milestone, likely: milestone.date <= endDate }))
}
