// A strong season can catch the eye of a bigger club. Only clubs with
// strictly higher reputation than the manager's current one are candidates -
// there's nowhere "up" to go from reputation 5, so those never generate
// offers - and a bigger reputation jump is rarer than a small one.
const OFFER_CHANCE = 0.35
const SECOND_OFFER_CHANCE = 0.25

export function generateJobOffers({ club, objectiveMet, finalPosition, divisionSize, allClubs, playerClubId, rng = Math.random }) {
  const strongSeason = objectiveMet && finalPosition <= Math.ceil(divisionSize / 2)
  if (!strongSeason) return []
  if (rng() > OFFER_CHANCE) return []

  // Foreign clubs (division 'FOREIGN') never offer the player a job - they
  // have no fixtures or league position of their own for a manager to take
  // charge of, only a persistent squad for the transfer market.
  const candidates = Object.values(allClubs).filter((c) => c.id !== playerClubId && c.division !== 'FOREIGN' && c.reputation > club.reputation)
  if (candidates.length === 0) return []

  const pool = candidates.map((c) => ({ id: c.id, weight: 1 / (c.reputation - club.reputation) }))
  const wantsSecond = rng() < SECOND_OFFER_CHANCE && pool.length > 1
  const count = wantsSecond ? 2 : 1

  const picked = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((s, w) => s + w.weight, 0)
    let roll = rng() * total
    let idx = pool.length - 1
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight
      if (roll <= 0) {
        idx = j
        break
      }
    }
    picked.push(pool.splice(idx, 1)[0].id)
  }
  return picked
}
