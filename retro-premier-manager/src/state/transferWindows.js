// Transfer windows: a summer window at the start of the season and a
// winter window around the turn of the year, mirroring English football's
// registration deadlines. Outside these weeks, clubs cannot buy or sell
// players to one another - contract renewals and releasing your own
// players to free agency are unaffected, since neither is a transfer.
export const SUMMER_WINDOW_WEEKS = [1, 2, 3, 4]
export const WINTER_WINDOW_WEEKS = [20, 21, 22, 23]

export function isTransferWindowOpen(week) {
  return SUMMER_WINDOW_WEEKS.includes(week) || WINTER_WINDOW_WEEKS.includes(week)
}

// Returns { open, label, closesAfterWeek } when open, or
// { open, label, opensWeek } when closed (opensWeek is null once both
// windows for the season have passed - it reopens at week 1 next season).
export function windowStatus(week) {
  if (SUMMER_WINDOW_WEEKS.includes(week)) {
    return { open: true, label: 'Summer Transfer Window', closesAfterWeek: SUMMER_WINDOW_WEEKS[SUMMER_WINDOW_WEEKS.length - 1] }
  }
  if (WINTER_WINDOW_WEEKS.includes(week)) {
    return { open: true, label: 'Winter Transfer Window', closesAfterWeek: WINTER_WINDOW_WEEKS[WINTER_WINDOW_WEEKS.length - 1] }
  }
  const opensWeek = week < WINTER_WINDOW_WEEKS[0] ? WINTER_WINDOW_WEEKS[0] : null
  return { open: false, label: 'Transfer Window Closed', opensWeek }
}
