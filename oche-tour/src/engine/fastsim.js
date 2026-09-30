// Fast statistical match for AI-vs-AI results across whole brackets.
// Leg-win odds are fitted to the dart engine (scripts/fit-fastsim.js):
// logit P(thrower wins leg) = 0.078 * (thrower avg - receiver avg) + throw advantage,
// and the throw advantage grows with standard (better players hold throw more).
import { recordLeg } from './rules.js'
import { gaussian } from './rng.js'

export function legWinProbability(throwerAvg, receiverAvg) {
  const base = (throwerAvg + receiverAvg) / 2
  const throwAdv = -0.08 + 0.0075 * base
  return 1 / (1 + Math.exp(-(0.078 * (throwerAvg - receiverAvg) + throwAdv)))
}

export function fastMatch(avgA, avgB, format, rng = Math.random) {
  const a = Array.isArray(avgA) ? avgA.reduce((s, x) => s + x, 0) / avgA.length : avgA
  const b = Array.isArray(avgB) ? avgB.reduce((s, x) => s + x, 0) / avgB.length : avgB
  // Double-in costs everyone a few points of average.
  const adj = format.doubleIn ? 0.93 : 1
  const pa = legWinProbability(a * adj, b * adj)
  const pb = legWinProbability(b * adj, a * adj)
  const score = { legs: [0, 0], sets: [0, 0] }
  const legs = [0, 0]
  let starter = rng() < 0.5 ? 0 : 1
  for (let guard = 0; guard < 400; guard++) {
    const w = starter === 0 ? (rng() < pa ? 0 : 1) : rng() < pb ? 1 : 0
    starter = 1 - starter
    legs[w]++
    const { matchWinner } = recordLeg(score, format, w)
    if (matchWinner !== null) {
      return {
        winner: matchWinner,
        score: format.sets ? score.sets : score.legs,
        legs,
        averages: [a * adj + gaussian(rng) * 2.5, b * adj + gaussian(rng) * 2.5].map((x) => Math.round(x * 100) / 100),
      }
    }
  }
  return { winner: 0, score: [1, 0], legs, averages: [a, b] }
}
