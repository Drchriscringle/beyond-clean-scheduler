import { FORMATIONS } from '../data/formations.js'

// Picks the strongest available XI from a squad for a given formation,
// respecting position counts. Falls back to filling gaps with whoever's
// left if a squad is short on a position (e.g. after a raft of sales).
export function pickBestXI(squad, formationName = '4-4-2') {
  const formation = FORMATIONS[formationName] ?? FORMATIONS['4-4-2']
  const available = [...squad]
    .filter((p) => p.fitness >= 45)
    .sort((a, b) => b.ability - a.ability)

  const chosen = []
  const usedIds = new Set()

  for (const pos of ['GK', 'DF', 'MF', 'FW']) {
    const need = formation[pos]
    const candidates = available.filter((p) => p.position === pos && !usedIds.has(p.id))
    for (let i = 0; i < need && i < candidates.length; i++) {
      chosen.push(candidates[i])
      usedIds.add(candidates[i].id)
    }
  }

  if (chosen.length < 11) {
    const leftovers = available.filter((p) => !usedIds.has(p.id))
    for (const p of leftovers) {
      if (chosen.length >= 11) break
      chosen.push(p)
      usedIds.add(p.id)
    }
  }

  return chosen.map((p) => p.id)
}
