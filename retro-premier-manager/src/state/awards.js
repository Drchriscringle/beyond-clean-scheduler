const TEAM_TEMPLATE = { GK: 1, DF: 4, MF: 4, FW: 2 }
const MIN_APPEARANCES_FOR_TEAM = 10

function seasonScore(p) {
  return p.ability + p.stats.goals * 2 + p.stats.assists * 1.5 + p.stats.motm * 4
}

function playerRef(p, clubId) {
  return { playerId: p.id, name: p.name, clubId, position: p.position }
}

// Computed once at end of season, before stats roll into career totals and
// reset - see seasonRollover in gameReducer.js. Only one division's worth of
// clubs/squads is considered per call.
export function computeSeasonAwards(squads, clubs, division) {
  const clubIds = Object.values(clubs)
    .filter((c) => c.division === division)
    .map((c) => c.id)

  const players = []
  for (const clubId of clubIds) {
    for (const p of squads[clubId] ?? []) {
      if (p.stats.appearances > 0) players.push({ ...p, clubId })
    }
  }

  if (players.length === 0) {
    return { goldenBoot: null, playerOfSeason: null, teamOfSeason: [] }
  }

  const topScorer = [...players].sort(
    (a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists,
  )[0]
  const goldenBoot =
    topScorer.stats.goals > 0
      ? { ...playerRef(topScorer, topScorer.clubId), goals: topScorer.stats.goals, assists: topScorer.stats.assists }
      : null

  const bestAllRound = [...players].sort((a, b) => {
    const scoreA = a.stats.motm * 3 + a.stats.goals + a.stats.assists * 0.8
    const scoreB = b.stats.motm * 3 + b.stats.goals + b.stats.assists * 0.8
    return scoreB - scoreA
  })[0]
  const playerOfSeason = { ...playerRef(bestAllRound, bestAllRound.clubId), motm: bestAllRound.stats.motm, goals: bestAllRound.stats.goals, assists: bestAllRound.stats.assists }

  const teamOfSeason = []
  for (const pos of ['GK', 'DF', 'MF', 'FW']) {
    const picked = players
      .filter((p) => p.position === pos && p.stats.appearances >= MIN_APPEARANCES_FOR_TEAM)
      .sort((a, b) => seasonScore(b) - seasonScore(a))
      .slice(0, TEAM_TEMPLATE[pos])
    teamOfSeason.push(...picked.map((p) => ({ ...playerRef(p, p.clubId), ability: p.ability })))
  }

  return { goldenBoot, playerOfSeason, teamOfSeason }
}
