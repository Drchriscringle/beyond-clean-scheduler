// Pure match state: 501 double-out, first to N legs, optionally in sets.
// Player 0 is always the human, player 1 the virtual opponent (or both AI in sims).
import { BOGEY_FINISHES, minDartsToFinish } from './checkout.js'
import { recordLeg } from './rules.js'

export const IMPOSSIBLE_SCORES = [179, 178, 176, 175, 173, 172, 169, 166, 163]

function emptyStats() {
  return { darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, legDarts: [], dartsAtDouble: 0, doubles: {} }
}

export function createMatch({ format, startingPlayer = 0, startScore = 501 }) {
  return {
    format, // see rules.js
    startScore,
    scores: [startScore, startScore],
    legs: [0, 0], // legs in the current set (or the match, with no sets)
    sets: [0, 0],
    turn: startingPlayer,
    legStarter: startingPlayer,
    legDarts: [0, 0],
    visits: [], // current leg: { player, scored, bust, checkout, darts, dartsThrown, remaining }
    lastVisit: [null, null],
    stats: [emptyStats(), emptyStats()],
    winner: null,
    legNumber: 1,
    opened: [false, false], // double-in: has each side started scoring this leg
    sideVisits: [0, 0], // pairs: which team-mate is up next
  }
}

// In pairs play, which of the two team-mates throws this side's next visit (0 or 1).
export function pairsThrower(state, side) {
  return state.sideVisits[side] % 2
}

// Validate a score typed in for the human. Returns the visit, or { error }.
export function interpretEnteredScore(remaining, score, dartsUsed = 3) {
  if (!Number.isInteger(score) || score < 0 || score > 180) return { error: 'Enter a score from 0 to 180' }
  if (IMPOSSIBLE_SCORES.includes(score)) return { error: `${score} isn't possible with three darts` }
  if (score === remaining) {
    if (remaining > 170 || BOGEY_FINISHES.includes(remaining)) return { error: `${remaining} can't be checked out` }
    const min = minDartsToFinish(remaining)
    if (dartsUsed < min) return { error: `${remaining} needs at least ${min} darts` }
    return { scored: score, bust: false, checkout: true, dartsThrown: dartsUsed }
  }
  if (score > remaining || remaining - score === 1) return { scored: 0, bust: true, checkout: false, dartsThrown: 3 }
  return { scored: score, bust: false, checkout: false, dartsThrown: 3 }
}

// Apply a visit ({ scored, bust, checkout, dartsThrown, darts? }) for state.turn.
export function applyVisit(state, visit) {
  if (state.winner !== null) return state
  const p = state.turn
  const s = structuredClone(state)
  const scored = visit.bust ? 0 : visit.scored
  const remaining = s.scores[p] - scored
  const st = s.stats[p]
  st.darts += visit.dartsThrown
  st.points += scored
  st.dartsAtDouble += visit.dartsAtDouble ?? 0
  s.legDarts[p] += visit.dartsThrown
  if (scored === 180) st.s180++
  else if (scored >= 140) st.s140++
  else if (scored >= 100) st.s100++
  s.scores[p] = remaining
  if (scored > 0) s.opened[p] = true
  s.sideVisits[p]++
  const record = { player: p, scored, bust: !!visit.bust, checkout: !!visit.checkout, dartsThrown: visit.dartsThrown, remaining, darts: visit.darts ?? null, thrower: visit.thrower ?? 0 }
  s.visits.push(record)
  s.lastVisit[p] = record

  if (visit.checkout && remaining === 0) {
    st.checkouts++
    st.highCheckout = Math.max(st.highCheckout, scored)
    if (scored >= 100) st.tonPlusOuts = (st.tonPlusOuts ?? 0) + 1
    if (scored === 170) st.bigFish = (st.bigFish ?? 0) + 1
    st.legDarts.push(s.legDarts[p])
    if (visit.double) st.doubles[visit.double] = (st.doubles[visit.double] ?? 0) + 1
    const score = { legs: s.legs, sets: s.sets }
    const { setWon, matchWinner } = recordLeg(score, s.format, p)
    s.legs = score.legs
    s.sets = score.sets
    s.winner = matchWinner
    s.lastLegWinner = p
    s.lastSetWon = setWon
    if (s.winner === null) {
      s.legStarter = 1 - s.legStarter
      s.turn = s.legStarter
      s.scores = [s.startScore, s.startScore]
      s.legDarts = [0, 0]
      s.visits = []
      s.opened = [false, false]
      s.legNumber++
    }
    return s
  }
  s.turn = 1 - p
  return s
}

export function threeDartAverage(stats) {
  return stats.darts ? (stats.points * 3) / stats.darts : 0
}
