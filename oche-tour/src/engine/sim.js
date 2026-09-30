// Dart-by-dart match simulation (used when the player auto-sims their own match).
// sides: [sigmas for side 0, sigmas for side 1]; one sigma each, or two for pairs.
import { playVisit, sigmaForAverage } from './bot.js'
import { recordLeg } from './rules.js'

function simulateLeg(sigmas, starter, format, rng, totals, visitCount) {
  const rem = [501, 501]
  const opened = [!format.doubleIn, !format.doubleIn]
  let p = starter
  for (let guard = 0; guard < 2000; guard++) {
    const list = sigmas[p]
    const sigma = list[visitCount[p]++ % list.length]
    const v = playVisit(rem[p], sigma, rng, { needIn: !opened[p] })
    if (v.opened) opened[p] = true
    totals.darts[p] += v.darts.length
    totals.points[p] += v.scored
    rem[p] -= v.scored
    if (v.checkout) return p
    p = 1 - p
  }
  return rng() < 0.5 ? 0 : 1
}

export function simulateMatch(avgA, avgB, format, rng = Math.random) {
  const toSigmas = (a) => (Array.isArray(a) ? a : [a]).map(sigmaForAverage)
  const sigmas = [toSigmas(avgA), toSigmas(avgB)]
  const totals = { darts: [0, 0], points: [0, 0] }
  const visitCount = [0, 0]
  const score = { legs: [0, 0], sets: [0, 0] }
  const legsWon = [0, 0]
  let starter = rng() < 0.5 ? 0 : 1
  for (let guard = 0; guard < 400; guard++) {
    const w = simulateLeg(sigmas, starter, format, rng, totals, visitCount)
    starter = 1 - starter
    legsWon[w]++
    const { matchWinner } = recordLeg(score, format, w)
    if (matchWinner !== null) {
      return {
        winner: matchWinner,
        score: format.sets ? score.sets : score.legs,
        legs: legsWon,
        averages: [0, 1].map((i) => (totals.darts[i] ? (totals.points[i] * 3) / totals.darts[i] : 0)),
      }
    }
  }
  return { winner: 0, score: [1, 0], legs: legsWon, averages: [0, 0] }
}
