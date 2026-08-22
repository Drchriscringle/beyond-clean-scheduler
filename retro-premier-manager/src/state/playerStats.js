export function applyMatchStats(squad, { lineupIds, goals, motmId }) {
  return squad.map((p) => {
    if (!lineupIds.includes(p.id)) return p
    const goalsScored = goals.filter((g) => g.scorerId === p.id).length
    const assistsMade = goals.filter((g) => g.assistId === p.id).length
    const isMotm = motmId === p.id
    return {
      ...p,
      stats: {
        appearances: p.stats.appearances + 1,
        goals: p.stats.goals + goalsScored,
        assists: p.stats.assists + assistsMade,
        motm: p.stats.motm + (isMotm ? 1 : 0),
      },
    }
  })
}

export function rollSeasonStatsIntoCareer(player) {
  return {
    ...player,
    careerStats: {
      appearances: player.careerStats.appearances + player.stats.appearances,
      goals: player.careerStats.goals + player.stats.goals,
      assists: player.careerStats.assists + player.stats.assists,
      motm: player.careerStats.motm + player.stats.motm,
    },
    stats: { appearances: 0, goals: 0, assists: 0, motm: 0 },
  }
}
