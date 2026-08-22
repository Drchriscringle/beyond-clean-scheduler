// A flavour trait picked once at player generation, wired into a handful of
// existing per-player multipliers (injury chance, card chance, morale swing,
// form variance) rather than any new mechanic of its own.
export const PERSONALITIES = {
  balanced: { label: 'Balanced', description: 'Even-tempered - no particular strengths or weaknesses off the pitch.' },
  'model-professional': { label: 'Model Professional', description: 'Rarely rattled - takes good and bad results in stride.' },
  temperamental: { label: 'Temperamental', description: 'Prone to rash challenges, and results affect the mood more than most.' },
  'injury-prone': { label: 'Injury-Prone', description: 'A recurring niggle - picks up knocks more often than most.' },
  inconsistent: { label: 'Inconsistent', description: 'Capable of brilliance or an off day - form swings further than most.' },
  leader: { label: 'Leader', description: 'Lifts the dressing room when wearing the captain’s armband.' },
}

const WEIGHTS = { balanced: 45, 'model-professional': 11, temperamental: 11, 'injury-prone': 11, inconsistent: 11, leader: 11 }

export function pickPersonality(rng = Math.random) {
  const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    roll -= weight
    if (roll <= 0) return key
  }
  return 'balanced'
}

export function moraleSwingMultiplier(personality) {
  if (personality === 'model-professional') return 0.6
  if (personality === 'temperamental') return 1.5
  return 1
}

export function injuryChanceMultiplier(personality) {
  return personality === 'injury-prone' ? 1.6 : 1
}

export function cardChanceMultiplier(personality) {
  return personality === 'temperamental' ? 1.5 : 1
}

export function formVarianceMultiplier(personality) {
  return personality === 'inconsistent' ? 1.5 : 1
}

export function isLeader(personality) {
  return personality === 'leader'
}
