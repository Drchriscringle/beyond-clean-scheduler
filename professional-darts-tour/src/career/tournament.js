// Brackets. Participants are player ids (or team ids for the World Cup); null is a bye.
import { shuffle } from '../engine/rng.js'

export function seedOrder(size) {
  let order = [1, 2]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

function base(kind, totalRounds) {
  return { kind, totalRounds, round: 0, rounds: [], results: [], finished: false, champion: null, eliminated: {} }
}

// Straight knockout. entrants are in seed order when seeded (unseeded ones should already be shuffled).
export function createKnockout(size, entrants, { seeded = false, rng = Math.random } = {}) {
  const list = seeded ? entrants.slice(0, size) : shuffle(entrants, rng).slice(0, size)
  const slots = seedOrder(size).map((seed) => list[seed - 1] ?? null)
  const t = base('knockout', Math.log2(size))
  const pairs = []
  for (let i = 0; i < size; i += 2) pairs.push([slots[i], slots[i + 1]])
  t.rounds.push(pairs)
  return t
}

// Staged entry with an open draw each round (UK Open). joins[r] enter at round r.
export function createStaged(joins, totalRounds, rng = Math.random) {
  const t = base('staged', totalRounds)
  t.joins = joins
  t.rounds.push(pairUp(shuffle(joins[0], rng)))
  return t
}

// Round-robin groups, then a knockout. koRounds is the number of knockout rounds.
export function createGroups(groups, { advance = 2, koRounds, seedsToKo = [] } = {}) {
  const size = groups[0].length
  const matchdays = size === 4 ? 3 : 3
  const t = base('groups', matchdays + koRounds)
  t.groups = groups
  t.groupMatchdays = matchdays
  t.advance = advance
  t.seedsToKo = seedsToKo
  t.table = {}
  for (const g of groups) for (const id of g) t.table[id] = { played: 0, won: 0, points: 0, legsFor: 0, legsAgainst: 0, avg: 0 }
  t.rounds.push(groupMatchday(t, 0))
  return t
}

const RR = {
  4: [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]],
  3: [[[0, 1]], [[0, 2]], [[1, 2]]],
}

function groupMatchday(t, md) {
  const pairs = []
  for (const g of t.groups) for (const [i, j] of RR[g.length][md]) pairs.push([g[i], g[j]])
  return pairs
}

function pairUp(list) {
  const pairs = []
  for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1] ?? null])
  return pairs
}

export function standings(t, group) {
  return [...group].sort((a, b) => {
    const x = t.table[a]
    const y = t.table[b]
    return y.points - x.points || y.legsFor - y.legsAgainst - (x.legsFor - x.legsAgainst) || y.legsFor - x.legsFor || y.avg - x.avg
  })
}

export function findPair(t, id) {
  if (t.finished) return null
  const pairs = t.rounds[t.round]
  const i = pairs.findIndex((p) => p.includes(id))
  if (i < 0) return null
  return { index: i, pair: pairs[i], opponent: pairs[i][0] === id ? pairs[i][1] : pairs[i][0] }
}

// play(a, b) -> { winner (0|1), score:[a,b], legs:[a,b], averages:[a,b], ... }
export function resolveRound(t, play, rng = Math.random) {
  const results = []
  const winners = []
  const inGroups = t.round < (t.groupMatchdays ?? 0)
  for (const [a, b] of t.rounds[t.round]) {
    if (a === null && b === null) {
      winners.push(null)
      continue
    }
    if (a === null || b === null) {
      winners.push(a ?? b)
      results.push({ a, b, winner: a ?? b, bye: true })
      continue
    }
    const r = play(a, b)
    const winner = r.winner === 0 ? a : b
    results.push({ ...r, a, b, winner })
    winners.push(winner)
    if (inGroups) {
      const legs = r.legs ?? r.score
      for (const [id, i] of [[a, 0], [b, 1]]) {
        const row = t.table[id]
        row.played++
        row.legsFor += legs[i]
        row.legsAgainst += legs[1 - i]
        row.avg = (row.avg * (row.played - 1) + (r.averages?.[i] ?? 0)) / row.played
        if (winner === id) {
          row.won++
          row.points += 2
        }
      }
    } else {
      t.eliminated[winner === a ? b : a] = t.round
    }
  }
  t.results[t.round] = results

  if (inGroups) {
    t.round++
    if (t.round < t.groupMatchdays) {
      t.rounds.push(groupMatchday(t, t.round))
      return t
    }
    // Group stage over: work out who goes through.
    const ordered = t.groups.map((g) => standings(t, g))
    t.groupFinish = {}
    ordered.forEach((g) => g.forEach((id, pos) => { t.groupFinish[id] = pos + 1 }))
    for (const g of ordered) for (const id of g.slice(t.advance)) t.eliminated[id] = 'group'
    t.rounds.push(koDraw(t, ordered, rng))
    return t
  }

  if (winners.length === 1) {
    t.finished = true
    t.champion = winners[0]
    return t
  }
  t.round++
  const joiners = t.joins?.[t.round]
  t.rounds.push(joiners ? pairUp(interleave(shuffle(winners.filter(Boolean), rng), shuffle(joiners, rng))) : pairUp(winners))
  return t
}

function interleave(a, b) {
  const out = []
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

function koDraw(t, ordered, rng) {
  if (t.seedsToKo.length) {
    // World Cup: the four seeded teams meet group winners; other winners meet each other.
    const winners = shuffle(ordered.map((g) => g[0]), rng)
    const seeds = t.seedsToKo
    const slots = [seeds[0], winners[0], winners[1], winners[2], seeds[3], winners[3], winners[4], winners[5], seeds[1], winners[6], winners[7], winners[8], seeds[2], winners[9], winners[10], winners[11]]
    return pairUp(slots)
  }
  // Grand Slam: A1 v B2, C1 v D2 ... top half; B1 v A2, D1 v C2 ... bottom half.
  const pairs = []
  for (let g = 0; g < ordered.length; g += 2) pairs.push([ordered[g][0], ordered[g + 1][1]])
  for (let g = 0; g < ordered.length; g += 2) pairs.push([ordered[g + 1][0], ordered[g][1]])
  return pairs
}

// stage 0 = winner, 1 = runner-up, 2 = semi-finalist... Group exits return 'group'.
export function stageFor(t, id) {
  if (t.champion === id) return 0
  if (!(id in t.eliminated)) return null
  const r = t.eliminated[id]
  if (r === 'group') return 'group'
  return t.totalRounds - r
}

export function roundsWon(t, id) {
  if (t.champion === id) return t.totalRounds
  let wins = 0
  for (const results of t.results) for (const r of results ?? []) if (r.winner === id && !r.bye) wins++
  return wins
}

export function participants(t) {
  const set = new Set()
  for (const pairs of t.rounds) for (const p of pairs) for (const id of p) if (id) set.add(id)
  for (const j of t.joins ?? []) for (const id of j) set.add(id)
  return [...set]
}
