// Season objectives, set by the board at the start of each campaign and
// judged at the end of it. Missing one hurts confidence; missing enough of
// them in a row gets the manager sacked.

const OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win the Premier League', targetPosition: 1 },
    { type: 'top4', label: 'Finish in the Top 4', targetPosition: 4 },
  ],
  4: [
    { type: 'top6', label: 'Qualify for Europe (Top 6)', targetPosition: 6 },
    { type: 'top8', label: 'Finish in the Top 8', targetPosition: 8 },
  ],
  3: [
    { type: 'top-half', label: 'Finish in the Top Half', targetPosition: 10 },
    { type: 'top12', label: 'Finish 12th or Better', targetPosition: 12 },
  ],
  2: [
    { type: 'mid-table', label: 'A Secure Mid-Table Finish (14th or Better)', targetPosition: 14 },
  ],
  1: [
    { type: 'avoid-relegation', label: 'Avoid Relegation (17th or Better)', targetPosition: 17 },
  ],
}

export function generateObjective(reputation, rng = Math.random) {
  const list = OBJECTIVE_POOL[reputation] ?? OBJECTIVE_POOL[3]
  return list[Math.floor(rng() * list.length)]
}

// Returns { met, confidenceDelta, message, sacked }
export function evaluateObjective(objective, finalPosition) {
  const met = finalPosition <= objective.targetPosition
  const shortfall = finalPosition - objective.targetPosition

  if (met) {
    return {
      met: true,
      confidenceDelta: 16,
      message: `Season objective achieved: "${objective.label}" (finished ${finalPosition}${ordinalSuffix(finalPosition)}). The board are pleased.`,
    }
  }
  if (shortfall <= 3) {
    return {
      met: false,
      confidenceDelta: -12,
      message: `Season objective missed: "${objective.label}" (finished ${finalPosition}${ordinalSuffix(finalPosition)}). The board are disappointed, but understanding.`,
    }
  }
  return {
    met: false,
    confidenceDelta: -25,
    message: `Season objective badly missed: "${objective.label}" (finished ${finalPosition}${ordinalSuffix(finalPosition)}). The board's patience is wearing very thin.`,
  }
}

function ordinalSuffix(n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}
