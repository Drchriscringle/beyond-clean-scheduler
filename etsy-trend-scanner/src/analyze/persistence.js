/**
 * Trend persistence — how long something has been trending, and how steadily.
 *
 * The single biggest weakness of same-day trend discovery is that most of what
 * spikes on any given day is noise: a passing news blip, a one-off mention, a
 * feed artefact. A term still trending on day four is a different proposition
 * from the same term on day one, and until now the scorer could not tell them
 * apart — both arrived with identical momentum.
 *
 * The awkward part is that day one is also when acting is worth most. Being
 * early is the entire thesis of this tool, so persistence must not be used to
 * punish new trends into invisibility. It is used to set *confidence* and to
 * reward what has proven itself, never to hide what is new. A first-day trend
 * still gets recommended; it gets recommended with "first seen today" attached.
 *
 * Robust to missed scans on purpose. If the scheduled job fails on a Tuesday
 * that is our outage, not the trend going quiet, so persistence is measured as
 * a share of the scans that actually ran rather than as calendar days.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetweenIso(from, to) {
  return Math.round((new Date(to) - new Date(from)) / DAY_MS)
}

/**
 * @param {Array} history stored snapshot rows for one term, oldest first. Only
 *   contains the days the term was actually scanned.
 * @param {Array<string>} scanDates every date the scanner ran, oldest first —
 *   needed to tell "the trend stopped" from "we did not look".
 */
export function trendPersistence(history = [], { scanDates = [] } = {}) {
  const appearances = history
    .filter((row) => row.origin === 'trending' || row.trending)
    .map((row) => row.date)
    .sort()

  if (appearances.length === 0) return null

  const firstSeen = appearances[0]
  const lastSeen = appearances[appearances.length - 1]

  // Scans that ran on or after the day this trend first appeared. That is the
  // fair denominator: a trend discovered yesterday cannot have appeared in
  // scans that predate it.
  const scansSince = scanDates.filter((date) => date >= firstSeen)
  const opportunities = Math.max(scansSince.length, appearances.length)

  const consistency = opportunities > 0 ? appearances.length / opportunities : 1
  const daysKnown = daysBetweenIso(firstSeen, lastSeen) + 1

  return {
    firstSeen,
    lastSeen,
    appearances: appearances.length,
    opportunities,
    daysKnown,
    consistency,
    isNew: appearances.length === 1,
    // Two independent scans agreeing is the point at which a spike stops
    // looking like a feed artefact.
    proven: appearances.length >= 2,
    sustained: appearances.length >= 3 && consistency >= 0.6,
  }
}

/**
 * Confidence adjustment from persistence, as a label rather than a number.
 *
 * Deliberately not folded into the opportunity score: a new trend and a proven
 * one can be equally good bets, and flattening that into one number would hide
 * exactly the distinction a seller needs to make for themselves.
 */
export function persistenceVerdict(persistence) {
  if (!persistence) return null
  if (persistence.sustained) {
    return {
      label: 'sustained',
      note: `Trending ${persistence.appearances} scans running since ${persistence.firstSeen} — this one has legs`,
    }
  }
  if (persistence.proven) {
    return {
      label: 'confirmed',
      note: `Seen trending on ${persistence.appearances} separate scans since ${persistence.firstSeen}, so not a one-day blip`,
    }
  }
  return {
    label: 'unproven',
    note: 'First seen trending today — could be a real trend starting or a one-day news blip, and there is no way to tell yet',
  }
}

/**
 * A trend that appeared, vanished, and came back is worth flagging separately:
 * it is usually episodic (a recurring event, a show releasing weekly) rather
 * than a trend building.
 */
export function isFlickering(persistence) {
  if (!persistence || persistence.appearances < 2) return false
  return persistence.consistency < 0.5 && persistence.opportunities >= 4
}
