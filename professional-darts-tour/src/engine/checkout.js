// Checkout routes and target selection. Routes are found by brute force once at
// load time (about 80k combinations) and scored so they read like a pro's choice:
// fewest darts first, then easy set-up darts, then a favourite finishing double.
import { targetValue } from './board.js'

const NUMBERS = Array.from({ length: 20 }, (_, i) => 20 - i)
const TREBLES = NUMBERS.map((n) => `T${n}`)
const SINGLES = NUMBERS.map((n) => `S${n}`)
const DOUBLES = [...NUMBERS.map((n) => `D${n}`), 'DB']
const ALL_DARTS = [...TREBLES, ...SINGLES, 'SB', ...DOUBLES]

export const BOGEY_FINISHES = [169, 168, 166, 165, 163, 162, 159]

function setupCost(t) {
  if (t === 'SB') return 1.2
  if (t === 'DB') return 1.4
  if (t[0] === 'S') return 0.2
  if (t[0] === 'D') return 1.5
  const named = { T20: 0.5, T19: 0.55, T18: 0.6, T17: 0.65, T16: 0.7 }[t]
  if (named !== undefined) return named
  return Number(t.slice(1)) >= 10 ? 0.8 : 1.0
}

function finishCost(t) {
  if (t === 'DB') return 0.8
  const n = Number(t.slice(1))
  if (n === 20 || n === 16) return 0
  if ([18, 10, 8].includes(n)) return 0.1
  if ([12, 4, 14, 6].includes(n)) return 0.25
  if (n === 1 || n === 3) return 0.7
  return 0.45
}

const LENGTH_PENALTY = [0, 0, 3, 6]

// best[n][remaining] = { route, cost } using at most n darts
const best = [null, [], [], []]

function consider(route) {
  const total = route.reduce((s, t) => s + targetValue(t), 0)
  if (total > 170) return
  const cost =
    LENGTH_PENALTY[route.length] +
    finishCost(route[route.length - 1]) +
    route.slice(0, -1).reduce((s, t) => s + setupCost(t), 0)
  for (let n = route.length; n <= 3; n++) {
    const current = best[n][total]
    if (!current || cost < current.cost) best[n][total] = { route, cost }
  }
}

for (const f of DOUBLES) consider([f])
for (const a of ALL_DARTS) for (const f of DOUBLES) consider([a, f])
for (const a of ALL_DARTS) for (const b of ALL_DARTS) for (const f of DOUBLES) consider([a, b, f])

export function checkoutRoute(remaining, darts = 3) {
  if (darts < 1 || remaining < 2 || remaining > 170) return null
  return best[Math.min(darts, 3)][remaining]?.route ?? null
}

function routeCost(remaining, darts) {
  if (darts < 1 || remaining < 2 || remaining > 170) return null
  return best[Math.min(darts, 3)][remaining]?.cost ?? null
}

export function minDartsToFinish(remaining) {
  for (let d = 1; d <= 3; d++) if (checkoutRoute(remaining, d)) return d
  return null
}

export function isCheckoutPossible(remaining) {
  return minDartsToFinish(remaining) !== null
}

const SETUP_CANDIDATES = ['T20', 'T19', 'T18', 'T17', ...SINGLES, 'SB']

// What should the thrower aim at with `dartsLeft` darts in hand?
export function chooseTarget(remaining, dartsLeft) {
  const route = checkoutRoute(remaining, dartsLeft)
  if (route) return route[0]
  if (remaining > 230) return 'T20'
  let bestTarget = 'T20'
  let bestScore = Infinity
  for (const t of SETUP_CANDIDATES) {
    const leave = remaining - targetValue(t)
    if (leave < 2) continue
    const finishNow = routeCost(leave, dartsLeft - 1)
    const finishNext = routeCost(leave, 3)
    let score
    if (finishNow !== null) score = finishNow
    else if (finishNext !== null) score = 10 + finishNext
    else score = 20 + leave / 10
    score += setupCost(t)
    if (score < bestScore) {
      bestScore = score
      bestTarget = t
    }
  }
  return bestTarget
}
