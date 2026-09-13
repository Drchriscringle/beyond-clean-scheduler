/**
 * Converting between a wall-clock time in some timezone and a real instant,
 * using only Intl — no timezone database dependency.
 *
 * Calendar feeds hand you all three kinds of time: a UTC instant
 * (20260913T080000Z), a wall-clock time tagged with a zone
 * (TZID=Europe/London:20260913T090000), and a floating time with no zone at
 * all. They have to end up as one comparable thing before they can share an
 * agenda with a bill due date.
 */

const FORMATTERS = new Map()

function formatterFor(timeZone) {
  let formatter = FORMATTERS.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    FORMATTERS.set(timeZone, formatter)
  }
  return formatter
}

function partsIn(timeZone, instant) {
  const parts = {}
  for (const { type, value } of formatterFor(timeZone).formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value)
  }
  // Intl renders midnight as hour 24 in some ICU versions.
  if (parts.hour === 24) parts.hour = 0
  return parts
}

/** The zone's offset from UTC, in milliseconds, at a given instant. */
export function offsetAt(timeZone, instant) {
  const parts = partsIn(timeZone, instant)
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The instant at which the given wall-clock time occurs in the given zone.
 *
 * The offset depends on the instant, and the instant depends on the offset, so
 * this guesses using the offset at the naive time and then corrects. One
 * correction is enough for every real zone; a second pass settles the edge
 * where the guess landed on the far side of a daylight saving change.
 */
export function zonedTimeToInstant({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second)
  let instant = new Date(naive - offsetAt(timeZone, new Date(naive)))
  instant = new Date(naive - offsetAt(timeZone, instant))
  return instant
}

/** An instant, as the day key and clock time a person in that zone would read. */
export function instantToZoned(instant, timeZone) {
  const parts = partsIn(timeZone, instant)
  const pad = (value) => String(value).padStart(2, '0')
  return {
    day: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    minutes: parts.hour * 60 + parts.minute,
  }
}
