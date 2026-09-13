import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, addYears } from './dates.js'

/**
 * Splits a span into calendar years first, then whole days and clock time.
 * Doing the years by calendar rather than by average year length means the
 * countdown never drifts a day out from the date it is counting to.
 */
export function splitCountdown(from, to) {
  const total = to.getTime() - from.getTime()
  if (total <= 0) {
    return { years: 0, days: 0, hours: 0, minutes: 0, seconds: 0, tenths: 0, total: 0 }
  }

  let years = to.getFullYear() - from.getFullYear()
  if (addYears(from, years) > to) years -= 1
  let rest = to.getTime() - addYears(from, years).getTime()

  const days = Math.floor(rest / MS_PER_DAY)
  rest -= days * MS_PER_DAY
  const hours = Math.floor(rest / MS_PER_HOUR)
  rest -= hours * MS_PER_HOUR
  const minutes = Math.floor(rest / MS_PER_MINUTE)
  rest -= minutes * MS_PER_MINUTE
  const seconds = Math.floor(rest / MS_PER_SECOND)
  rest -= seconds * MS_PER_SECOND

  return { years, days, hours, minutes, seconds, tenths: Math.floor(rest / 100), total }
}

const numberFormat = new Intl.NumberFormat(undefined)

export function formatNumber(value) {
  return numberFormat.format(Math.round(value))
}

const UNITS = [
  { limit: 1e12, suffix: ' trillion', divisor: 1e12 },
  { limit: 1e9, suffix: ' billion', divisor: 1e9 },
  { limit: 1e6, suffix: ' million', divisor: 1e6 },
]

/** Big numbers read better in words; anything under a million stays exact. */
export function formatCompact(value) {
  const rounded = Math.round(value)
  for (const unit of UNITS) {
    if (rounded >= unit.limit) {
      const scaled = rounded / unit.divisor
      const digits = scaled >= 100 ? 0 : 1
      return `${scaled.toFixed(digits)}${unit.suffix}`
    }
  }
  return numberFormat.format(rounded)
}

export function formatCount(value, { compact = false } = {}) {
  return compact ? formatCompact(value) : formatNumber(value)
}

export function pad(value, length = 2) {
  return String(Math.max(0, Math.floor(value))).padStart(length, '0')
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatLongDate(date) {
  return dateFormat.format(date)
}

const shortDateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatShortDate(date) {
  return shortDateFormat.format(date)
}

export function formatAge({ years, months, days }) {
  const parts = [
    `${years} ${years === 1 ? 'year' : 'years'}`,
    `${months} ${months === 1 ? 'month' : 'months'}`,
    `${days} ${days === 1 ? 'day' : 'days'}`,
  ]
  return parts.join(', ')
}

export function formatYears(value) {
  return `${value.toFixed(1)} years`
}

export function formatPercent(fraction, digits = 1) {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}
