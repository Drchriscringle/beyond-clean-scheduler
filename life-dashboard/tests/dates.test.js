import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, addMonths, addYears, daysBetween, eachDay, formatDay,
  isDayKey, isWeekend, relativeDay, today, weekday,
} from '../server/lib/dates.js'

test('day keys are validated, not trusted', () => {
  assert.equal(isDayKey('2026-09-13'), true)
  assert.equal(isDayKey('2026-9-13'), false)
  assert.equal(isDayKey(new Date()), false)
})

test('adding days crosses months and years', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('a leap day is a real day', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29')
})

test('adding months clamps to the end of a shorter month', () => {
  // A direct debit on the 31st comes out on the 28th in February — it does not
  // slide into March.
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-01-31', 3), '2026-04-30')
  assert.equal(addMonths('2026-08-15', 1), '2026-09-15')
})

test('clamping does not stick — the next month recovers the original day', () => {
  // The day of the month is carried from the anchor date, so a February clamp
  // is not permanent.
  let day = '2026-01-31'
  assert.equal(addMonths(day, 1), '2026-02-28')
  assert.equal(addMonths(day, 2), '2026-03-31')
})

test('adding a year lands on the same date', () => {
  assert.equal(addYears('2026-09-13', 1), '2027-09-13')
  assert.equal(addYears('2028-02-29', 1), '2029-02-28')
})

test('days between counts whole days in both directions', () => {
  assert.equal(daysBetween('2026-09-13', '2026-09-20'), 7)
  assert.equal(daysBetween('2026-09-20', '2026-09-13'), -7)
  assert.equal(daysBetween('2026-09-13', '2026-09-13'), 0)
})

test('day arithmetic survives a daylight saving change', () => {
  // British Summer Time ends on 25 October 2026. A timezone-naive Date would
  // drift by an hour here and land on the wrong day.
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2)
  assert.equal(addDays('2026-10-24', 2), '2026-10-26')
})

test('weekday and weekend agree with the calendar', () => {
  assert.equal(weekday('2026-09-13'), 0) // a Sunday
  assert.equal(isWeekend('2026-09-13'), true)
  assert.equal(isWeekend('2026-09-14'), false)
})

test('today is read in the given timezone, not the server default', () => {
  // 23:30 UTC is already tomorrow in Sydney and still today in London.
  const night = new Date('2026-09-13T23:30:00Z')
  assert.equal(today('Europe/London', night), '2026-09-14') // BST is UTC+1
  assert.equal(today('Australia/Sydney', night), '2026-09-14')
  assert.equal(today('America/Los_Angeles', night), '2026-09-13')
})

test('each day walks an inclusive range', () => {
  assert.deepEqual(eachDay('2026-09-13', '2026-09-15'), ['2026-09-13', '2026-09-14', '2026-09-15'])
  assert.deepEqual(eachDay('2026-09-13', '2026-09-13'), ['2026-09-13'])
})

test('days are described the way a person would say them', () => {
  assert.equal(relativeDay('2026-09-13', '2026-09-13'), 'today')
  assert.equal(relativeDay('2026-09-14', '2026-09-13'), 'tomorrow')
  assert.equal(relativeDay('2026-09-16', '2026-09-13'), 'in 3 days')
  assert.equal(relativeDay('2026-09-10', '2026-09-13'), '3 days ago')
  assert.equal(formatDay('2026-09-13'), 'Sunday 13 September')
})
