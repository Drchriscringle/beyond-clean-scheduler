export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = 60 * MS_PER_SECOND
export const MS_PER_HOUR = 60 * MS_PER_MINUTE
export const MS_PER_DAY = 24 * MS_PER_HOUR

/** Mean length of a Gregorian year, used whenever a duration has to become years. */
export const DAYS_PER_YEAR = 365.2425
export const MS_PER_YEAR = DAYS_PER_YEAR * MS_PER_DAY

/** Parses a `YYYY-MM-DD` string into local midnight, or null if it is not a real date. */
export function parseDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function toISODate(date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Adds whole years, clamping 29 February onto 28 February in a common year. */
export function addYears(date, years) {
  const result = new Date(date)
  const day = date.getDate()
  result.setDate(1)
  result.setFullYear(date.getFullYear() + years)
  result.setDate(Math.min(day, daysInMonth(result.getFullYear(), result.getMonth())))
  return result
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Adds a fractional number of years: whole years by the calendar, the rest by clock. */
export function addYearsFraction(date, years) {
  const whole = Math.trunc(years)
  const rest = years - whole
  return new Date(addYears(date, whole).getTime() + rest * MS_PER_YEAR)
}

/** Adds whole months, clamping onto the last day of a shorter month. */
export function addMonths(date, months) {
  const result = new Date(date)
  const day = date.getDate()
  result.setDate(1)
  result.setMonth(date.getMonth() + months)
  result.setDate(Math.min(day, daysInMonth(result.getFullYear(), result.getMonth())))
  return result
}

/**
 * The age you would say out loud: whole years, then whole months, then days.
 * Walking the calendar forward rather than subtracting fields keeps month ends
 * honest - 31 January to 1 March is one month and one day, not one month and
 * minus one day. Negative spans (a birth date in the future) come back as zeroes.
 */
export function exactAge(birth, now) {
  if (now <= birth) return { years: 0, months: 0, days: 0 }

  let years = now.getFullYear() - birth.getFullYear()
  if (addYears(birth, years) > now) years -= 1
  let cursor = addYears(birth, years)

  let months = (now.getFullYear() - cursor.getFullYear()) * 12 + (now.getMonth() - cursor.getMonth())
  if (addMonths(cursor, months) > now) months -= 1
  cursor = addMonths(cursor, months)

  return { years, months, days: daysBetween(cursor, now) }
}

/** Age as a decimal number of years, for the arithmetic that needs one number. */
export function ageInYears(birth, now) {
  return (now.getTime() - birth.getTime()) / MS_PER_YEAR
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole days from `from` to `to`, counted by calendar day so DST cannot shift it. */
export function daysBetween(from, to) {
  const a = startOfDay(from)
  const b = startOfDay(to)
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/**
 * How many times a weekday (0 = Sunday) falls in `(from, to]`.
 * Today does not count: if it is Saturday afternoon, that weekend is already going.
 */
export function countWeekdays(from, to, weekday) {
  const days = daysBetween(from, to)
  if (days <= 0) return 0
  const firstOffset = ((weekday - startOfDay(from).getDay() + 7) % 7) || 7
  if (firstOffset > days) return 0
  return Math.floor((days - firstOffset) / 7) + 1
}

/**
 * How many times a fixed calendar date (e.g. 25 December) falls in `(from, to]`.
 * `monthIndex` is 0-based. 29 February only counts in leap years.
 */
export function countAnniversaries(from, to, monthIndex, day) {
  if (to <= from) return 0
  let count = 0
  for (let year = from.getFullYear(); year <= to.getFullYear(); year += 1) {
    if (monthIndex === 1 && day === 29 && daysInMonth(year, 1) < 29) continue
    const occurrence = new Date(year, monthIndex, day)
    if (occurrence > from && occurrence <= to) count += 1
  }
  return count
}
