// Pure match state: 501 double-out, first to N legs, optionally in sets.
// Player 0 is always the human, player 1 the virtual opponent (or both AI in sims).
import { BOGEY_FINISHES, minDartsToFinish } from './checkout.js'

export const IMPOSSIBLE_SCORES = [179, 178, 176, 175, 173, 172, 169, 166, 163]

function emptyStats() {
  return { darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, legDarts: [] }
}

export function createMatch({ format, startingPlayer = 0, startScore = 501 }) {
  return {
    format, // { legs: firstTo, sets: firstTo | 0 }
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
  }
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

export function currentLegFirstTo(state) {
  return state.format.legs
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
  s.legDarts[p] += visit.dartsThrown
  if (scored === 180) st.s180++
  else if (scored >= 140) st.s140++
  else if (scored >= 100) st.s100++
  s.scores[p] = remaining
  const record = { player: p, scored, bust: !!visit.bust, checkout: !!visit.checkout, dartsThrown: visit.dartsThrown, remaining, darts: visit.darts ?? null }
  s.visits.push(record)
  s.lastVisit[p] = record

  if (visit.checkout && remaining === 0) {
    st.checkouts++
    st.highCheckout = Math.max(st.highCheckout, scored)
    st.legDarts.push(s.legDarts[p])
    s.legs[p]++
    const { legs: legsToWin, sets: setsToWin } = s.format
    if (s.legs[p] >= legsToWin) {
      if (setsToWin) {
        s.sets[p]++
        if (s.sets[p] >= setsToWin) s.winner = p
        else s.legs = [0, 0]
      } else {
        s.winner = p
      }
    }
    s.lastLegWinner = p
    if (s.winner === null) {
      s.legStarter = 1 - s.legStarter
      s.turn = s.legStarter
      s.scores = [s.startScore, s.startScore]
      s.legDarts = [0, 0]
      s.visits = []
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
