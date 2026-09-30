// Turns a competition's full-length format into the one actually played, scaled by
// the match-length setting.
import { COMPETITIONS } from './data/competitions.js'

export const MATCH_LENGTHS = {
  quick: { label: 'Quick (about a third of tour length)', legs: 0.34, sets: 0.4, setLegs: 2 },
  standard: { label: 'Standard (about half)', legs: 0.55, sets: 0.6, setLegs: 3 },
  full: { label: 'Full tour length', legs: 1, sets: 1, setLegs: 3 },
}

const scaleOf = (matchLength) => MATCH_LENGTHS[matchLength] ?? MATCH_LENGTHS.quick
const scaled = (n, f) => Math.max(1, Math.round(n * f))

function build(comp, { legs, sets }, scale) {
  const f = sets
    ? { sets: scaled(sets, scale.sets), legs: scale.setLegs }
    : { sets: 0, legs: scaled(legs, scale.legs) }
  if (comp.winBy2 && !sets) {
    f.winBy2 = true
    f.sdAt = f.legs + 2
  }
  if (comp.setTiebreak) f.setTiebreak = true
  if (comp.doubleIn) f.doubleIn = true
  if (comp.pairs) f.pairs = true
  return f
}

// round counts every match the event plays, including group matchdays.
export function roundFormat(eventOrKey, round, matchLength = 'quick', groupMatchdays = 0) {
  const comp = typeof eventOrKey === 'string' ? COMPETITIONS[eventOrKey] : COMPETITIONS[eventOrKey.key]
  const scale = scaleOf(matchLength)
  if (round < groupMatchdays) return build(comp, { legs: comp.groupLegs }, scale)
  const r = round - groupMatchdays
  if (comp.sets) return build(comp, { sets: comp.sets[Math.min(r, comp.sets.length - 1)] }, scale)
  return build(comp, { legs: comp.legs[Math.min(r, comp.legs.length - 1)] }, scale)
}

// Qualifiers: best of 11 legs, or first to 3 sets for the World Masters preliminary round.
export function qualifierFormat(matchLength = 'quick', sets = false) {
  const scale = scaleOf(matchLength)
  return sets ? { sets: scaled(3, scale.sets), legs: scale.setLegs } : { sets: 0, legs: scaled(6, scale.legs) }
}

export function formatLabel(format) {
  const extras = [format.doubleIn && 'double in', format.winBy2 && 'win by two', format.pairs && 'pairs'].filter(Boolean)
  const base = format.sets
    ? `First to ${format.sets} set${format.sets > 1 ? 's' : ''} (sets first to ${format.legs} legs)`
    : `First to ${format.legs} leg${format.legs > 1 ? 's' : ''}`
  return extras.length ? `${base} · ${extras.join(', ')}` : base
}

export function roundName(t, round = t.round) {
  if (round < (t.groupMatchdays ?? 0)) return `Group stage, matchday ${round + 1}`
  const left = 2 ** (t.totalRounds - round)
  if (t.kind === 'staged') return round < t.totalRounds - 4 ? `Round ${round + 1}` : ['Last 16', 'Quarter-Finals', 'Semi-Finals', 'Final'][round - (t.totalRounds - 4)]
  if (left === 2) return 'Final'
  if (left === 4) return 'Semi-Finals'
  if (left === 8) return 'Quarter-Finals'
  return `Last ${left}`
}

// Prize money grows every season (career.prizeScale); round to tidy amounts.
function tidy(x) {
  const step = x < 10000 ? 250 : x < 100000 ? 500 : 5000
  return Math.round(x / step) * step
}

export function scaledPrizes(key, scale = 1) {
  const comp = COMPETITIONS[key]
  const f = (x) => (x ? tidy(x * scale) : 0)
  return {
    prizes: comp.prizes.map(f),
    groupPrizes: comp.groupPrizes ? Object.fromEntries(Object.entries(comp.groupPrizes).map(([k, v]) => [k, f(v)])) : null,
    nightBonus: comp.nightBonus ? f(comp.nightBonus) : 0,
  }
}

export function prizeFund(key, scale = 1) {
  const { prizes, groupPrizes } = scaledPrizes(key, scale)
  if (!prizes.length) return 0
  if (key === 'plPlayoffs') return prizes.reduce((s, x) => s + x, 0)
  if (key === 'grandslam') return prizes.reduce((s, x, i) => s + x * (i === 0 ? 1 : 2 ** (i - 1)), 0) + 8 * (groupPrizes.third + groupPrizes.fourth + groupPrizes.winnerBonus)
  if (key === 'worldcup') return prizes[0] + prizes[1] + 2 * prizes[2] + 4 * prizes[3] + 8 * prizes[4] + 12 * (groupPrizes.second + groupPrizes.third)
  if (key === 'ukopen') return tidy(750000 * scale)
  let total = 0
  prizes.forEach((x, stage) => { total += x * (stage === 0 ? 1 : 2 ** (stage - 1)) })
  return total
}
