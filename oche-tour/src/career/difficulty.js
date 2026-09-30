// How hard is the opponent in front of you?
//
// AI ratings live on a "pro scale" (roughly real tour averages). The difficulty
// setting decides where *you* sit on that scale; opponents are then rescaled to
// your actual standard. So on Normal, a Challenge Tour grinder is usually a bit
// weaker than you, a mid-ranked tour pro is about level, and the elite are better.
// On top of that every opponent gets a random form swing, and gets sharper the
// deeper you go into an event and the bigger the event.
import { gaussian } from '../engine/rng.js'

export const DIFFICULTIES = {
  easy: { label: 'Easy', proRating: 97, blurb: 'Relative to the field you are a top-25 pro' },
  normal: { label: 'Normal', proRating: 92, blurb: 'Relative to the field you are a top-50 pro: keeping your card is a fight' },
  hard: { label: 'Hard', proRating: 87, blurb: 'Relative to the field you are a fringe card holder' },
  brutal: { label: 'Brutal', proRating: 81, blurb: 'Even the Challenge Tour will test you' },
  realistic: { label: 'Real averages', proRating: null, blurb: 'No scaling: opponents throw genuine tour-level averages' },
}

export const SKILL_PRESETS = [
  { label: 'Beginner', avg: 30 },
  { label: 'Pub player', avg: 42 },
  { label: 'League player', avg: 52 },
  { label: 'Strong league / county', avg: 62 },
  { label: 'Semi-pro', avg: 75 },
  { label: 'Pro standard', avg: 90 },
]

function setting(career) {
  return DIFFICULTIES[career.user.difficulty] ?? DIFFICULTIES.normal
}

// Your standard on the pro scale (used when your own matches are auto-simulated).
export function userProRating(career) {
  return setting(career).proRating ?? career.user.avg
}

export function scaleFactor(career) {
  const d = setting(career)
  return d.proRating ? career.user.avg / d.proRating : 1
}

export function pressureBoost(round, tier) {
  return round * 0.7 + tier * 0.6
}

const clamp = (v) => Math.max(12, Math.min(118, v))

export function opponentAverages(career, rating, { round = 0, tier = 0 } = {}, rng = Math.random) {
  const f = scaleFactor(career)
  const base = rating + pressureBoost(round, tier)
  return {
    expected: Math.round(clamp(base * f) * 10) / 10,
    actual: Math.round(clamp((base + gaussian(rng) * 3.5) * f) * 10) / 10,
  }
}

// Pro-scale averages used for AI-vs-AI simulation.
export function simAverage(career, id, rng = Math.random) {
  const base = id === 'user' ? userProRating(career) : career.players[id].rating
  return base + gaussian(rng) * 3
}
