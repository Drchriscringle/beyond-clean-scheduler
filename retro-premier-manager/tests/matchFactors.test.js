import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLUBS } from '../src/data/clubs.js'
import { generateSquadForClub } from '../src/data/generateSquad.js'
import { pickBestXI } from '../src/state/lineup.js'
import { simulateMatch, pitchWeatherPenalty } from '../src/state/matchSim.js'
import { formationShapeMultiplier } from '../src/state/tactics.js'
import { WEATHER_TYPES, rollWeather } from '../src/data/weather.js'
import { isDerbyMatch, derbyLabel } from '../src/data/rivalries.js'

test('formationShapeMultiplier rewards extra midfield numbers against the same opponent shape, and is a no-op for an unknown formation', () => {
  const withMoreMid = formationShapeMultiplier('3-4-3', '4-4-2')
  const withFewerMid = formationShapeMultiplier('4-3-3', '4-4-2')
  assert.ok(withMoreMid > withFewerMid, `expected 3-4-3's extra midfielder to out-multiply 4-3-3: ${withMoreMid} vs ${withFewerMid}`)
  assert.equal(formationShapeMultiplier('not-a-formation', '4-4-2'), 1)
  assert.equal(formationShapeMultiplier('4-4-2', 'not-a-formation'), 1)
})

test('rollWeather always returns a known weather type, including at the extremes of a forced rng', () => {
  assert.equal(rollWeather(() => 0), 'clear')
  assert.equal(rollWeather(() => 0.999999), 'snow')
  for (let i = 0; i < 50; i++) assert.ok(WEATHER_TYPES[rollWeather()])
})

test('pitchWeatherPenalty gets strictly worse as the home pitch facility level drops', () => {
  assert.equal(pitchWeatherPenalty(4), 1)
  assert.ok(pitchWeatherPenalty(1) > pitchWeatherPenalty(2))
  assert.ok(pitchWeatherPenalty(2) > pitchWeatherPenalty(3))
  assert.ok(pitchWeatherPenalty(3) > pitchWeatherPenalty(4))
})

test('isDerbyMatch/derbyLabel recognise known rivalries in either order and reject unlisted pairings', () => {
  assert.ok(isDerbyMatch('celtic', 'rangers'))
  assert.ok(isDerbyMatch('rangers', 'celtic'))
  assert.equal(derbyLabel('celtic', 'rangers'), 'The Old Rivalry')
  assert.equal(derbyLabel('rangers', 'celtic'), 'The Old Rivalry')
  assert.equal(isDerbyMatch('celtic', 'aberdeen'), false)
  assert.equal(derbyLabel('celtic', 'aberdeen'), null)
})

const homeClub = CLUBS.find((c) => c.id === 'arsenal')
const awayClub = CLUBS.find((c) => c.id === 'man-city')
const homeSquad = generateSquadForClub(homeClub)
const awaySquad = generateSquadForClub(awayClub)
const homeLineup = pickBestXI(homeSquad, '4-4-2')
const awayLineup = pickBestXI(awaySquad, '4-4-2')

test('a derby fixture produces more bookings on average than the identical fixture without a rivalry between the two ids', () => {
  // Same clubs/squads/lineups throughout - only the away side's id changes,
  // so isDerbyMatch is the one thing being toggled between the two runs.
  const nonDerbyAway = awayClub // 'man-city' - arsenal has no listed rivalry with them
  const derbyAway = { ...awayClub, id: 'tottenham' } // North London Derby

  function avgBookings(away, n) {
    let total = 0
    for (let i = 0; i < n; i++) {
      const r = simulateMatch({ homeClub, awayClub: away, homeSquad, awaySquad, homeLineup, awayLineup })
      total += r.bookings.length
    }
    return total / n
  }

  const N = 500
  const nonDerbyAvg = avgBookings(nonDerbyAway, N)
  const derbyAvg = avgBookings(derbyAway, N)
  assert.ok(derbyAvg > nonDerbyAvg, `expected more bookings in a derby: derby=${derbyAvg}, non-derby=${nonDerbyAvg}`)
})

test('bad weather (snow) dents average scoring compared to clear conditions', () => {
  const N = 400
  function avgGoals(weather) {
    let total = 0
    for (let i = 0; i < N; i++) {
      const r = simulateMatch({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup, weather })
      total += r.homeGoals + r.awayGoals
    }
    return total / N
  }
  const clearAvg = avgGoals('clear')
  const snowAvg = avgGoals('snow')
  assert.ok(snowAvg < clearAvg, `expected snow to reduce scoring: clear=${clearAvg}, snow=${snowAvg}`)
})

test('bad weather narrows the average scoreline gap between a strong side and a weak side', () => {
  const strongClub = CLUBS.find((c) => c.id === 'man-city')
  const weakClub = CLUBS.find((c) => c.id === 'sunderland')
  const strongSquad = generateSquadForClub(strongClub)
  const weakSquad = generateSquadForClub(weakClub)
  const strongLineup = pickBestXI(strongSquad, '4-4-2')
  const weakLineup = pickBestXI(weakSquad, '4-4-2')

  const N = 500
  function avgMargin(weather) {
    let total = 0
    for (let i = 0; i < N; i++) {
      const r = simulateMatch({
        homeClub: strongClub,
        awayClub: weakClub,
        homeSquad: strongSquad,
        awaySquad: weakSquad,
        homeLineup: strongLineup,
        awayLineup: weakLineup,
        weather,
      })
      total += r.homeGoals - r.awayGoals
    }
    return total / N
  }

  const clearMargin = avgMargin('clear')
  const snowMargin = avgMargin('snow')
  assert.ok(snowMargin < clearMargin, `expected snow to narrow the gap: clear=${clearMargin}, snow=${snowMargin}`)
})

test('formation and weather are opt-in - simulateMatch behaves exactly as before when neither is supplied', () => {
  const r = simulateMatch({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup })
  assert.equal(r.weather, 'clear')
  assert.equal(r.isDerby, false)
})
