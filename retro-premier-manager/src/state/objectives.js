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

// Championship clubs are judged on promotion, not on European qualification.
const CHAMPIONSHIP_OBJECTIVE_POOL = {
  3: [
    { type: 'win-championship', label: 'Win the Championship (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-ch', label: 'Finish in the Top Half', targetPosition: 10 },
  ],
  1: [
    { type: 'avoid-relegation-ch', label: 'Avoid Relegation to League One (17th or Better)', targetPosition: 17 },
  ],
}

// Scottish Premiership is a 12-club league; targets are scaled down from the
// English pools rather than reusing English-sized positions like 14th/17th,
// which don't exist in a 12-team table.
const SCOTTISH_PREMIERSHIP_OBJECTIVE_POOL = {
  3: [
    { type: 'win-spl', label: 'Win the Scottish Premiership', targetPosition: 1 },
    { type: 'top3-spl', label: 'Finish in the Top 3', targetPosition: 3 },
  ],
  2: [
    { type: 'top4-spl', label: 'Finish in the Top 4', targetPosition: 4 },
    { type: 'top6-spl', label: 'Finish in the Top 6', targetPosition: 6 },
  ],
  1: [
    { type: 'avoid-relegation-spl', label: 'Avoid Relegation (10th or Better)', targetPosition: 10 },
  ],
}

// Scottish Championship is a 10-club league.
const SCOTTISH_CHAMPIONSHIP_OBJECTIVE_POOL = {
  2: [
    { type: 'win-sch', label: 'Win the Scottish Championship (Automatic Promotion)', targetPosition: 1 },
    { type: 'promotion-sch', label: 'Achieve Promotion (Top 2)', targetPosition: 2 },
  ],
  1: [
    { type: 'playoffs-sch', label: 'Reach the Promotion Play-offs (Top 5)', targetPosition: 5 },
  ],
}

// La Liga is another 20-club top flight, so it reuses the English pool's
// target positions (1/4/6/8/10/12/14/17) exactly - only the label text
// changes to match the competition.
const LALIGA_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win La Liga', targetPosition: 1 },
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

export function generateObjective(reputation, rng = Math.random, division = 'PL') {
  const pool =
    division === 'CH'
      ? CHAMPIONSHIP_OBJECTIVE_POOL
      : division === 'SPL'
        ? SCOTTISH_PREMIERSHIP_OBJECTIVE_POOL
        : division === 'SCH'
          ? SCOTTISH_CHAMPIONSHIP_OBJECTIVE_POOL
          : division === 'LALIGA'
            ? LALIGA_OBJECTIVE_POOL
            : OBJECTIVE_POOL
  const list = pool[reputation] ?? pool[3] ?? pool[1]
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
