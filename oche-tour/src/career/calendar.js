// The season calendar. Formats are the full-length "first to N legs" per round;
// the match-length setting scales them down so a session fits an evening.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Prize money by finishing position: [winner, runner-up, semi, quarter, L16, L32, L64, L128]
const PRIZES = {
  qschool: [0, 0, 0, 0, 0, 0, 0, 0],
  pc: [15000, 10000, 5000, 3500, 2500, 1500, 1000, 0],
  ct: [5000, 3000, 2000, 1000, 500, 250, 0, 0],
  open: [110000, 50000, 25000, 15000, 10000, 6000, 3500, 1500],
  et: [30000, 12000, 8500, 6000, 4000, 2500, 1250, 0],
  matchplay: [800000, 400000, 200000, 100000, 50000, 25000],
  grandprix: [120000, 60000, 40000, 25000, 15000, 10000],
  grandslam: [150000, 70000, 50000, 25000, 15000, 10000],
  finals: [120000, 60000, 30000, 20000, 12500, 7500, 4000],
  worlds: [500000, 200000, 100000, 50000, 35000, 25000, 15000],
}

const TEMPLATES = {
  qschool: { tour: 'qschool', tier: 0, size: 128, entry: { type: 'qschool' }, legs: [5, 5, 5, 5, 5, 5, 5], prizes: PRIZES.qschool },
  pc: { tour: 'pro', tier: 1, size: 128, entry: { type: 'tour' }, legs: [6, 6, 6, 6, 6, 6, 6], prizes: PRIZES.pc },
  ct: { tour: 'challenge', tier: 0, size: 128, entry: { type: 'challenge' }, legs: [5, 5, 5, 5, 5, 5, 5], prizes: PRIZES.ct },
  open: { tour: 'pro', tier: 2, size: 128, entry: { type: 'open' }, legs: [6, 6, 6, 10, 10, 10, 11], prizes: PRIZES.open },
  et: { tour: 'pro', tier: 2, size: 64, entry: { type: 'seededQualifier', seeds: 32 }, legs: [6, 6, 6, 7, 7, 8], prizes: PRIZES.et, seeded: true },
  matchplay: { tour: 'pro', tier: 3, size: 32, entry: { type: 'top', n: 32 }, legs: [10, 11, 13, 17, 18], prizes: PRIZES.matchplay, seeded: true },
  grandprix: { tour: 'pro', tier: 3, size: 32, entry: { type: 'top', n: 32 }, legs: [3, 3, 3, 3, 3], sets: [2, 3, 3, 4, 5], prizes: PRIZES.grandprix, seeded: true },
  grandslam: { tour: 'pro', tier: 3, size: 32, entry: { type: 'top', n: 32 }, legs: [10, 10, 16, 16, 16], prizes: PRIZES.grandslam, seeded: true },
  finals: { tour: 'pro', tier: 3, size: 64, entry: { type: 'top', n: 64 }, legs: [6, 6, 10, 10, 11, 11], prizes: PRIZES.finals, seeded: true },
  worlds: { tour: 'pro', tier: 4, size: 64, entry: { type: 'worlds' }, legs: [3, 3, 3, 3, 3, 3], sets: [3, 3, 4, 5, 6, 7], prizes: PRIZES.worlds, seeded: true },
}

