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

// Segunda División clubs are judged on promotion, not on European
// qualification - same shape as the English Championship pool.
const SEGUNDA_OBJECTIVE_POOL = {
  3: [
    { type: 'win-segunda', label: 'Win the Segunda Division (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-segunda', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-segunda', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-segunda', label: 'Finish in the Top Half', targetPosition: 10 },
  ],
  1: [
    { type: 'avoid-relegation-segunda', label: 'Avoid Relegation (17th or Better)', targetPosition: 17 },
  ],
}

// Serie A is another 20-club top flight, so it reuses the same target
// positions as La Liga - only the label text changes.
const SERIEA_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win Serie A', targetPosition: 1 },
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

// Serie B clubs are judged on promotion, not on European qualification -
// same shape as the Segunda División pool.
const SERIEB_OBJECTIVE_POOL = {
  3: [
    { type: 'win-serieb', label: 'Win Serie B (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-serieb', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-serieb', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-serieb', label: 'Finish in the Top Half', targetPosition: 10 },
  ],
  1: [
    { type: 'avoid-relegation-serieb', label: 'Avoid Relegation (17th or Better)', targetPosition: 17 },
  ],
}

// The Bundesliga is an 18-club top flight, so its target positions are
// scaled down a little from the 20-club leagues above.
const BUNDESLIGA_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win the Bundesliga', targetPosition: 1 },
    { type: 'top4', label: 'Finish in the Top 4', targetPosition: 4 },
  ],
  4: [
    { type: 'top6', label: 'Qualify for Europe (Top 6)', targetPosition: 6 },
    { type: 'top8', label: 'Finish in the Top 8', targetPosition: 8 },
  ],
  3: [
    { type: 'top-half', label: 'Finish in the Top Half', targetPosition: 9 },
    { type: 'top11', label: 'Finish 11th or Better', targetPosition: 11 },
  ],
  2: [
    { type: 'mid-table', label: 'A Secure Mid-Table Finish (12th or Better)', targetPosition: 12 },
  ],
  1: [
    { type: 'avoid-relegation', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// 2. Bundesliga clubs are judged on promotion, not on European
// qualification - same shape as the Segunda División/Serie B pools, scaled
// down to an 18-club division.
const BUNDESLIGA2_OBJECTIVE_POOL = {
  3: [
    { type: 'win-bundesliga2', label: 'Win 2. Bundesliga (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-bundesliga2', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-bundesliga2', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-bundesliga2', label: 'Finish in the Top Half', targetPosition: 9 },
  ],
  1: [
    { type: 'avoid-relegation-bundesliga2', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// Ligue 1 is an 18-club top flight, same shape as the Bundesliga pool.
const LIGUE1_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win Ligue 1', targetPosition: 1 },
    { type: 'top4', label: 'Finish in the Top 4', targetPosition: 4 },
  ],
  4: [
    { type: 'top6', label: 'Qualify for Europe (Top 6)', targetPosition: 6 },
    { type: 'top8', label: 'Finish in the Top 8', targetPosition: 8 },
  ],
  3: [
    { type: 'top-half', label: 'Finish in the Top Half', targetPosition: 9 },
    { type: 'top11', label: 'Finish 11th or Better', targetPosition: 11 },
  ],
  2: [
    { type: 'mid-table', label: 'A Secure Mid-Table Finish (12th or Better)', targetPosition: 12 },
  ],
  1: [
    { type: 'avoid-relegation', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// Ligue 2 clubs are judged on promotion, not on European qualification -
// same shape as the 2. Bundesliga pool.
const LIGUE2_OBJECTIVE_POOL = {
  3: [
    { type: 'win-ligue2', label: 'Win Ligue 2 (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-ligue2', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-ligue2', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-ligue2', label: 'Finish in the Top Half', targetPosition: 9 },
  ],
  1: [
    { type: 'avoid-relegation-ligue2', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// The Eredivisie is an 18-club top flight, same shape as the Bundesliga pool.
const EREDIVISIE_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win the Eredivisie', targetPosition: 1 },
    { type: 'top4', label: 'Finish in the Top 4', targetPosition: 4 },
  ],
  4: [
    { type: 'top6', label: 'Qualify for Europe (Top 6)', targetPosition: 6 },
    { type: 'top8', label: 'Finish in the Top 8', targetPosition: 8 },
  ],
  3: [
    { type: 'top-half', label: 'Finish in the Top Half', targetPosition: 9 },
    { type: 'top11', label: 'Finish 11th or Better', targetPosition: 11 },
  ],
  2: [
    { type: 'mid-table', label: 'A Secure Mid-Table Finish (12th or Better)', targetPosition: 12 },
  ],
  1: [
    { type: 'avoid-relegation', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// Eerste Divisie clubs are judged on promotion, not on European
// qualification - a 20-club division, same shape as the Segunda
// División/Serie B pools.
const EERSTEDIVISIE_OBJECTIVE_POOL = {
  3: [
    { type: 'win-eerstedivisie', label: 'Win the Eerste Divisie (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-eerstedivisie', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-eerstedivisie', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-eerstedivisie', label: 'Finish in the Top Half', targetPosition: 10 },
  ],
  1: [
    { type: 'avoid-relegation-eerstedivisie', label: 'Avoid Relegation (17th or Better)', targetPosition: 17 },
  ],
}

// The Primeira Liga is an 18-club top flight, same shape as the Bundesliga
// pool.
const PRIMEIRALIGA_OBJECTIVE_POOL = {
  5: [
    { type: 'win-league', label: 'Win the Primeira Liga', targetPosition: 1 },
    { type: 'top4', label: 'Finish in the Top 4', targetPosition: 4 },
  ],
  4: [
    { type: 'top6', label: 'Qualify for Europe (Top 6)', targetPosition: 6 },
    { type: 'top8', label: 'Finish in the Top 8', targetPosition: 8 },
  ],
  3: [
    { type: 'top-half', label: 'Finish in the Top Half', targetPosition: 9 },
    { type: 'top11', label: 'Finish 11th or Better', targetPosition: 11 },
  ],
  2: [
    { type: 'mid-table', label: 'A Secure Mid-Table Finish (12th or Better)', targetPosition: 12 },
  ],
  1: [
    { type: 'avoid-relegation', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
  ],
}

// Liga Portugal 2 clubs are judged on promotion, not on European
// qualification - same shape as the 2. Bundesliga/Ligue 2 pools.
const LIGAPORTUGAL2_OBJECTIVE_POOL = {
  3: [
    { type: 'win-ligaportugal2', label: 'Win Liga Portugal 2 (Automatic Promotion)', targetPosition: 1 },
    { type: 'auto-promotion-ligaportugal2', label: 'Achieve Automatic Promotion (Top 2)', targetPosition: 2 },
  ],
  2: [
    { type: 'playoffs-ligaportugal2', label: 'Reach the Promotion Play-offs (Top 6)', targetPosition: 6 },
    { type: 'top-half-ligaportugal2', label: 'Finish in the Top Half', targetPosition: 9 },
  ],
  1: [
    { type: 'avoid-relegation-ligaportugal2', label: 'Avoid Relegation (15th or Better)', targetPosition: 15 },
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
            : division === 'SEGUNDA'
              ? SEGUNDA_OBJECTIVE_POOL
              : division === 'SERIEA'
                ? SERIEA_OBJECTIVE_POOL
                : division === 'SERIEB'
                  ? SERIEB_OBJECTIVE_POOL
                  : division === 'BUNDESLIGA'
                    ? BUNDESLIGA_OBJECTIVE_POOL
                    : division === 'BUNDESLIGA2'
                      ? BUNDESLIGA2_OBJECTIVE_POOL
                      : division === 'LIGUE1'
                        ? LIGUE1_OBJECTIVE_POOL
                        : division === 'LIGUE2'
                          ? LIGUE2_OBJECTIVE_POOL
                          : division === 'EREDIVISIE'
                            ? EREDIVISIE_OBJECTIVE_POOL
                            : division === 'EERSTEDIVISIE'
                              ? EERSTEDIVISIE_OBJECTIVE_POOL
                              : division === 'PRIMEIRALIGA'
                                ? PRIMEIRALIGA_OBJECTIVE_POOL
                                : division === 'LIGAPORTUGAL2'
                                  ? LIGAPORTUGAL2_OBJECTIVE_POOL
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
