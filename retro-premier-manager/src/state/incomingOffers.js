import { estimatePlayerValue } from './finance.js'

const OFFER_CHANCE = 0.35
// On deadline day itself, every listed player gets an independent, elevated
// roll rather than at most one bid for the whole squad - clubs are racing
// the clock, not politely queuing.
const DEADLINE_DAY_OFFER_CHANCE = 0.55

function buildOffer(player, clubIds, playerClubId, week, rng) {
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

// Once in a while, if the manager has transfer-listed a player, some other
// club comes in with a bid. Only ever one offer generated per week so the
// list doesn't flood.
export function maybeGenerateOffer({ squad, clubIds, playerClubId, week, rng = Math.random }) {
  const listed = squad.filter((p) => p.listed)
  if (listed.length === 0) return null
  if (rng() > OFFER_CHANCE) return null

  const player = listed[Math.floor(rng() * listed.length)]
  return buildOffer(player, clubIds, playerClubId, week, rng)
}

// Deadline-day version: every listed player is rolled independently at a
// higher chance, so a squad with several players out the door can draw
// competing bids from more than one club on the same day.
export function generateDeadlineDayOffers({ squad, clubIds, playerClubId, week, rng = Math.random }) {
  const listed = squad.filter((p) => p.listed)
  const offers = []
  for (const player of listed) {
    if (rng() < DEADLINE_DAY_OFFER_CHANCE) offers.push(buildOffer(player, clubIds, playerClubId, week, rng))
  }
  return offers
}
