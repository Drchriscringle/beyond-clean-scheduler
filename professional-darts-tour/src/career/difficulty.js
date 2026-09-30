// How good is the opponent standing next to you?
//
// Three modes, switchable any time in Settings:
//   range        opponents throw a random average inside the range you choose (say 30–50),
//                from the lower part early in an event to the upper part in the final
//   progressive  realistic tour averages: a random average from the band for that level of
//                event, which climbs as you go deeper. Better-ranked players sit higher.
//   fixed        every opponent throws close to the average you choose
import { gaussian } from '../engine/rng.js'

// [early rounds, semi-finals and final] as [low, high] 3-dart averages.
export const LEVEL_BANDS = {
  dev: { label: 'Q-School, Challenge & Development Tour', early: [60, 75], late: [75, 90] },
  pro: { label: 'Players Championships, European Tour, UK Open', early: [72, 86], late: [86, 98] },
  major: { label: 'Majors & invitationals', early: [84, 95], late: [94, 105] },
  worlds: { label: 'World Championship', early: [84, 96], late: [96, 108] },
}

export const DIFFICULTY_MODES = {
  range: 'My own range: random averages between two numbers I choose, harder as I progress',
  progressive: 'Realistic tour averages that get harder as I progress',
  fixed: 'Every opponent throws one average I choose',
}

// A sensible starting range around the player's own average.
export function suggestedRange(avg) {
  const lo = Math.max(15, Math.round(avg - 10))
  return [lo, Math.min(120, lo + 20)]
}

// Your range split into early rounds (lower part) and the final (upper part).
export function rangeBands(min, max) {
  const span = Math.max(0, max - min)
  return { early: [min, min + span * 0.65], late: [min + span * 0.35, max] }
}

export const SKILL_PRESETS = [
  { label: 'Beginner', avg: 30 },
  { label: 'Pub player', avg: 42 },
  { label: 'League player', avg: 52 },
  { label: 'County standard', avg: 62 },
  { label: 'Semi-pro', avg: 75 },
  { label: 'Pro standard', avg: 90 },
]

const lerp = (a, b, t) => a + (b - a) * t
const round1 = (x) => Math.round(x * 10) / 10

// progress: 0 for the first match of an event, 1 for the final.
export function bandFor(level, progress) {
  const b = LEVEL_BANDS[level] ?? LEVEL_BANDS.pro
  const t = Math.max(0, Math.min(1, progress))
  return [lerp(b.early[0], b.late[0], t), lerp(b.early[1], b.late[1], t)]
}

// Where a player of this rating sits in a level's overall range (0–1).
function standing(level, rating) {
  const b = LEVEL_BANDS[level] ?? LEVEL_BANDS.pro
  return Math.max(0, Math.min(1, (rating - b.early[0]) / (b.late[1] - b.early[0])))
}

export function opponentAverage(career, rating, { level = 'pro', progress = 0 } = {}, rng = Math.random) {
  const d = career.user.difficulty
  if (d.mode === 'fixed') {
    return { expected: round1(d.fixedAvg), actual: round1(Math.max(15, d.fixedAvg + gaussian(rng) * 1.5)) }
  }
  let lo
  let hi
  let s
  if (d.mode === 'range') {
    const b = rangeBands(Math.min(d.rangeMin, d.rangeMax), Math.max(d.rangeMin, d.rangeMax))
    const t = Math.max(0, Math.min(1, progress))
    lo = lerp(b.early[0], b.late[0], t)
    hi = lerp(b.early[1], b.late[1], t)
    // Better-ranked players still sit a little higher in your range.
    s = standing(level, rating)
  } else {
    ;[lo, hi] = bandFor(level, progress)
    s = standing(level, rating)
  }
  const expected = lo + (hi - lo) * (0.25 + 0.5 * s)
  const actual = lo + (hi - lo) * (0.55 * rng() + 0.45 * s)
  return { expected: round1(expected), actual: round1(actual) }
}

// Averages used when AI players meet each other (and when your match is auto-simmed).
export function simAverage(career, id, rng = Math.random) {
  const base = id === 'user' ? career.user.avg : career.players[id].rating
  return base + gaussian(rng) * 3
}
