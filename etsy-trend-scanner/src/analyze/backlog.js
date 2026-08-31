/**
 * What is new to *you*, as distinct from what is new to the world.
 *
 * Trend persistence answers "how long has this been trending". This answers the
 * question a daily reader actually has when they open the report: "have you
 * already told me this?"
 *
 * It matters more than it sounds. A niche that keeps qualifying gets
 * recommended again every morning with the same product, the same price and
 * the same tags, and a report that repeats itself verbatim stops being opened
 * by the end of the first week. The information is not wrong — it is just not
 * news, and it needs to be labelled as such rather than dressed up as fresh.
 *
 * Deliberately not a suppression mechanism. If you have not acted on something
 * yet, hiding it is the wrong move — it is still the best thing to list. It is
 * marked as standing, with how long it has been standing, and the new items are
 * counted separately so the day has a headline.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param {string} term
 * @param {object} reportLog `{ "2026-08-30": ["term", ...] }`
 * @param {string} today ISO date of the report being built
 */
export function backlogAge(term, reportLog = {}, today) {
  const dates = Object.keys(reportLog)
    .filter((date) => date < today && (reportLog[date] ?? []).includes(term))
    .sort()

  if (dates.length === 0) {
    return { firstRecommendedOn: today, timesRecommended: 1, daysStanding: 0, isNew: true }
  }

  const firstRecommendedOn = dates[0]
  return {
    firstRecommendedOn,
    // Including today's appearance, which has not been written to the log yet.
    timesRecommended: dates.length + 1,
    daysStanding: Math.round((new Date(today) - new Date(firstRecommendedOn)) / DAY_MS),
    isNew: false,
  }
}

/** A short label for the card: "new today", or how long it has been standing. */
export function backlogLabel(backlog) {
  if (!backlog) return null
  if (backlog.isNew) return 'new today'
  if (backlog.daysStanding === 1) return 'also on yesterday’s list'
  return `on your list ${backlog.daysStanding} days`
}

/**
 * Annotate scored rows, and count what is actually new.
 *
 * The count is what gives the daily read a headline: "3 new since yesterday"
 * is a reason to open it, and "nothing new today" is an honest and useful
 * thing for a report to say.
 */
export function annotateBacklog(rows = [], reportLog = {}, today) {
  const annotated = rows.map((row) => ({ ...row, backlog: backlogAge(row.term, reportLog, today) }))
  return {
    rows: annotated,
    newCount: annotated.filter((row) => row.backlog.isNew).length,
    standingCount: annotated.filter((row) => !row.backlog.isNew).length,
  }
}
