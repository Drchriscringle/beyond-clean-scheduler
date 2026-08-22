import { estimatePlayerValue } from './finance.js'

// swapValue: estimated value of any of your own players thrown in as
// makeweights (valued at a discount - clubs prefer cash to a player they
// didn't choose); sellOnPercent: a cut of any future resale offered as a
// sweetener (worth only a little to a seller who'd rather have cash now).
export function evaluateOffer(player, fee, { swapValue = 0, sellOnPercent = 0 } = {}) {
  const value = estimatePlayerValue(player)
  const effectiveFee = fee + swapValue * 0.85 + fee * (sellOnPercent / 100) * 0.15
  if (effectiveFee >= value * 0.92) {
    return {
      accepted: true,
      message: `Offer accepted for ${player.name}.`,
    }
  }
  if (effectiveFee >= value * 0.55) {
    return {
      accepted: false,
      counterFee: Math.round(value * 0.95),
      message: `Rejected. They value ${player.name} at closer to that price.`,
    }
  }
  return {
    accepted: false,
    counterFee: null,
    message: `Rejected out of hand. That offer is not taken seriously for ${player.name}.`,
  }
}

// A sell-on clause persists on the player indefinitely - whoever holds it
// gets their cut every time the player is sold on again, by anyone.
export function settleSellOnClauses(player, fee) {
  const clauses = player.sellOnClauses ?? []
  let netFee = fee
  const payouts = []
  for (const clause of clauses) {
    const amount = Math.round(fee * (clause.percent / 100))
    if (amount > 0) {
      netFee -= amount
      payouts.push({ clubId: clause.clubId, amount })
    }
  }
  return { netFee, payouts }
}

// The reverse of evaluateOffer: you are shopping a player TO a club rather
// than them coming to you, so a fair-or-better asking price is judged from
// the buyer's side (they won't overpay, and won't buy into an already-deep
// position) instead of the seller's.
export function evaluateClubInterest(targetSquad, player, askingFee) {
  const value = estimatePlayerValue(player)
  if (askingFee > value * 1.3) {
    return { accepted: false, message: `${player.name} is priced too high for them to consider a deal.` }
  }
  const samePosCount = targetSquad.filter((p) => p.position === player.position).length
  if (samePosCount >= 5) {
    return { accepted: false, message: `They already have plenty of cover at ${player.position} and pass on the move.` }
  }
  if (askingFee <= value * 1.05) {
    return { accepted: true, message: `Deal agreed — ${player.name} joins them for ${askingFee.toLocaleString('en-GB')}.` }
  }
  return { accepted: false, message: `They feel that fee is a bit steep for ${player.name} right now.` }
}

export function costPerSeat(reputation) {
  return 1400 + reputation * 260
}

export function buildCost(capacityAdd, reputation) {
  return Math.round(capacityAdd * costPerSeat(reputation))
}

export function buildWeeks(capacityAdd) {
  return Math.max(4, Math.round(capacityAdd / 1500))
}
