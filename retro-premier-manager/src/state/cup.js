// A simple single-elimination cup (32 clubs drawn from both the Premier
// League and the Championship, 5 rounds) played on five designated
// matchweeks alongside the league. Ties are resolved with a coin-flip
// weighted by squad ability if the scores are level - no replays, no extra
// time, to keep the schedule simple.

export const ROUND_NAMES = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']
export const CUP_ROUND_WEEKS = [4, 10, 16, 22, 30]
export const CUP_SIZE = 32

const PRIZE_MONEY = [150_000, 350_000, 700_000, 1_600_000, 3_200_000]
export const WINNER_BONUS = 5_500_000

// Scottish Cup: same engine, a smaller bracket to match a 22-club pyramid
// (12 Premiership + 10 Championship) and smaller, Scotland-scaled prize
// money - on its own set of weeks so it never clashes with the FA Cup,
// Europe or international fixtures.
export const SCOTTISH_CUP_ROUND_NAMES = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']
export const SCOTTISH_CUP_ROUND_WEEKS = [8, 15, 25, 33]
export const SCOTTISH_CUP_SIZE = 16
const SCOTTISH_PRIZE_MONEY = [15_000, 35_000, 90_000, 220_000]
export const SCOTTISH_WINNER_BONUS = 600_000

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

export function initCupState(allClubIds, season, cupSize = CUP_SIZE, rng = Math.random) {
  const entrants = shuffle(allClubIds, rng).slice(0, cupSize)
  return {
    season,
    roundIndex: 0,
    matches: pairUp(entrants),
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

export function isScottishCupWeek(week) {
  return SCOTTISH_CUP_ROUND_WEEKS.includes(week)
}

export function scottishRoundIndexForWeek(week) {
  return SCOTTISH_CUP_ROUND_WEEKS.indexOf(week)
}

export function scottishPrizeMoneyForRound(roundIndex) {
  return SCOTTISH_PRIZE_MONEY[roundIndex] ?? 0
}

// Advances the cup by one round using the supplied match-simulator.
// simulateFn(clubId, clubId) => { winner: clubId }. `roundNames` defaults to
// the FA Cup's own names/length - pass SCOTTISH_CUP_ROUND_NAMES for the
// smaller Scottish bracket.
export function playCupRound(cup, simulateFn, roundNames = ROUND_NAMES) {
  const results = cup.matches.map((m) => {
    const { winner, homeGoals, awayGoals } = simulateFn(m.home, m.away)
    return { ...m, played: true, homeGoals, awayGoals, winner }
  })

  const winners = results.map((r) => r.winner)
  const history = [...cup.history, { round: roundNames[cup.roundIndex], matches: results }]

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
