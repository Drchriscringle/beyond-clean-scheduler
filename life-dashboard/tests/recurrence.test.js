import test from 'node:test'
import assert from 'node:assert/strict'
import { expandRecurrence, parseRule } from '../server/calendar/recurrence.js'

const expand = (start, rule, from, to, options) =>
  expandRecurrence(start, parseRule(rule), from, to, options)

test('a daily rule fills every day', () => {
  assert.deepEqual(expand('2026-09-13', 'FREQ=DAILY', '2026-09-13', '2026-09-16'), [
    '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16',
  ])
})

test('an interval skips the days in between', () => {
  assert.deepEqual(expand('2026-09-13', 'FREQ=DAILY;INTERVAL=3', '2026-09-13', '2026-09-20'), [
    '2026-09-13', '2026-09-16', '2026-09-19',
  ])
})

test('weekdays only', () => {
  assert.deepEqual(
    expand('2026-09-14', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', '2026-09-14', '2026-09-21'),
    ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-21'],
  )
})

test('a weekly rule repeats on the start weekday', () => {
  assert.deepEqual(expand('2026-09-14', 'FREQ=WEEKLY', '2026-09-14', '2026-10-05'), [
    '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05',
  ])
})

test('a weekly rule can name several days', () => {
  assert.deepEqual(expand('2026-09-14', 'FREQ=WEEKLY;BYDAY=MO,WE', '2026-09-14', '2026-09-24'), [
    '2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23',
  ])
})

test('a fortnightly rule skips alternate weeks', () => {
  // Bin day: every other Tuesday.
  assert.deepEqual(
    expand('2026-09-15', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-15', '2026-10-31'),
    ['2026-09-15', '2026-09-29', '2026-10-13', '2026-10-27'],
  )
})

test('a monthly rule holds the day of the month', () => {
  assert.deepEqual(expand('2026-09-03', 'FREQ=MONTHLY', '2026-09-01', '2026-12-31'), [
    '2026-09-03', '2026-10-03', '2026-11-03', '2026-12-03',
  ])
})

test('a monthly rule for the 31st skips the short months', () => {
  // This is the spec's behaviour and differs from a bill, which clamps.
  assert.deepEqual(expand('2026-01-31', 'FREQ=MONTHLY', '2026-01-01', '2026-06-30'), [
    '2026-01-31', '2026-03-31', '2026-05-31',
  ])
})

test('the last Friday of the month', () => {
  assert.deepEqual(
    expand('2026-09-25', 'FREQ=MONTHLY;BYDAY=-1FR', '2026-09-01', '2026-12-31'),
    ['2026-09-25', '2026-10-30', '2026-11-27', '2026-12-25'],
  )
})

test('the second Tuesday of the month', () => {
  assert.deepEqual(
    expand('2026-09-08', 'FREQ=MONTHLY;BYDAY=2TU', '2026-09-01', '2026-11-30'),
    ['2026-09-08', '2026-10-13', '2026-11-10'],
  )
})

test('a yearly rule returns once a year', () => {
  assert.deepEqual(expand('2026-09-13', 'FREQ=YEARLY', '2026-01-01', '2029-12-31'), [
    '2026-09-13', '2027-09-13', '2028-09-13', '2029-09-13',
  ])
})

test('COUNT is counted from the series start, not the window', () => {
  // Four occurrences total: the window opens after three have already gone.
  assert.deepEqual(expand('2026-09-13', 'FREQ=DAILY;COUNT=4', '2026-09-15', '2026-09-30'), [
    '2026-09-15', '2026-09-16',
  ])
})

test('UNTIL ends the series', () => {
  assert.deepEqual(expand('2026-09-13', 'FREQ=DAILY;UNTIL=20260915T235959Z', '2026-09-13', '2026-09-30'), [
    '2026-09-13', '2026-09-14', '2026-09-15',
  ])
})

test('excluded dates are dropped', () => {
  assert.deepEqual(
    expand('2026-09-13', 'FREQ=DAILY', '2026-09-13', '2026-09-16', { exclude: ['2026-09-14'] }),
    ['2026-09-13', '2026-09-15', '2026-09-16'],
  )
})

test('a window years after the start still lands on the right days', () => {
  const days = expand('2020-01-06', 'FREQ=WEEKLY;BYDAY=MO', '2026-09-01', '2026-09-30')
  assert.deepEqual(days, ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
})

test('an unsupported rule falls back to its start date rather than guessing', () => {
  const rule = parseRule('FREQ=MONTHLY;BYSETPOS=3;BYDAY=MO,TU,WE,TH,FR')
  assert.equal(rule.unsupported, 'BYSETPOS')
  assert.deepEqual(expandRecurrence('2026-09-16', rule, '2026-09-01', '2026-12-31'), ['2026-09-16'])
})

test('an hourly rule is declared unsupported rather than expanded wrongly', () => {
  assert.equal(parseRule('FREQ=HOURLY;INTERVAL=2').unsupported, 'FREQ=HOURLY')
})

test('rule parts are read case-insensitively and with defaults', () => {
  const rule = parseRule('freq=weekly;byday=mo,we')
  assert.equal(rule.frequency, 'WEEKLY')
  assert.equal(rule.interval, 1)
  assert.equal(rule.count, null)
  assert.deepEqual(rule.byDay.map((entry) => entry.weekday), [1, 3])
})

test('expansion is bounded even for an open-ended daily rule', () => {
  const days = expand('2000-01-01', 'FREQ=DAILY', '2000-01-01', '2030-01-01')
  assert.ok(days.length <= 2000, `expected a capped result, got ${days.length}`)
})
