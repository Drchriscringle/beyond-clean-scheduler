function poissonRandom(lambda, rng) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= rng()
  } while (p > L)
  return k - 1
}

function lineupRatings(squad, lineupIds) {
  const xi = lineupIds.map((id) => squad.find((p) => p.id === id)).filter(Boolean)
  if (xi.length === 0) return { attack: 45, defense: 45, avgMorale: 60, avgFitness: 85 }
  let attackSum = 0
  let attackWeight = 0
  let defenseSum = 0
  let defenseWeight = 0
  let moraleSum = 0
  let fitnessSum = 0
  for (const p of xi) {
    const fitnessFactor = 0.7 + (p.fitness / 100) * 0.3
    const effectiveAbility = p.ability * fitnessFactor
    const attackWeightFor = p.position === 'FW' ? 3 : p.position === 'MF' ? 2 : p.position === 'GK' ? 0.3 : 0.6
    const defenseWeightFor = p.position === 'DF' ? 3 : p.position === 'GK' ? 2.4 : p.position === 'MF' ? 1.2 : 0.4
    attackSum += effectiveAbility * attackWeightFor
    attackWeight += attackWeightFor
    defenseSum += effectiveAbility * defenseWeightFor
    defenseWeight += defenseWeightFor
    moraleSum += p.morale
    fitnessSum += p.fitness
  }
  return {
    attack: attackSum / attackWeight,
    defense: defenseSum / defenseWeight,
    avgMorale: moraleSum / xi.length,
    avgFitness: fitnessSum / xi.length,
  }
}

const COMMENTARY_FILLER = [
  "'s appeal for a corner is waved away",
  ' side stitches together a neat move down the flank',
  ' win a free-kick in a dangerous area',
  ' pressing forces a hurried clearance',
  "'s goalkeeper claims a routine cross",
  ' work it wide but the final ball is poor',
  ' break up the play in midfield',
  ' shot from distance, well off target',
  ' shot from distance, saved!',
  ' half-chance goes begging',
  ' booking for a late challenge',
]

function pad(n) {
  return `${n}'`
}

export function simulateMatch({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup, rng = Math.random }) {
  const home = lineupRatings(homeSquad, homeLineup)
  const away = lineupRatings(awaySquad, awayLineup)

  const homeMoraleBoost = (home.avgMorale - 60) / 400
  const awayMoraleBoost = (away.avgMorale - 60) / 400

  const homeAdvantage = 0.28
  const baseGoals = 1.3

  const homeLambda = Math.max(
    0.15,
    baseGoals + (home.attack - away.defense) / 45 + homeAdvantage + homeMoraleBoost,
  )
  const awayLambda = Math.max(
    0.1,
    baseGoals + (away.attack - home.defense) / 45 - homeAdvantage * 0.4 + awayMoraleBoost,
  )

  const homeGoals = poissonRandom(homeLambda, rng)
  const awayGoals = poissonRandom(awayLambda, rng)

  const events = []
  const goalMinutes = new Set()
  for (let i = 0; i < homeGoals; i++) {
    let m
    do { m = 1 + Math.floor(rng() * 90) } while (goalMinutes.has(m))
    goalMinutes.add(m)
    events.push({ minute: m, text: `GOAL! ${homeClub.name} score!`, isGoal: true, side: 'home' })
  }
  for (let i = 0; i < awayGoals; i++) {
    let m
    do { m = 1 + Math.floor(rng() * 90) } while (goalMinutes.has(m))
    goalMinutes.add(m)
    events.push({ minute: m, text: `GOAL! ${awayClub.name} score!`, isGoal: true, side: 'away' })
  }

  const fillerCount = 6 + Math.floor(rng() * 5)
  for (let i = 0; i < fillerCount; i++) {
    const m = 1 + Math.floor(rng() * 90)
    const side = rng() < 0.5 ? homeClub.name : awayClub.name
    const filler = COMMENTARY_FILLER[Math.floor(rng() * COMMENTARY_FILLER.length)]
    events.push({ minute: m, text: `${side}${filler}`, isGoal: false })
  }

  events.sort((a, b) => a.minute - b.minute)
  const commentary = events.map((e) => `${pad(e.minute)} — ${e.text}`)
  commentary.push(`90' — Full-time: ${homeClub.name} ${homeGoals}-${awayGoals} ${awayClub.name}`)

  return { homeGoals, awayGoals, commentary }
}
