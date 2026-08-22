export const DEFAULT_LOAN_WEEKS = 8
export const MIN_LOAN_WEEKS = 1
export const MAX_LOAN_WEEKS = 20

// Loaning a player out: every squad in the game carries a similar number of
// players per position (8-9 midfielders regardless of club), so "do they
// already have enough cover" isn't a useful signal here - instead, a club
// turns down a loan only if the player is a clear downgrade on even their
// weakest current option in that position.
export function evaluateLoanOffer(targetSquad, player, weeks) {
  if (weeks < MIN_LOAN_WEEKS || weeks > MAX_LOAN_WEEKS) {
    return { accepted: false, message: 'That loan length is not something clubs will consider.' }
  }
  const positionPeers = targetSquad.filter((p) => p.position === player.position)
  const weakestPeerAbility = positionPeers.length > 0 ? Math.min(...positionPeers.map((p) => p.ability)) : 0
  if (player.ability < weakestPeerAbility - 10) {
    return { accepted: false, message: `${player.name} isn't an improvement on what they already have at ${player.position} and they turn down the loan.` }
  }
  return { accepted: true, message: `${player.name} joins on loan for ${weeks} week(s).` }
}

// Requesting a loan in: a club will only let a player leave on loan if they
// have clear cover ahead of them in the same position.
export function evaluateLoanRequest(targetSquad, player, weeks) {
  if (weeks < MIN_LOAN_WEEKS || weeks > MAX_LOAN_WEEKS) {
    return { accepted: false, message: 'That loan length is not something clubs will consider.' }
  }
  const betterInPosition = targetSquad.filter(
    (p) => p.id !== player.id && p.position === player.position && p.ability > player.ability,
  ).length
  if (betterInPosition < 2) {
    return { accepted: false, message: `${player.name} is too important to their current club to be allowed out on loan.` }
  }
  return { accepted: true, message: `${player.name} joins on loan for ${weeks} week(s).` }
}

// Weekly countdown for every player currently out on loan, wherever they
// are - returns them to their parent club automatically once the loan
// expires. Squads is the full club-id-to-squad-array map for every club.
export function tickLoans(squads) {
  const next = { ...squads }
  for (const clubId of Object.keys(next)) {
    const staying = []
    for (const p of next[clubId]) {
      if (p.loanFromClubId && p.loanFromClubId !== clubId) {
        const weeksRemaining = p.loanWeeksRemaining - 1
        if (weeksRemaining <= 0) {
          const returned = { ...p, loanFromClubId: null, loanWeeksRemaining: 0 }
          next[p.loanFromClubId] = [...(next[p.loanFromClubId] ?? []), returned]
          continue
        }
        staying.push({ ...p, loanWeeksRemaining: weeksRemaining })
      } else {
        staying.push(p)
      }
    }
    next[clubId] = staying
  }
  return next
}
