import { ratePerformance } from './form.js'
import { PLAYING_STYLES, formationShapeMultiplier } from './tactics.js'
import { cardChanceMultiplier } from './personality.js'
import { WEATHER_TYPES } from '../data/weather.js'
import { isDerbyMatch, derbyLabel } from '../data/rivalries.js'

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
// Card/penalty/set-piece rates below are all "per 90 minutes" (or "per goal",
// for the set-piece ones) - simulateMatchSegment scales the per-90 ones down
// to whatever share of the match the segment covers.
const YELLOW_CARD_CHANCE = 0.11
const RED_CARD_CHANCE = 0.006
const PENALTY_CHANCE = 0.1
const FREE_KICK_CHANCE = 0.06
const CORNER_CHANCE = 0.16
const CAPTAIN_BOOST = 1.02
const DERBY_CARD_MULT = 1.4
const DERBY_VARIANCE_BOOST = 0.06

export function pitchWeatherPenalty(pitchLevel = 1) {
  return 1 + (4 - pitchLevel) * 0.06
}

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

function minuteInRange(startMinute, endMinute, rng) {
  return startMinute + Math.floor(rng() * (endMinute - startMinute + 1))
}

function generateBookings(xi, side, rng, chanceMultiplier, startMinute, endMinute) {
  const bookings = []
  for (const p of xi) {
    const personalityMult = cardChanceMultiplier(p.personality)
    const roll = rng()
    if (roll < RED_CARD_CHANCE * chanceMultiplier * personalityMult) {
      bookings.push({ playerId: p.id, side, type: 'red', minute: minuteInRange(startMinute, endMinute, rng), name: p.name })
    } else if (roll < (RED_CARD_CHANCE + YELLOW_CARD_CHANCE) * chanceMultiplier * personalityMult) {
      bookings.push({ playerId: p.id, side, type: 'yellow', minute: minuteInRange(startMinute, endMinute, rng), name: p.name })
    }
  }
  return bookings
}