// [month index, template, display name]
const SCHEDULE = [
  [0, 'qschool', 'Q-School Day 1'],
  [0, 'qschool', 'Q-School Day 2'],
  [0, 'qschool', 'Q-School Day 3'],
  [0, 'qschool', 'Q-School Day 4'],
  [1, 'pc', 'Players Championship 1'],
  [1, 'ct', 'Challenge Tour 1'],
  [1, 'pc', 'Players Championship 2'],
  [1, 'ct', 'Challenge Tour 2'],
  [2, 'open', 'The Open'],
  [2, 'pc', 'Players Championship 3'],
  [2, 'ct', 'Challenge Tour 3'],
  [2, 'pc', 'Players Championship 4'],
  [2, 'ct', 'Challenge Tour 4'],
  [3, 'et', 'European Tour: Dutch Masters'],
  [3, 'pc', 'Players Championship 5'],
  [3, 'ct', 'Challenge Tour 5'],
  [3, 'pc', 'Players Championship 6'],
  [3, 'ct', 'Challenge Tour 6'],
  [4, 'et', 'European Tour: German Darts Open'],
  [4, 'pc', 'Players Championship 7'],
  [4, 'ct', 'Challenge Tour 7'],
  [4, 'pc', 'Players Championship 8'],
  [4, 'ct', 'Challenge Tour 8'],
  [5, 'pc', 'Players Championship 9'],
  [5, 'ct', 'Challenge Tour 9'],
  [5, 'pc', 'Players Championship 10'],
  [5, 'ct', 'Challenge Tour 10'],
  [6, 'matchplay', 'World Matchplay'],
  [6, 'ct', 'Challenge Tour 11'],
  [6, 'ct', 'Challenge Tour 12'],
  [7, 'et', 'European Tour: Baltic Classic'],
  [7, 'pc', 'Players Championship 11'],
  [7, 'ct', 'Challenge Tour 13'],
  [7, 'pc', 'Players Championship 12'],
  [7, 'ct', 'Challenge Tour 14'],
  [8, 'pc', 'Players Championship 13'],
  [8, 'ct', 'Challenge Tour 15'],
  [8, 'pc', 'Players Championship 14'],
  [8, 'ct', 'Challenge Tour 16'],
  [9, 'grandprix', 'World Grand Prix'],
  [9, 'ct', 'Challenge Tour 17'],
  [9, 'ct', 'Challenge Tour 18'],
  [10, 'grandslam', 'Grand Slam'],
  [10, 'finals', 'Players Championship Finals'],
  [11, 'worlds', 'World Championship'],
]

export function buildCalendar(year) {
  return SCHEDULE.map(([month, key, name], i) => ({
    id: `${year}-${i}`,
    year,
    month,
    key,
    name,
    qschoolDay: key === 'qschool' ? Number(name.slice(-1)) : null,
    ...TEMPLATES[key],
  }))
}

export const MATCH_LENGTHS = {
  quick: { label: 'Quick (about a third of real length)', legs: 0.34, sets: 0.4, setLegs: 2 },
  standard: { label: 'Standard (about half)', legs: 0.55, sets: 0.6, setLegs: 3 },
  full: { label: 'Full tour length', legs: 1, sets: 1, setLegs: 3 },
}

export function roundFormat(event, round, matchLength = 'quick') {
  const scale = MATCH_LENGTHS[matchLength] ?? MATCH_LENGTHS.quick
  const idx = Math.min(round, event.legs.length - 1)
  if (event.sets) {
    return { sets: Math.max(1, Math.round(event.sets[idx] * scale.sets)), legs: scale.setLegs }
  }
  return { sets: 0, legs: Math.max(1, Math.round(event.legs[idx] * scale.legs)) }
}

export function qualifierFormat(matchLength = 'quick') {
  const scale = MATCH_LENGTHS[matchLength] ?? MATCH_LENGTHS.quick
  return { sets: 0, legs: Math.max(1, Math.round(6 * scale.legs)) }
}

export function formatLabel(format) {
  if (format.sets) return `First to ${format.sets} set${format.sets > 1 ? 's' : ''} (sets first to ${format.legs} legs)`
  return `First to ${format.legs} leg${format.legs > 1 ? 's' : ''}`
}

export function roundName(size, round) {
  const left = size / 2 ** round
  if (left === 2) return 'Final'
  if (left === 4) return 'Semi-Finals'
  if (left === 8) return 'Quarter-Finals'
  return `Last ${left}`
}

export function prizeFund(event) {
  let total = 0
  const rounds = Math.log2(event.size)
  for (let stage = 0; stage <= rounds; stage++) {
    const count = stage === 0 ? 1 : 2 ** (stage - 1)
    total += (event.prizes[stage] ?? 0) * count
  }
  return total
}
