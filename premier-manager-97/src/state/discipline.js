// Five yellow cards in a season triggers a one-match ban (reset to zero
// afterwards, same as the real accumulation rule); a straight red is an
// immediate ban of its own regardless of prior yellows.
export const SUSPENSION_THRESHOLD = 5

export function applyBookings(squad, bookings, rng = Math.random) {
  if (bookings.length === 0) return { squad, freshIds: [] }
  const freshIds = []
  const next = squad.map((p) => {
    const booking = bookings.find((b) => b.playerId === p.id)
    if (!booking) return p
    if (booking.type === 'red') {
      const banMatches = 1 + (rng() < 0.25 ? 1 : 0)
      freshIds.push(p.id)
      return { ...p, suspended: true, suspensionMatches: Math.max(p.suspensionMatches ?? 0, banMatches) }
    }
    const yellowCards = (p.yellowCards ?? 0) + 1
    if (yellowCards >= SUSPENSION_THRESHOLD) {
      freshIds.push(p.id)
      return { ...p, yellowCards: 0, suspended: true, suspensionMatches: Math.max(p.suspensionMatches ?? 0, 1) }
    }
    return { ...p, yellowCards }
  })
  return { squad: next, freshIds }
}

// Weekly countdown, run once per club regardless of how many matches they
// played that week. `excludeIds` skips anyone only just suspended this same
// week, so the ban actually costs them a match instead of expiring instantly.
export function tickSuspensions(squad, excludeIds = new Set()) {
  return squad.map((p) => {
    if (!p.suspended || excludeIds.has(p.id)) return p
    const suspensionMatches = Math.max(0, (p.suspensionMatches ?? 1) - 1)
    if (suspensionMatches === 0) return { ...p, suspended: false, suspensionMatches: 0 }
    return { ...p, suspensionMatches }
  })
}
