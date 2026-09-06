import { MS_PER_YEAR, addYearsFraction, ageInYears } from './dates.js'

export const SEXES = [
  { id: 'both', label: 'Rather not say', hint: 'Uses the figure for everyone' },
  { id: 'female', label: 'Female', hint: 'Uses the female figure' },
  { id: 'male', label: 'Male', hint: 'Uses the male figure' },
]

export const MODES = [
  {
    id: 'simple',
    label: 'Straight subtraction',
    blurb: 'Life expectancy at birth minus your age today. Simple, and what most people mean.',
  },
  {
    id: 'survival',
    label: 'Adjusted for having got this far',
    blurb:
      'Averages at birth are dragged down by people who died young. Since you did not, this reruns the sum over the years you have left rather than the years you started with.',
  },
]

/**
 * Rough, population-level modifiers, in years, drawn from the broad findings of
 * long-running cohort studies. They are averages over large groups of people,
 * they overlap with each other, and none of them knows anything about you.
 */
export const LIFE_FACTORS = [
  {
    id: 'smoking',
    label: 'Smoking',
    options: [
      { id: 'never', label: 'Never smoked', years: 0 },
      { id: 'former', label: 'Quit', years: -2 },
      { id: 'current', label: 'Smoke now', years: -10 },
    ],
  },
  {
    id: 'exercise',
    label: 'Exercise',
    options: [
      { id: 'little', label: 'Rarely', years: -1 },
      { id: 'some', label: 'A bit', years: 1 },
      { id: 'regular', label: '150+ min a week', years: 3.5 },
    ],
  },
  {
    id: 'diet',
    label: 'Diet',
    options: [
      { id: 'poor', label: 'Mostly processed', years: -2 },
      { id: 'mixed', label: 'Mixed', years: 0 },
      { id: 'good', label: 'Mostly whole foods', years: 2.5 },
    ],
  },
  {
    id: 'alcohol',
    label: 'Alcohol',
    options: [
      { id: 'none', label: 'None or rarely', years: 0.5 },
      { id: 'moderate', label: 'Moderate', years: 0 },
      { id: 'heavy', label: 'Heavy', years: -3 },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    options: [
      { id: 'healthy', label: 'Healthy range', years: 0.5 },
      { id: 'over', label: 'Overweight', years: -1 },
      { id: 'obese', label: 'Obese', years: -4 },
    ],
  },
  {
    id: 'sleep',
    label: 'Sleep',
    options: [
      { id: 'short', label: 'Under 6 hours', years: -1.5 },
      { id: 'ok', label: '6-7 hours', years: 0 },
      { id: 'good', label: '7-8 hours', years: 1.5 },
    ],
  },
  {
    id: 'company',
    label: 'People around you',
    options: [
      { id: 'isolated', label: 'Often lonely', years: -2.5 },
      { id: 'some', label: 'Some close ties', years: 0 },
      { id: 'connected', label: 'Strong close ties', years: 2.5 },
    ],
  },
]

/** No single answer sheet should be able to swing the estimate more than this. */
export const MAX_FACTOR_SWING = 12

export function factorAdjustment(choices = {}) {
  let total = 0
  const applied = []
  for (const factor of LIFE_FACTORS) {
    const chosen = factor.options.find((option) => option.id === choices[factor.id])
    if (!chosen || chosen.years === 0) continue
    total += chosen.years
    applied.push({ factor: factor.label, choice: chosen.label, years: chosen.years })
  }
  return {
    years: Math.max(-MAX_FACTOR_SWING, Math.min(MAX_FACTOR_SWING, total)),
    applied,
  }
}

const GOMPERTZ_SLOPE = 0.085 // How fast the risk of dying doubles with age.
const MAX_AGE = 125
const STEP = 0.05

/**
 * A crude life table built from a single number.
 *
 * Deaths are split into two parts: a lump of child mortality, sized from how low
 * the region's life expectancy is, and a Gompertz curve for everyone who makes
 * it past five. The curve's level is then solved for until the whole table
 * reproduces the life expectancy at birth we started with. It is a caricature of
 * a real life table, but it has the property that matters here: it knows that
 * surviving to 46 in a country with a low average is itself informative.
 */
export function buildLifeTable(lifeExpectancyAtBirth) {
  const e0 = Math.max(20, Math.min(110, lifeExpectancyAtBirth))
  const childDeaths = Math.max(0.003, Math.min(0.2, (82 - e0) * 0.0033))

  const survivalWith = (level) => (age) => {
    if (age <= 0) return 1
    if (age < 5) return 1 - childDeaths * (age / 5)
    const cumulative =
      (level / GOMPERTZ_SLOPE) * (Math.exp(GOMPERTZ_SLOPE * age) - Math.exp(GOMPERTZ_SLOPE * 5))
    return (1 - childDeaths) * Math.exp(-cumulative)
  }

  // Trapezoidal area under the survival curve is life expectancy at birth.
  const expectancyFor = (survival) => {
    let area = 0
    let previous = survival(0)
    for (let age = STEP; age <= MAX_AGE; age += STEP) {
      const current = survival(age)
      area += ((previous + current) / 2) * STEP
      previous = current
    }
    return area
  }

  let low = 1e-7
  let high = 0.01
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2
    // More mortality means less area, so the search runs downhill.
    if (expectancyFor(survivalWith(mid)) > e0) low = mid
    else high = mid
  }
  const survival = survivalWith((low + high) / 2)

  return {
    lifeExpectancyAtBirth: e0,
    survival,
    /** Expected years still to come for someone alive at `age`. */
    remainingAt(age) {
      const start = Math.max(0, Math.min(MAX_AGE - STEP, age))
      const alive = survival(start)
      if (alive <= 1e-9) return 0.5
      let area = 0
      let previous = alive
      for (let x = start + STEP; x <= MAX_AGE; x += STEP) {
        const current = survival(x)
        area += ((previous + current) / 2) * STEP
        previous = current
      }
      return area / alive
    },
    /** Share of people born alongside you who are still here at `age`. */
    survivorsAt(age) {
      return survival(Math.max(0, age))
    },
  }
}