// Simulates only the [startMinute, endMinute] slice of a match. Goal
// expectancy (and card chance) is scaled down to that slice's share of the
// full 90 minutes, so calling this repeatedly over consecutive slices with
// the same lineups/tactics composes into the same distribution as simulating
// the whole match in one call - which is what lets the live matchday screen
// tick through a match a few minutes at a time (and use updated lineups/
// tactics after a substitution or a tactical change) while AI-only fixtures
// still resolve in a single call via simulateMatch below.
export function simulateMatchSegment({
  homeClub,
  awayClub,
  homeSquad,
  awaySquad,
  homeLineup,
  awayLineup,
  homeTactics,
  awayTactics,
  homeFormation = null,
  awayFormation = null,
  weather = 'clear',
  homePitchLevel = 1,
  startMinute = 1,
  endMinute = 90,
  rng = Math.random,
}) {
  const fraction = (endMinute - startMinute + 1) / 90

  const home = lineupRatings(homeSquad, homeLineup)
  const away = lineupRatings(awaySquad, awayLineup)

  const homeMoraleBoost = (home.avgMorale - 60) / 400
  const awayMoraleBoost = (away.avgMorale - 60) / 400

  const homeAdvantage = 0.28
  const baseGoals = 1.3

  const homeStyle = PLAYING_STYLES[homeTactics?.playingStyle] ?? PLAYING_STYLES.balanced
  const awayStyle = PLAYING_STYLES[awayTactics?.playingStyle] ?? PLAYING_STYLES.balanced
  const homeHasCaptain = Boolean(homeTactics?.captainId && homeLineup.includes(homeTactics.captainId))
  const awayHasCaptain = Boolean(awayTactics?.captainId && awayLineup.includes(awayTactics.captainId))

  let homeLambda = Math.max(
    0.15,
    baseGoals + (home.attack - away.defense) / 45 + homeAdvantage + homeMoraleBoost,
  )
  let awayLambda = Math.max(
    0.1,
    baseGoals + (away.attack - home.defense) / 45 - homeAdvantage * 0.4 + awayMoraleBoost,
  )

  homeLambda *= homeStyle.forMult * awayStyle.againstMult
  awayLambda *= awayStyle.forMult * homeStyle.againstMult
  if (homeHasCaptain) homeLambda *= CAPTAIN_BOOST
  if (awayHasCaptain) awayLambda *= CAPTAIN_BOOST

  if (homeFormation && awayFormation) {
    homeLambda *= formationShapeMultiplier(homeFormation, awayFormation)
    awayLambda *= formationShapeMultiplier(awayFormation, homeFormation)
  }

  const weatherEffect = WEATHER_TYPES[weather] ?? WEATHER_TYPES.clear
  homeLambda *= weatherEffect.goalMult
  awayLambda *= weatherEffect.goalMult

  // A poor home pitch makes bad weather's levelling effect worse - pitch
  // investment pays off beyond just the injury-rate discount it already
  // gives (see facilities.js).
  const pitchPenalty = pitchWeatherPenalty(homePitchLevel)
  const isDerby = isDerbyMatch(homeClub.id, awayClub.id)
  let varianceBoost = weatherEffect.varianceBoost * pitchPenalty
  if (isDerby) varianceBoost += DERBY_VARIANCE_BOOST
  if (varianceBoost > 0) {
    const avgLambda = (homeLambda + awayLambda) / 2
    homeLambda = homeLambda * (1 - varianceBoost) + avgLambda * varianceBoost
    awayLambda = awayLambda * (1 - varianceBoost) + avgLambda * varianceBoost
  }

  homeLambda *= fraction
  awayLambda *= fraction

  const homeGoals = poissonRandom(homeLambda, rng)
  const awayGoals = poissonRandom(awayLambda, rng)

  const homeXI = homeLineup.map((id) => homeSquad.find((p) => p.id === id)).filter(Boolean)
  const awayXI = awayLineup.map((id) => awaySquad.find((p) => p.id === id)).filter(Boolean)

  const events = []
  const goalMinutes = new Set()
  const goals = []

  function addGoals(count, side, xi, clubName, tactics) {
    for (let i = 0; i < count; i++) {
      let m = minuteInRange(startMinute, endMinute, rng)
      let attempts = 0
      while (goalMinutes.has(m) && attempts < 10) {
        m = minuteInRange(startMinute, endMinute, rng)
        attempts += 1
      }
      goalMinutes.add(m)

      let scorer
      let assister = null
      let note = ''

      if (rng() < PENALTY_CHANCE) {
        const designated = tactics?.penaltyTakerId ? xi.find((p) => p.id === tactics.penaltyTakerId) : null
        scorer = designated ?? pickWeighted(xi, SCORER_WEIGHT, rng)
        note = ' (penalty)'
      } else if (rng() < FREE_KICK_CHANCE) {
        const designated = tactics?.freeKickTakerId ? xi.find((p) => p.id === tactics.freeKickTakerId) : null
        scorer = designated ?? pickWeighted(xi, SCORER_WEIGHT, rng)
        note = ' direct from the free-kick'
      } else {
        scorer = pickWeighted(xi, SCORER_WEIGHT, rng)
        const cornerGoal = rng() < CORNER_CHANCE
        if (cornerGoal && tactics?.cornerTakerId) {
          assister = xi.find((p) => p.id === tactics.cornerTakerId && p.id !== scorer?.id) ?? null
        }
        if (!assister) {
          assister = rng() < 0.8 ? pickWeighted(xi, ASSIST_WEIGHT, rng, scorer?.id) : null
        } else {
          note = ' (from a corner)'
        }
      }

      goals.push({ minute: m, side, scorerId: scorer?.id, assistId: assister?.id })
      const assistText = assister ? ` (assist: ${assister.name})` : ''
      events.push({
        minute: m,
        text: scorer ? `GOAL! ${scorer.name} scores for ${clubName}!${assistText}${note}` : `GOAL! ${clubName} score!`,
        isGoal: true,
        side,
      })
    }
  }

  addGoals(homeGoals, 'home', homeXI, homeClub.name, homeTactics)
  addGoals(awayGoals, 'away', awayXI, awayClub.name, awayTactics)

  const cardChanceMult = fraction * (isDerby ? DERBY_CARD_MULT : 1)
  const bookings = [
    ...generateBookings(homeXI, 'home', rng, cardChanceMult, startMinute, endMinute),
    ...generateBookings(awayXI, 'away', rng, cardChanceMult, startMinute, endMinute),
  ]
  for (const b of bookings) {
    const clubName = b.side === 'home' ? homeClub.name : awayClub.name
    events.push({
      minute: b.minute,
      text: b.type === 'red' ? `RED CARD! ${b.name} (${clubName}) is sent off!` : `Booking: ${b.name} (${clubName})`,
      isGoal: false,
    })
  }

  const fillerCount = Math.round((6 + Math.floor(rng() * 5)) * fraction)
  for (let i = 0; i < fillerCount; i++) {
    const m = minuteInRange(startMinute, endMinute, rng)
    const side = rng() < 0.5 ? homeClub.name : awayClub.name
    const filler = COMMENTARY_FILLER[Math.floor(rng() * COMMENTARY_FILLER.length)]
    events.push({ minute: m, text: `${side}${filler}`, isGoal: false })
  }

  if (startMinute === 1) {
    if (weather !== 'clear') events.unshift({ minute: 1, text: `Conditions: ${weatherEffect.label} at kick-off.`, isGoal: false })
    if (isDerby) {
      const label = derbyLabel(homeClub.id, awayClub.id)
      events.unshift({ minute: 1, text: `${label ? `${label}! ` : ''}A fierce local rivalry — form counts for little today.`, isGoal: false })
    }
  }

  events.sort((a, b) => a.minute - b.minute)
  const commentary = events.map((e) => `${pad(e.minute)} — ${e.text}`)

  return { homeGoals, awayGoals, commentary, goals, bookings, weather, isDerby }
}

