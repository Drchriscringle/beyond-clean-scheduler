// A handful of "marquee" flavor players per club, generated from the same
// fictional name pool as the rest of the squad (see namePool.js) rather
// than any real footballer's name - every attribute, including the star
// rating that feeds ability generation, is simulated fiction, consistent
// with every other player in the game. How many a club gets, and how good
// they are, scales with its reputation tier (5 = biggest budget/deepest
// squad down to 1 = smallest), so a marquee signing at a top club still
// reads as more of a household name than one at a newly-promoted side.
import { generateName } from './namePool.js'

const STAR_COUNT_BY_REPUTATION = { 5: 7, 4: 6, 3: 6, 2: 5, 1: 4 }

const STAR_RATING_RANGE_BY_REPUTATION = {
  5: [82, 92],
  4: [76, 87],
  3: [71, 84],
  2: [65, 80],
  1: [58, 75],
}

// Always leads with a GK, then cycles evenly through outfield lines so a
// small star count still spreads across the pitch instead of clumping.
function starPositionsForCount(count) {
  const rest = ['DF', 'MF', 'FW']
  const positions = ['GK']
  for (let i = 1; i < count; i++) positions.push(rest[(i - 1) % rest.length])
  return positions
}

export function generateStarPlayers(club, rng) {
  const count = STAR_COUNT_BY_REPUTATION[club.reputation] ?? 5
  const [lo, hi] = STAR_RATING_RANGE_BY_REPUTATION[club.reputation] ?? [65, 80]
  const positions = starPositionsForCount(count)
  const usedNames = new Set()
  const stars = []

  for (let i = 0; i < count; i++) {
    let name = generateName(rng)
    let attempts = 0
    while (usedNames.has(name) && attempts < 10) {
      name = generateName(rng)
      attempts += 1
    }
    usedNames.add(name)

    stars.push({
      name,
      position: positions[i],
      age: 21 + Math.floor(rng() * 13), // 21-33
      star: Math.round(lo + rng() * (hi - lo)),
    })
  }

  return stars
}
