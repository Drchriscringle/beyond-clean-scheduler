// Scoring rules shared by live matches and simulations.
//
// format = {
//   legs,          first to N legs (per set, when sets > 0)
//   sets,          first to N sets, or 0 for a legs-only match
//   winBy2,        must win by two clear legs (World Matchplay)
//   sdAt,          sudden-death leg once both players reach this many legs
//   setTiebreak,   deciding set must be won by two, sudden death at legs+2 (World Championship)
//   doubleIn,      legs must start on a double (World Grand Prix)
//   pairs,         two throwers per side, alternating visits (World Cup)
// }

function wonBlock(legs, p, target, winBy2, sdAt) {
  const o = 1 - p
  if (!winBy2) return legs[p] >= target
  if (legs[p] >= target && legs[p] - legs[o] >= 2) return true
  return sdAt != null && legs[p] > sdAt && legs[o] >= sdAt
}

// Mutates score { legs, sets } after player w wins a leg. Returns { setWon, matchWinner }.
export function recordLeg(score, format, w) {
  score.legs[w]++
  if (format.sets) {
    const decider = score.sets[0] === format.sets - 1 && score.sets[1] === format.sets - 1
    const tb = decider && !!format.setTiebreak
    if (wonBlock(score.legs, w, format.legs, tb, tb ? format.legs + 2 : null)) {
      score.sets[w]++
      score.legs = [0, 0]
      return { setWon: true, matchWinner: score.sets[w] >= format.sets ? w : null }
    }
    return { setWon: false, matchWinner: null }
  }
  return { setWon: false, matchWinner: wonBlock(score.legs, w, format.legs, !!format.winBy2, format.sdAt ?? null) ? w : null }
}