// Performance ratings and Man of the Match, computed once the full-time
// score and every goal (across however many segments were simulated) are
// known. homeLineup/awayLineup here should be everyone who featured at some
// point (starters plus any substitutes brought on), not just who kicked off.
export function finalizeRatings({ homeLineup, awayLineup, homeGoals, awayGoals, goals, homeClubId, awayClubId, rng = Math.random }) {
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
      motmClubId = homeClubId
    }
  }
  for (const [id, rating] of Object.entries(awayRatings)) {
    if (rating > bestRating) {
      bestRating = rating
      motmId = id
      motmClubId = awayClubId
    }
  }

  return { homeRatings, awayRatings, motmId, motmClubId }
}

export function simulateMatch({
  homeClub,
  awayClub,
  homeSquad,
  awaySquad,
  homeLineup,
  awayLineup,
  homeTactics,
  awayTactics,
  homeFormation,
  awayFormation,
  weather,
  homePitchLevel,
  rng = Math.random,
}) {
  const segment = simulateMatchSegment({
    homeClub,
    awayClub,
    homeSquad,
    awaySquad,
    homeLineup,
    awayLineup,
    homeTactics,
    awayTactics,
    homeFormation,
    awayFormation,
    weather,
    homePitchLevel,
    startMinute: 1,
    endMinute: 90,
    rng,
  })
  const commentary = [...segment.commentary, `90' — Full-time: ${homeClub.name} ${segment.homeGoals}-${segment.awayGoals} ${awayClub.name}`]
  const ratings = finalizeRatings({
    homeLineup,
    awayLineup,
    homeGoals: segment.homeGoals,
    awayGoals: segment.awayGoals,
    goals: segment.goals,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    rng,
  })

  return {
    homeGoals: segment.homeGoals,
    awayGoals: segment.awayGoals,
    commentary,
    goals: segment.goals,
    bookings: segment.bookings,
    weather: segment.weather,
    isDerby: segment.isDerby,
    ...ratings,
  }
}
