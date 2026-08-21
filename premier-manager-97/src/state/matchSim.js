import { ratePerformance } from './form.js'

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

const SCORER_WEIGHT = { FW: 5, MF: 2.5, DF: 0.6, GK: 0.05 }
const ASSIST_WEIGHT = { FW: 1.5, MF: 3, DF: 1, GK: 0.1 }

function pickWeighted(xi, weightTable, rng, exclude = null) {
  const candidates = xi.filter((p) => p.id !== exclude)
  if (candidates.length === 0) return null
  const weights = candidates.map((p) => (weightTable[p.position] ?? 1) * (0.5 + p.ability / 100))
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

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

  const homeXI = homeLineup.map((id) => homeSquad.find((p) => p.id === id)).filter(Boolean)
  const awayXI = awayLineup.map((id) => awaySquad.find((p) => p.id === id)).filter(Boolean)

  const events = []
  const goalMinutes = new Set()
  const goals = []

  function addGoals(count, side, xi, clubName) {
    for (let i = 0; i < count; i++) {
      let m
      do { m = 1 + Math.floor(rng() * 90) } while (goalMinutes.has(m))
      goalMinutes.add(m)
      const scorer = pickWeighted(xi, SCORER_WEIGHT, rng)
      const assister = rng() < 0.8 ? pickWeighted(xi, ASSIST_WEIGHT, rng, scorer?.id) : null
      goals.push({ minute: m, side, scorerId: scorer?.id, assistId: assister?.id })
      const assistText = assister ? ` (assist: ${assister.name})` : ''
      events.push({
        minute: m,
        text: scorer ? `GOAL! ${scorer.name} scores for ${clubName}!${assistText}` : `GOAL! ${clubName} score!`,
        isGoal: true,
        side,
      })
    }
  }

  addGoals(homeGoals, 'home', homeXI, homeClub.name)
  addGoals(awayGoals, 'away', awayXI, awayClub.name)

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

  const homeResultPoints = homeGoals > awayGoals ? 3 : homeGoals === awayGoals ? 1 : 0
  const awayResultPoints = awayGoals > homeGoals ? 3 : homeGoals === awayGoals ? 1 : 0
  const homeRatings = {}
  for (const id of homeLineup) homeRatings[id] = ratePerformance(homeResultPoints, rng)
  const awayRatings = {}
  for (const id of awayLineup) awayRatings[id] = ratePerformance(awayResultPoints, rng)

  for (const g of goals) {
    const ratings = g.side === 'home' ? homeRatings : awayRatings
    if (g.scorerId != null && ratings[g.scorerId] != null) ratings[g.scorerId] = Math.min(10, ratings[g.scorerId] + 0.8)
    if (g.assistId != null && ratings[g.assistId] != null) ratings[g.assistId] = Math.min(10, ratings[g.assistId] + 0.4)
  }

  let motmId = null
  let motmClubId = null
  let bestRating = -Infinity
  for (const [id, rating] of Object.entries(homeRatings)) {
    if (rating > bestRating) {
      bestRating = rating
      motmId = id
      motmClubId = homeClub.id
    }
  }
  for (const [id, rating] of Object.entries(awayRatings)) {
    if (rating > bestRating) {
      bestRating = rating
      motmId = id
      motmClubId = awayClub.id
    }
  }

  return { homeGoals, awayGoals, commentary, homeRatings, awayRatings, goals, motmId, motmClubId }
}
