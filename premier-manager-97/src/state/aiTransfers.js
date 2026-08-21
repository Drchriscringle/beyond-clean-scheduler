import { currentForm } from './form.js'

const POSITIONS = ['GK', 'DF', 'MF', 'FW']
const TARGET_MIN = { GK: 2, DF: 6, MF: 6, FW: 4 }
const ACTIVITY_CHANCE = 0.08

// A light touch of life in the transfer market: each week every AI club has
// a small chance to sign a free agent (if short in a position) or release an
// ageing, out-of-form fringe player back into free agency. The player's own
// club is untouched - that squad is managed by hand.
export function aiTransferTick({ clubs, squads, freeAgents, playerClubId, week, rng = Math.random }) {
  let nextFreeAgents = [...freeAgents]
  const nextSquads = { ...squads }
  const events = []

  for (const clubId of Object.keys(clubs)) {
    if (clubId === playerClubId) continue
    if (rng() > ACTIVITY_CHANCE) continue

    const club = clubs[clubId]
    const squad = nextSquads[clubId]
    const positionCounts = { GK: 0, DF: 0, MF: 0, FW: 0 }
    for (const p of squad) positionCounts[p.position] += 1
    const thinPosition = POSITIONS.find((pos) => positionCounts[pos] < TARGET_MIN[pos])

    if (thinPosition && nextFreeAgents.length > 0 && rng() < 0.7) {
      const candidates = nextFreeAgents.filter((p) => p.position === thinPosition)
      const pool = candidates.length > 0 ? candidates : nextFreeAgents
      const pick = pool[Math.floor(rng() * pool.length)]
      nextFreeAgents = nextFreeAgents.filter((p) => p.id !== pick.id)
      const signed = { ...pick, contractYears: 2 + Math.floor(rng() * 3), listed: false }
      nextSquads[clubId] = [...squad, signed]
      events.push({ week, playerName: pick.name, fee: 0, outcome: 'signed', message: `${club.name} sign free agent ${pick.name} (${pick.position}).` })
    } else if (squad.length > 18) {
      const candidates = squad
        .filter((p) => p.age >= 29 && p.ability < 78)
        .map((p) => ({ p, score: currentForm(p) - p.age * 0.1 }))
        .sort((a, b) => a.score - b.score)
      if (candidates.length > 0) {
        const released = candidates[0].p
        nextSquads[clubId] = squad.filter((p) => p.id !== released.id)
        nextFreeAgents = [...nextFreeAgents, { ...released, contractYears: 0, listed: false }]
        events.push({ week, playerName: released.name, fee: 0, outcome: 'released', message: `${club.name} release ${released.name} to free agency.` })
      }
    }
  }

  return { squads: nextSquads, freeAgents: nextFreeAgents, events }
}
