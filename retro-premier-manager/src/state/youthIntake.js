import { buildPlayer } from '../data/generateSquad.js'
import { generateName } from '../data/namePool.js'
import { YOUTH_LEVELS } from '../data/facilities.js'

const POSITIONS = ['GK', 'DF', 'MF', 'FW']

// End-of-season academy graduates. Better youth facilities produce more
// prospects with a higher potential ceiling.
export function generateYouthIntake(club, season, rng = Math.random) {
  const youthLevel = club.facilities.youth
  const youthConfig = YOUTH_LEVELS.find((l) => l.level === youthLevel) ?? YOUTH_LEVELS[0]
  const count = youthLevel + (rng() < 0.35 ? 1 : 0)
  const prospects = []

  for (let i = 0; i < count; i++) {
    const position = POSITIONS[Math.floor(rng() * POSITIONS.length)]
    const age = 16 + Math.floor(rng() * 3)
    const ability = 28 + Math.floor(rng() * 14) + youthLevel * 2
    const potentialCeiling = 55 + Math.round(youthLevel * 8 * youthConfig.developmentRate) + Math.floor(rng() * 20)
    const potential = Math.min(96, Math.max(ability + 10, potentialCeiling))
    prospects.push(
      buildPlayer({
        id: `${club.id}-youth-${season}-${i}-${Math.floor(rng() * 1_000_000)}`,
        name: generateName(rng),
        position,
        age,
        ability,
        potential,
        reputation: club.reputation,
        rng,
      }),
    )
  }
  return prospects
}

export function assignFreeSquadNumbers(squad, newPlayers) {
  const used = new Set(squad.map((p) => p.squadNumber))
  let next = 1
  return newPlayers.map((p) => {
    while (used.has(next)) next += 1
    used.add(next)
    return { ...p, squadNumber: next }
  })
}
