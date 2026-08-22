import { currentForm } from './form.js'

// A player's expectation is driven by ability, current form, and how much
// they already earn - not a hard science, just enough to make lowball
// offers get rejected and fair ones get accepted.
export function expectedWage(player) {
  const form = currentForm(player)
  const formFactor = form >= 7.5 ? 1.15 : form >= 6.2 ? 1.0 : form >= 5 ? 0.92 : 0.8
  const ageFactor = player.age <= 22 ? 1.05 : player.age >= 33 ? 0.85 : 1.0
  return Math.round(player.wage * formFactor * ageFactor)
}

// Bonuses are pure extras on top of the negotiated wage - a player never
// turns down free money, so they don't factor into accept/reject below.
export function computeBonusPayout(squad, goals) {
  let total = 0
  for (const player of squad) {
    if (!player.goalBonus && !player.assistBonus) continue
    const goalsScored = goals.filter((g) => g.scorerId === player.id).length
    const assistsMade = goals.filter((g) => g.assistId === player.id).length
    total += goalsScored * player.goalBonus + assistsMade * player.assistBonus
  }
  return total
}

export function evaluateContractOffer(player, wage, years) {
  if (years < 1 || years > 5) {
    return { accepted: false, message: `${player.name}'s agent won't discuss a deal of that length.` }
  }
  const target = expectedWage(player)
  if (wage >= target * 0.92) {
    return {
      accepted: true,
      message: `${player.name} agrees to a new ${years}-year contract at ${wage.toLocaleString('en-GB')}/wk.`,
    }
  }
  if (wage >= target * 0.65) {
    return {
      accepted: false,
      counterWage: Math.round(target),
      message: `${player.name}'s agent holds out for closer to their asking price.`,
    }
  }
  return {
    accepted: false,
    counterWage: Math.round(target),
    message: `${player.name} is insulted by that offer and refuses to negotiate further this week.`,
  }
}
