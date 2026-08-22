// A simple three-level difficulty dial chosen at new-game time. It scales a
// handful of existing knobs rather than introducing new systems: how strong
// AI-controlled squads are relative to yours, and how patient your board is.
export const DIFFICULTIES = ['easy', 'normal', 'hard']

const LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }
const AI_ABILITY_MULTIPLIER = { easy: 0.94, normal: 1, hard: 1.06 }
const SACK_CONFIDENCE_THRESHOLD = { easy: 3, normal: 5, hard: 7 }
const OBJECTIVE_FAIL_STREAK_LIMIT = { easy: 3, normal: 2, hard: 1 }

export function difficultyLabel(difficulty) {
  return LABELS[difficulty] ?? LABELS.normal
}

export function aiAbilityMultiplier(difficulty) {
  return AI_ABILITY_MULTIPLIER[difficulty] ?? AI_ABILITY_MULTIPLIER.normal
}

export function sackConfidenceThreshold(difficulty) {
  return SACK_CONFIDENCE_THRESHOLD[difficulty] ?? SACK_CONFIDENCE_THRESHOLD.normal
}

export function objectiveFailStreakLimit(difficulty) {
  return OBJECTIVE_FAIL_STREAK_LIMIT[difficulty] ?? OBJECTIVE_FAIL_STREAK_LIMIT.normal
}
