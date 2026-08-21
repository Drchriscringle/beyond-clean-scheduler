// Standard round-robin ("circle method") double fixture list: 20 clubs,
// 38 matchweeks, each pair meeting home and away once.
export function generateFixtures(clubIds) {
  const teams = [...clubIds]
  if (teams.length % 2 !== 0) teams.push(null) // bye slot, not needed for 20 clubs
  const n = teams.length
  const rounds = []

  const fixed = teams[0]
  let rest = teams.slice(1)

  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rest]
    const matches = []
    for (let i = 0; i < n / 2; i++) {
      const home = roundTeams[i]
      const away = roundTeams[n - 1 - i]
      if (home != null && away != null) {
        // alternate home/away by round to spread fixtures more evenly
        if (r % 2 === 0) matches.push({ home, away })
        else matches.push({ home: away, away: home })
      }
    }
    rounds.push(matches)
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)]
  }

  const secondHalf = rounds.map((round) =>
    round.map((m) => ({ home: m.away, away: m.home })),
  )

  const allRounds = [...rounds, ...secondHalf]
  return allRounds.map((matches, index) => ({
    week: index + 1,
    matches: matches.map((m, i) => ({ id: `${index + 1}-${i}`, ...m, played: false })),
  }))
}
