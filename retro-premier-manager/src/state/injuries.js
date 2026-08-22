import { injuryChanceMultiplier } from './personality.js'

// Named injury types with a weighted severity spread - most injuries are
// minor knocks, a few are season-disrupting.
export const INJURY_TYPES = [
  { name: 'Knock', min: 1, max: 2, weight: 30 },
  { name: 'Muscle fatigue', min: 1, max: 2, weight: 20 },
  { name: 'Ankle sprain', min: 2, max: 4, weight: 20 },
  { name: 'Hamstring strain', min: 3, max: 6, weight: 15 },
  { name: 'Groin strain', min: 3, max: 5, weight: 10 },
  { name: 'Knee ligament damage', min: 6, max: 12, weight: 4 },
  { name: 'Fractured metatarsal', min: 6, max: 10, weight: 1 },
]

export function rollInjury(rng = Math.random) {
  const total = INJURY_TYPES.reduce((sum, t) => sum + t.weight, 0)
  let roll = rng() * total
  for (const t of INJURY_TYPES) {
    roll -= t.weight
    if (roll <= 0) {
      return { type: t.name, weeks: t.min + Math.floor(rng() * (t.max - t.min + 1)) }
    }
  }
  const fallback = INJURY_TYPES[0]
  return { type: fallback.name, weeks: fallback.min }
}

// Rolled once per club per match for each starter - independent of which
// club the player belongs to, so injuries happen league-wide, not just to
// the manager's own side.
export function maybeInjureStarters(squad, starterIds, injuryRateMultiplier, rng = Math.random) {
  const freshIds = []
  const next = squad.map((p) => {
    if (!starterIds.includes(p.id) || p.injured) return p
    const chance = 0.012 * injuryRateMultiplier * injuryChanceMultiplier(p.personality)
    if (rng() < chance) {
      const { type, weeks } = rollInjury(rng)
      freshIds.push(p.id)
      return { ...p, injured: true, injuryType: type, injuryWeeks: weeks, fitness: 20 + Math.floor(rng() * 20) }
    }
    return p
  })
  return { squad: next, freshIds }
}

// Weekly countdown, run once per club regardless of how many matches (league
// + cup) they played - a player recovers whether selected or not. `excludeIds`
// skips anyone who was only just injured this same week, so a fresh injury
// isn't immediately ticked down to nothing before it ever takes effect.
export function tickInjuries(squad, excludeIds = new Set()) {
  return squad.map((p) => {
    if (!p.injured || excludeIds.has(p.id)) return p
    const injuryWeeks = Math.max(0, p.injuryWeeks - 1)
    if (injuryWeeks === 0) {
      // Fitness doesn't otherwise recover for clubs the manager isn't
      // actively rotating (AI squads), so restore it here on recovery -
      // otherwise a since-healed player would stay unselectably unfit forever.
      return { ...p, injured: false, injuryType: null, injuryWeeks: 0, fitness: Math.max(p.fitness, 85) }
    }
    return { ...p, injuryWeeks }
  })
}
