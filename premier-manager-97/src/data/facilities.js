// Facility upgrade ladders. Level 1 is where every club starts.
// Effects are read by the sim: injuryRate multiplies weekly injury chance,
// developmentRate multiplies youth ability growth per season.

export const PITCH_LEVELS = [
  { level: 1, label: 'Threadbare', cost: 0, injuryRate: 1.25 },
  { level: 2, label: 'Adequate', cost: 250_000, injuryRate: 1.0 },
  { level: 3, label: 'Good', cost: 650_000, injuryRate: 0.85 },
  { level: 4, label: 'Immaculate', cost: 1_400_000, injuryRate: 0.65 },
]

export const TRAINING_LEVELS = [
  { level: 1, label: 'Basic', cost: 0, developmentRate: 0.8, injuryRate: 1.15 },
  { level: 2, label: 'Solid', cost: 500_000, developmentRate: 1.0, injuryRate: 1.0 },
  { level: 3, label: 'Advanced', cost: 1_200_000, developmentRate: 1.25, injuryRate: 0.9 },
  { level: 4, label: 'World Class', cost: 2_800_000, developmentRate: 1.55, injuryRate: 0.75 },
]

export const YOUTH_LEVELS = [
  { level: 1, label: 'Local Schoolboys', cost: 0, developmentRate: 0.75 },
  { level: 2, label: 'Regional Academy', cost: 400_000, developmentRate: 1.0 },
  { level: 3, label: 'Category Two', cost: 1_000_000, developmentRate: 1.3 },
  { level: 4, label: 'Category One', cost: 2_200_000, developmentRate: 1.7 },
]

export function nextLevel(levels, currentLevel) {
  return levels.find((l) => l.level === currentLevel + 1) ?? null
}
