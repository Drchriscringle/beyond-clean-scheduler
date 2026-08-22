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
    // home/away club ids are globally unique across every division, so
    // this id stays unique even once combineFixturesByWeek merges several
    // divisions' matches into one week - a plain week-index id would
    // collide between divisions the moment two of them both had a "first
    // match of the week".
    matches: matches.map((m) => ({ id: `${index + 1}-${m.home}-${m.away}`, ...m, played: false })),
  }))
}

// Merges any number of divisions' independent fixture lists into one shared
// weekly calendar (every division plays matchweek N on the same week N).
export function combineFixturesByWeek(...fixtureLists) {
  const weeks = Math.max(0, ...fixtureLists.map((f) => f.length))
  const combined = []
  for (let i = 0; i < weeks; i++) {
    combined.push({ week: i + 1, matches: fixtureLists.flatMap((f) => f[i]?.matches ?? []) })
  }
  return combined
}

// A smaller league's double round-robin (2*(n-1) weeks) is repeated,
// wrapping around, until it fills exactly `targetWeeks` weeks - so every
// division's season runs the same number of weeks regardless of how many
// clubs it has (needed once more than one league size exists side by
// side). For a division whose natural double round-robin already equals
// targetWeeks (e.g. a 20-club league over 38 weeks), this is a no-op:
// it produces exactly the same fixtures as generateFixtures itself.
export function generateSeasonFixtures(clubIds, targetWeeks = 38) {
  const cycle = generateFixtures(clubIds)
  const weeks = []
  for (let week = 1; week <= targetWeeks; week++) {
    const source = cycle[(week - 1) % cycle.length]
    weeks.push({ week, matches: source.matches.map((m) => ({ ...m, id: `${week}-${m.home}-${m.away}` })) })
  }
  return weeks
}
