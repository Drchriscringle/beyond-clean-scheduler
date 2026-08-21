// A simple single-elimination cup (16 clubs, 4 rounds) played on four
// designated matchweeks alongside the league. Ties are resolved with a
// coin-flip weighted by squad ability if the scores are level - no replays,
// no extra time, to keep the schedule simple.

export const ROUND_NAMES = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']
export const CUP_ROUND_WEEKS = [6, 14, 22, 30]

const PRIZE_MONEY = [250_000, 600_000, 1_400_000, 3_000_000]
export const WINNER_BONUS = 5_000_000

function shuffle(arr, rng) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pairUp(clubIds) {
  const matches = []
  for (let i = 0; i < clubIds.length; i += 2) {
    matches.push({ home: clubIds[i], away: clubIds[i + 1], played: false })
  }
  return matches
}

export function initCupState(allClubIds, season, rng = Math.random) {
  const sixteen = shuffle(allClubIds, rng).slice(0, 16)
  return {
    season,
    roundIndex: 0,
    matches: pairUp(sixteen),
    history: [],
    champion: null,
  }
}

export function isCupWeek(week) {
  return CUP_ROUND_WEEKS.includes(week)
}

export function roundIndexForWeek(week) {
  return CUP_ROUND_WEEKS.indexOf(week)
}

export function prizeMoneyForRound(roundIndex) {
  return PRIZE_MONEY[roundIndex] ?? 0
}

// Advances the cup by one round using the supplied match-simulator.
// simulateFn(clubId, clubId) => { winner: clubId }
export function playCupRound(cup, simulateFn) {
  const results = cup.matches.map((m) => {
    const { winner, homeGoals, awayGoals } = simulateFn(m.home, m.away)
    return { ...m, played: true, homeGoals, awayGoals, winner }
  })

  const winners = results.map((r) => r.winner)
  const history = [...cup.history, { round: ROUND_NAMES[cup.roundIndex], matches: results }]

  if (winners.length === 1) {
    return { ...cup, matches: results, history, champion: winners[0] }
  }

  return {
    ...cup,
    roundIndex: cup.roundIndex + 1,
    matches: pairUp(winners),
    history,
  }
}

export function clubCupStatus(cup, clubId) {
  if (!cup) return null
  if (cup.champion === clubId) return { alive: true, won: true, roundLabel: 'Champions' }

  const stillIn = cup.matches.some((m) => m.home === clubId || m.away === clubId)
  if (stillIn) {
    return { alive: true, won: false, roundLabel: ROUND_NAMES[cup.roundIndex] }
  }

  for (let i = cup.history.length - 1; i >= 0; i--) {
    const round = cup.history[i]
    const match = round.matches.find((m) => m.home === clubId || m.away === clubId)
    if (match) {
      const eliminated = match.winner !== clubId
      return { alive: !eliminated, won: false, roundLabel: round.round, eliminated }
    }
  }
  return { alive: false, won: false, roundLabel: 'Did not enter' }
}
