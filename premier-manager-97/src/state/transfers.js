import { estimatePlayerValue } from './finance.js'

export function evaluateOffer(player, fee) {
  const value = estimatePlayerValue(player)
  if (fee >= value * 0.92) {
    return {
      accepted: true,
      message: `Offer accepted for ${player.name}.`,
    }
  }
  if (fee >= value * 0.55) {
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

export function costPerSeat(reputation) {
  return 1400 + reputation * 260
}

export function buildCost(capacityAdd, reputation) {
  return Math.round(capacityAdd * costPerSeat(reputation))
}

export function buildWeeks(capacityAdd) {
  return Math.max(4, Math.round(capacityAdd / 1500))
}
