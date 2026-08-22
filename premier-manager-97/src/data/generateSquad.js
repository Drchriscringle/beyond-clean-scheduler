import { STAR_PLAYERS } from './starPlayers.js'
import { generateName } from './namePool.js'

// Simple seeded PRNG (mulberry32) so a new game's squads are reproducible
// for the length of that session without needing to persist anything.
export function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

const TARGET_SQUAD_SIZE = {
  5: 27, // Big Six - deep squads, European football
  4: 25,
  3: 24,
  2: 23,
  1: 22, // newly promoted / smallest budgets
}

// How many of each position line a squad needs, roughly, before topping up
// with whatever's left. Index 0 counts GK, 1 DF, 2 MF, 3 FW.
const POSITION_SHARE = { GK: 0.11, DF: 0.32, MF: 0.34, FW: 0.23 }

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function abilityToAttributes(position, ability, rng) {
  const jitter = () => Math.round((rng() - 0.5) * 4)
  const base = clamp(Math.round(ability / 5), 1, 20)
  const attrs = {
    pace: clamp(base + jitter(), 1, 20),
    tackling: clamp(base + jitter(), 1, 20),
    passing: clamp(base + jitter(), 1, 20),
    shooting: clamp(base + jitter(), 1, 20),
    stamina: clamp(base + jitter(), 1, 20),
    strength: clamp(base + jitter(), 1, 20),
  }
  if (position === 'GK') {
    attrs.tackling = clamp(base + 3 + jitter(), 1, 20) // handling
    attrs.shooting = clamp(base + 3 + jitter(), 1, 20) // reflexes
    attrs.pace = clamp(base - 4 + jitter(), 1, 20)
  } else if (position === 'DF') {
    attrs.tackling = clamp(base + 3 + jitter(), 1, 20)
    attrs.strength = clamp(base + 2 + jitter(), 1, 20)
  } else if (position === 'MF') {
    attrs.passing = clamp(base + 3 + jitter(), 1, 20)
    attrs.stamina = clamp(base + 2 + jitter(), 1, 20)
  } else if (position === 'FW') {
    attrs.shooting = clamp(base + 3 + jitter(), 1, 20)
    attrs.pace = clamp(base + 2 + jitter(), 1, 20)
  }
  return attrs
}

function wageForAbility(ability, reputation, rng) {
  const repFactor = 0.55 + reputation * 0.22
  const raw = 900 * Math.pow(ability / 55, 3.1) * repFactor
  const noise = 0.85 + rng() * 0.3
  return Math.max(1200, Math.round((raw * noise) / 100) * 100)
}

export function buildPlayer({ id, name, position, age, ability, potential, reputation, rng }) {
  return {
    id,
    name,
    age,
    position,
    squadNumber: null,
    ability: clamp(Math.round(ability), 1, 99),
    potential: clamp(Math.round(potential), 1, 99),
    wage: wageForAbility(ability, reputation, rng),
    contractYears: 1 + Math.floor(rng() * 5),
    morale: 50 + Math.floor(rng() * 40),
    fitness: 82 + Math.floor(rng() * 18),
    listed: false,
    formHistory: [],
    stats: { appearances: 0, goals: 0, assists: 0, motm: 0 },
    careerStats: { appearances: 0, goals: 0, assists: 0, motm: 0 },
    injured: false,
    injuryType: null,
    injuryWeeks: 0,
    suspended: false,
    suspensionMatches: 0,
    yellowCards: 0,
    attributes: abilityToAttributes(position, ability, rng),
    scouted: false,
  }
}

function assignSquadNumbers(players, rng) {
  const pool = Array.from({ length: 40 }, (_, i) => i + 1)
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const gks = players.filter((p) => p.position === 'GK')
  const rest = players.filter((p) => p.position !== 'GK')
  const preferredGkNumbers = [1, 13, 23].filter((n) => pool.includes(n))
  gks.forEach((p, i) => {
    p.squadNumber = preferredGkNumbers[i] ?? pool.pop()
  })
  rest.forEach((p) => {
    let n
    do {
      n = pool.pop()
    } while (n != null && [1, 13, 23].includes(n) && pool.length > 0)
    p.squadNumber = n ?? Math.floor(rng() * 40) + 1
  })
}

export function generateSquadForClub(club) {
  const rng = mulberry32(hashString(club.id) ^ 0x9e3779b9)
  const stars = STAR_PLAYERS[club.id] ?? []
  const targetSize = TARGET_SQUAD_SIZE[club.reputation] ?? 24
  const players = []
  let idCounter = 0

  for (const star of stars) {
    idCounter += 1
    players.push(
      buildPlayer({
        id: `${club.id}-${idCounter}`,
        name: star.name,
        position: star.position,
        age: star.age,
        ability: star.star,
        potential: star.age <= 24 ? Math.min(99, star.star + 6) : star.star,
        reputation: club.reputation,
        rng,
      }),
    )
  }

  const remaining = Math.max(0, targetSize - players.length)
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 }
  for (const p of players) counts[p.position] += 1
  const usedNames = new Set(players.map((p) => p.name))

  const positions = ['GK', 'DF', 'MF', 'FW']
  for (let i = 0; i < remaining; i++) {
    // pick whichever position is furthest below its target share
    let choice = 'MF'
    let worstDeficit = -Infinity
    for (const pos of positions) {
      const targetCount = POSITION_SHARE[pos] * targetSize
      const deficit = targetCount - counts[pos]
      if (deficit > worstDeficit) {
        worstDeficit = deficit
        choice = pos
      }
    }
    counts[choice] += 1
    idCounter += 1
    const baseAbility = 42 + club.reputation * 6
    const age = 18 + Math.floor(rng() * 15)
    const ability = clamp(baseAbility + Math.round((rng() - 0.4) * 22), 38, 82)
    const youthBonus = age <= 21 ? Math.round(rng() * 12) : Math.round(rng() * 4)
    let name = generateName(rng)
    let attempts = 0
    while (usedNames.has(name) && attempts < 10) {
      name = generateName(rng)
      attempts += 1
    }
    usedNames.add(name)
    players.push(
      buildPlayer({
        id: `${club.id}-gen-${idCounter}`,
        name,
        position: choice,
        age,
        ability,
        potential: clamp(ability + youthBonus, ability, 95),
        reputation: club.reputation,
        rng,
      }),
    )
  }

  assignSquadNumbers(players, rng)
  players.sort((a, b) => a.squadNumber - b.squadNumber)
  return players
}
