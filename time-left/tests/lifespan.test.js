import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDate } from '../src/lib/dates.js'
import {
  MAX_FACTOR_SWING,
  buildLifeTable,
  estimate,
  factorAdjustment,
  lifeLivedFraction,
} from '../src/lib/lifespan.js'

const NOW = new Date(2026, 8, 6)

test('the fitted life table reproduces the life expectancy it was built from', () => {
  for (const e0 of [55, 66, 72.5, 79.3, 81.4, 84.7]) {
    const table = buildLifeTable(e0)
    assert.ok(
      Math.abs(table.remainingAt(0) - e0) < 0.05,
      `expected e(0) close to ${e0}, got ${table.remainingAt(0)}`,
    )
  }
})

test('having survived to middle age buys you more than the average at birth', () => {
  const table = buildLifeTable(81.4)
  const expectedAgeAtDeath = 46 + table.remainingAt(46)
  assert.ok(expectedAgeAtDeath > 81.4, 'surviving to 46 should raise the expected age at death')
  assert.ok(expectedAgeAtDeath < 90, 'but not by an implausible amount')
})

test('remaining years fall with age while total expected age rises', () => {
  const table = buildLifeTable(79.3)
  let previousRemaining = Infinity
  let previousTotal = 0
  for (const age of [0, 20, 40, 60, 80, 95]) {
    const remaining = table.remainingAt(age)
    assert.ok(remaining < previousRemaining, `remaining should fall by age ${age}`)
    assert.ok(age + remaining > previousTotal, `expected age at death should rise by ${age}`)
    previousRemaining = remaining
    previousTotal = age + remaining
  }
})

test('survivors thin out with age', () => {
  const table = buildLifeTable(81.4)
  assert.ok(table.survivorsAt(20) > 0.97)
  assert.ok(table.survivorsAt(65) < table.survivorsAt(46))
  assert.ok(table.survivorsAt(100) < 0.1)
})

test('straight subtraction is exactly life expectancy minus age', () => {
  const result = estimate({
    birth: parseDate('1980-07-01'),
    now: NOW,
    lifeExpectancyAtBirth: 81.4,
    mode: 'simple',
  })
  assert.ok(Math.abs(result.age + result.remainingYears - 81.4) < 1e-9)
  assert.equal(result.overdue, false)
  assert.equal(result.endDate.getFullYear(), 2061)
})

test('the adjusted mode leaves more time than straight subtraction at the same age', () => {
  const shared = { birth: parseDate('1980-07-01'), now: NOW, lifeExpectancyAtBirth: 81.4 }
  const simple = estimate({ ...shared, mode: 'simple' })
  const survival = estimate({ ...shared, mode: 'survival' })
  assert.ok(survival.remainingYears > simple.remainingYears)
})

test('someone past the average counts up, and still gets a usable horizon', () => {
  const result = estimate({
    birth: parseDate('1930-07-01'),
    now: NOW,
    lifeExpectancyAtBirth: 81.4,
    mode: 'simple',
  })
  assert.equal(result.overdue, true)
  assert.ok(result.bonusYears > 14 && result.bonusYears < 16)
  assert.ok(result.remainingYears > 0, 'the countdown still needs somewhere to point')
  assert.ok(result.endDate > NOW)
  assert.ok(result.endDateFromBirth < NOW, 'straight subtraction ran out in the past')
})

test('life factors move the estimate and are capped both ways', () => {
  const shared = { birth: parseDate('1980-07-01'), now: NOW, lifeExpectancyAtBirth: 81.4 }
  const plain = estimate({ ...shared, mode: 'simple' })
  const smoker = estimate({ ...shared, mode: 'simple', factorYears: -10 })
  assert.ok(smoker.remainingYears < plain.remainingYears - 9.9)

  const everythingBad = factorAdjustment({
    smoking: 'current',
    exercise: 'little',
    diet: 'poor',
    alcohol: 'heavy',
    weight: 'obese',
    sleep: 'short',
    company: 'isolated',
  })
  assert.equal(everythingBad.years, -MAX_FACTOR_SWING)

  const nothingChosen = factorAdjustment({})
  assert.equal(nothingChosen.years, 0)
  assert.deepEqual(nothingChosen.applied, [])

  const mixed = factorAdjustment({ smoking: 'never', exercise: 'regular', sleep: 'good' })
  assert.equal(mixed.years, 5)
  assert.equal(mixed.applied.length, 2, 'choices worth zero years are not listed')
})

test('the countdown never runs to zero or below', () => {
  const result = estimate({
    birth: parseDate('1926-01-01'),
    now: NOW,
    lifeExpectancyAtBirth: 60,
    mode: 'survival',
    factorYears: -12,
  })
  assert.ok(result.remainingYears >= 0.25)
  assert.ok(result.remainingMs > 0)
})

test('lifeLivedFraction stays inside 0 and 1', () => {
  assert.ok(Math.abs(lifeLivedFraction({ age: 40, expectancyYears: 80 }) - 0.5) < 1e-9)
  assert.equal(lifeLivedFraction({ age: 90, expectancyYears: 80 }), 1)
  assert.equal(lifeLivedFraction({ age: 10, expectancyYears: 0 }), 1)
})
