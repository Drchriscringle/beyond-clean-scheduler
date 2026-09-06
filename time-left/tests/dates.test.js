import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addYears,
  addYearsFraction,
  countAnniversaries,
  countWeekdays,
  daysBetween,
  exactAge,
  parseDate,
  toISODate,
} from '../src/lib/dates.js'

test('parseDate accepts real dates and rejects everything else', () => {
  assert.equal(toISODate(parseDate('1980-07-01')), '1980-07-01')
  assert.equal(parseDate('2001-02-29'), null)
  assert.equal(parseDate('1980-7-1'), null)
  assert.equal(parseDate(''), null)
  assert.equal(parseDate(undefined), null)
})

test('exactAge gives the age people actually say', () => {
  assert.deepEqual(exactAge(parseDate('1980-07-01'), parseDate('2026-09-06')), {
    years: 46,
    months: 2,
    days: 5,
  })
})

test('exactAge borrows from the right month at month ends', () => {
  // 31 January plus a month is 29 February in a leap year, so 1 March is one
  // month and one day later - never a negative number of days.
  assert.deepEqual(exactAge(parseDate('2000-01-31'), parseDate('2000-03-01')), {
    years: 0,
    months: 1,
    days: 1,
  })
  // 31 January plus one month clamps to 28 February in a common year, so the
  // leftover days are counted from there.
  assert.deepEqual(exactAge(parseDate('2023-01-31'), parseDate('2023-03-30')), {
    years: 0,
    months: 1,
    days: 30,
  })
})

test('exactAge treats a leap-day birthday as due on 28 February', () => {
  assert.deepEqual(exactAge(parseDate('2000-02-29'), parseDate('2001-02-28')), {
    years: 1,
    months: 0,
    days: 0,
  })
})

test('exactAge is zero for the day you were born and for future dates', () => {
  assert.deepEqual(exactAge(parseDate('2026-09-06'), parseDate('2026-09-06')), {
    years: 0,
    months: 0,
    days: 0,
  })
  assert.deepEqual(exactAge(parseDate('2030-01-01'), parseDate('2026-09-06')), {
    years: 0,
    months: 0,
    days: 0,
  })
})

test('addYears clamps 29 February onto 28 February', () => {
  assert.equal(toISODate(addYears(parseDate('2024-02-29'), 1)), '2025-02-28')
  assert.equal(toISODate(addYears(parseDate('2024-02-29'), 4)), '2028-02-29')
})

test('addYearsFraction walks whole years by calendar and the rest by clock', () => {
  const end = addYearsFraction(parseDate('1980-07-01'), 81.4)
  assert.equal(end.getFullYear(), 2061)
  assert.equal(end.getMonth(), 10)
})

test('daysBetween counts calendar days in both directions', () => {
  assert.equal(daysBetween(parseDate('2026-01-01'), parseDate('2026-12-31')), 364)
  assert.equal(daysBetween(parseDate('2026-12-31'), parseDate('2026-01-01')), -364)
  assert.equal(daysBetween(parseDate('2024-02-28'), parseDate('2024-03-01')), 2)
})

test('countWeekdays counts a weekday in the span ahead, excluding today', () => {
  // 6 September 2026 is a Sunday.
  assert.equal(countWeekdays(parseDate('2026-09-06'), parseDate('2026-10-04'), 6), 4)
  // Starting on the Saturday itself, that Saturday is already under way.
  assert.equal(countWeekdays(parseDate('2026-09-12'), parseDate('2026-09-19'), 6), 1)
  assert.equal(countWeekdays(parseDate('2026-09-06'), parseDate('2026-09-06'), 6), 0)
})

test('countAnniversaries counts fixed dates, and leap days only in leap years', () => {
  assert.equal(countAnniversaries(parseDate('2026-09-06'), parseDate('2029-09-06'), 11, 25), 3)
  assert.equal(countAnniversaries(parseDate('2026-01-01'), parseDate('2036-01-01'), 1, 29), 2)
  assert.equal(countAnniversaries(parseDate('2026-09-06'), parseDate('2026-09-06'), 0, 1), 0)
})
