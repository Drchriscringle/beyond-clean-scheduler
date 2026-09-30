// Knockout brackets. Byes are null slots and advance their opponent automatically.
import { roundFormat } from './calendar.js'
import { shuffle } from '../engine/rng.js'
import { simulateMatch } from '../engine/sim.js'

export function seedOrder(size) {
  let order = [1, 2]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

// entrants are ordered by seed when event.seeded, otherwise drawn at random.
export function createTournament(event, entrants, rng = Math.random) {
  const size = event.size
  const list = event.seeded ? entrants.slice(0, size) : shuffle(entrants, rng).slice(0, size)
  const slots = seedOrder(size).map((seed) => list[seed - 1] ?? null)
  const pairs = []
  for (let i = 0; i < size; i += 2) pairs.push([slots[i], slots[i + 1]])
  return { size, rounds: [pairs], results: [[]], round: 0, finished: false, champion: null, eliminated: {} }
}

export function totalRounds(t) {
  return Math.log2(t.size)
}

export function userPair(t) {
  if (t.finished) return null
  const pairs = t.rounds[t.round]
  const i = pairs.findIndex((p) => p.includes('user'))
  return i < 0 ? null : { index: i, pair: pairs[i], opponent: pairs[i][0] === 'user' ? pairs[i][1] : pairs[i][0] }
}

export function isAlive(t, id) {
  return !(id in t.eliminated)
}

// Resolve every match in the current round. userResult is { userWon, score:[user, opp], ... }
export function resolveRound(t, event, { avgFor, matchLength, rng = Math.random, userResult = null }) {
  const format = roundFormat(event, t.round, matchLength)
  const results = []
  const winners = []
  for (const [a, b] of t.rounds[t.round]) {
    let res
    if (a === null && b === null) {
      winners.push(null)
      continue
    }
    if (a === null || b === null) {
      res = { a, b, winner: a ?? b, bye: true }
    } else if (a === 'user' || b === 'user') {
      if (!userResult) throw new Error('user match has no result')
      const userIsA = a === 'user'
      const winner = userResult.userWon ? 'user' : userIsA ? b : a
      const [us, them] = userResult.score
      res = { a, b, winner, score: userIsA ? [us, them] : [them, us], averages: userIsA ? [userResult.userAvg, userResult.oppAvg] : [userResult.oppAvg, userResult.userAvg], sets: !!format.sets, played: !userResult.simulated }
    } else {
      const sim = simulateMatch(avgFor(a), avgFor(b), format, rng)
      res = { a, b, winner: sim.winner === 0 ? a : b, score: sim.score, averages: sim.averages, sets: !!format.sets }
    }
    const loser = res.winner === res.a ? res.b : res.a
    if (loser !== null) t.eliminated[loser] = t.round
    results.push(res)
    winners.push(res.winner)
  }
  t.results[t.round] = results
  if (winners.length === 1) {
    t.finished = true
    t.champion = winners[0]
    return t
  }
  const next = []
  for (let i = 0; i < winners.length; i += 2) next.push([winners[i], winners[i + 1]])
  t.round++
  t.rounds.push(next)
  t.results.push([])
  return t
}

// stage 0 = winner, 1 = runner-up, 2 = semi-finalist, ... (index into prize tables)
export function stageFor(t, id) {
  if (t.champion === id) return 0
  if (!(id in t.eliminated)) return null
  return totalRounds(t) - t.eliminated[id]
}

export function roundsWon(t, id) {
  if (t.champion === id) return totalRounds(t)
  return t.eliminated[id] ?? t.round
}
