// A player's exact ability/potential/attributes are hidden from the manager
// until they've been scouted - or until they've actually played and shown
// what they can do, which counts as scouting them for free. Your own
// inherited first-team squad starts fully scouted (see startNewGame); fresh
// youth intake, free agents and every other club's players do not.
export const SCOUT_COST = 25_000

export function isRevealed(player) {
  return Boolean(player.scouted || player.stats?.appearances > 0 || player.careerStats?.appearances > 0)
}

export function abilityStars(ability) {
  if (ability >= 80) return 5
  if (ability >= 70) return 4
  if (ability >= 60) return 3
  if (ability >= 50) return 2
  return 1
}
