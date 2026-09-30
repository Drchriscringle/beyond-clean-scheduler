// Fast AI-vs-AI matches using the same dart-by-dart engine the opponent uses.
// Kept allocation-light because whole 128-player brackets are simulated at once.
import { playVisit, sigmaForAverage } from './bot.js'

function simulateLeg(sigmas, starter, rng, totals) {
  const rem = [501, 501]
  let p = starter
  for (let guard = 0; guard < 2000; guard++) {
    const v = playVisit(rem[p], sigmas[p], rng)
    totals.darts[p] += v.darts.length
    totals.points[p] += v.scored
    rem[p] -= v.scored
    if (v.checkout) return p
    p = 1 - p
  }
  return rng() < 0.5 ? 0 : 1
}

export function simulateMatch(avgA, avgB, format, rng = Math.random) {
  const sigmas = [sigmaForAverage(avgA), sigmaForAverage(avgB)]
  const totals = { darts: [0, 0], points: [0, 0] }
  let starter = rng() < 0.5 ? 0 : 1
  const sets = [0, 0]
  let legs = [0, 0]
  for (;;) {
    const w = simulateLeg(sigmas, starter, rng, totals)
    starter = 1 - starter
    legs[w]++
    if (legs[w] >= format.legs) {
      if (!format.sets) break
      sets[w]++
      if (sets[w] >= format.sets) break
      legs = [0, 0]
    }
  }
  const winner = format.sets ? (sets[0] > sets[1] ? 0 : 1) : legs[0] > legs[1] ? 0 : 1
  return {
    winner,
    score: format.sets ? sets : legs,
    averages: [0, 1].map((i) => (totals.darts[i] ? (totals.points[i] * 3) / totals.darts[i] : 0)),
  }
}