const tableCache = new Map()

export function lifeTableFor(lifeExpectancyAtBirth) {
  const key = Math.round(lifeExpectancyAtBirth * 100)
  let table = tableCache.get(key)
  if (!table) {
    table = buildLifeTable(lifeExpectancyAtBirth)
    tableCache.set(key, table)
  }
  return table
}

/** The floor on a countdown, so nobody is told they have three days left. */
const MIN_REMAINING_YEARS = 0.25

/**
 * Turns a birth date and a life expectancy into an end date to count down to.
 *
 * When straight subtraction has already run out - you are older than the
 * average - `overdue` is set, the clock counts up through the time the averages
 * never promised you, and the horizon used for everything else falls back to
 * the survival model, which always has years left to give.
 */
export function estimate({ birth, now, lifeExpectancyAtBirth, mode = 'simple', factorYears = 0 }) {
  const baseExpectancy = lifeExpectancyAtBirth + factorYears
  const age = ageInYears(birth, now)
  const table = lifeTableFor(lifeExpectancyAtBirth)

  const rawRemaining =
    mode === 'survival' ? table.remainingAt(age) + factorYears : baseExpectancy - age
  const overdue = mode === 'simple' && rawRemaining <= 0

  const remainingYears = overdue
    ? Math.max(MIN_REMAINING_YEARS, table.remainingAt(age) + factorYears)
    : Math.max(MIN_REMAINING_YEARS, rawRemaining)
  const endDate = new Date(now.getTime() + remainingYears * MS_PER_YEAR)

  return {
    age,
    mode,
    overdue,
    /** Years already lived past the estimate, for the count-up. Zero unless overdue. */
    bonusYears: overdue ? -rawRemaining : 0,
    expectancyYears: age + remainingYears,
    remainingYears,
    remainingMs: endDate.getTime() - now.getTime(),
    endDate,
    baseExpectancy,
    /** Share of the people born alongside you who are still here. */
    survivorsShare: table.survivorsAt(age),
    /** Where straight subtraction puts the finish line, past or future. */
    endDateFromBirth: addYearsFraction(birth, Math.max(0, baseExpectancy)),
  }
}

/** Fraction of the whole estimated life already spent, clamped to 0-1. */
export function lifeLivedFraction({ age, expectancyYears }) {
  if (!expectancyYears || expectancyYears <= 0) return 1
  return Math.max(0, Math.min(1, age / expectancyYears))
}
