import { estimatePlayerValue } from './finance.js'

const OFFER_CHANCE = 0.35

// Once in a while, if the manager has transfer-listed a player, some other
// club comes in with a bid. Only ever one offer generated per week so the
// list doesn't flood.
export function maybeGenerateOffer({ squad, clubIds, playerClubId, week, rng = Math.random }) {
  const listed = squad.filter((p) => p.listed)
  if (listed.length === 0) return null
  if (rng() > OFFER_CHANCE) return null

  const player = listed[Math.floor(rng() * listed.length)]
  const otherClubs = clubIds.filter((id) => id !== playerClubId)
  const fromClubId = otherClubs[Math.floor(rng() * otherClubs.length)]
  const value = estimatePlayerValue(player)
  const fee = Math.round((value * (0.75 + rng() * 0.5)) / 10_000) * 10_000

  return {
    id: `offer-${week}-${player.id}-${Math.floor(rng() * 1_000_000)}`,
    playerId: player.id,
    playerName: player.name,
    fromClubId,
    fee,
    week,
  }
}
