import test from 'node:test'
import assert from 'node:assert/strict'
import {
  annualisedPence, dueBetween, occurrences, shiftToWorkingDay, signedAmount,
} from '../server/money/schedule.js'

const bill = (schedule, extra = {}) => ({
  id: 'x', name: 'Bill', kind: 'outgoing', amountPence: 1000, schedule, ...extra,
})
const days = (result) => result.map((slot) => slot.day)

test('a monthly bill returns on the same date each month', () => {
  const result = occurrences(bill({ frequency: 'monthly', anchor: '2026-09-03' }), '2026-09-01', '2026-12-31')
  assert.deepEqual(days(result), ['2026-09-03', '2026-10-03', '2026-11-03', '2026-12-03'])
})

test('rent on the 31st comes out on the 28th in February, not in March', () => {
  // The difference from a calendar rule, which would skip February entirely.
  const result = occurrences(bill({ frequency: 'monthly', anchor: '2026-01-31' }), '2026-01-01', '2026-05-31')
  assert.deepEqual(days(result), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
})

test('a clamped month does not drag the following months backwards', () => {
  const result = occurrences(bill({ frequency: 'monthly', anchor: '2026-08-31' }), '2026-08-01', '2026-11-30')
  assert.deepEqual(days(result), ['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30'])
})

test('weekly, fortnightly and four-weekly all step from the anchor', () => {
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'weekly', anchor: '2026-09-14' }), '2026-09-14', '2026-10-05')),
    ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'],
  )
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'fortnightly', anchor: '2026-09-14' }), '2026-09-14', '2026-10-31')),
    ['2026-09-14', '2026-09-28', '2026-10-12', '2026-10-26'],
  )
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'four-weekly', anchor: '2026-09-04' }), '2026-09-01', '2026-12-31')),
    ['2026-09-04', '2026-10-02', '2026-10-30', '2026-11-27', '2026-12-25'],
  )
})

test('quarterly and annual step by months', () => {
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'quarterly', anchor: '2026-01-15' }), '2026-01-01', '2026-12-31')),
    ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'],
  )
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'annual', anchor: '2026-06-01' }), '2026-01-01', '2028-12-31')),
    ['2026-06-01', '2027-06-01', '2028-06-01'],
  )
})

test('a one-off happens once', () => {
  const once = bill({ frequency: 'one-off', anchor: '2026-09-20' })
  assert.deepEqual(days(occurrences(once, '2026-09-01', '2026-12-31')), ['2026-09-20'])
  assert.deepEqual(occurrences(once, '2026-10-01', '2026-12-31'), [])
})

test('an interval spaces the periods out', () => {
  assert.deepEqual(
    days(occurrences(bill({ frequency: 'monthly', anchor: '2026-09-03', interval: 2 }), '2026-09-01', '2027-03-31')),
    ['2026-09-03', '2026-11-03', '2027-01-03', '2027-03-03'],
  )
})

test('a schedule that has ended stops', () => {
  const result = occurrences(
    bill({ frequency: 'monthly', anchor: '2026-09-03', endOn: '2026-11-30' }),
    '2026-09-01',
    '2027-06-30',
  )
  assert.deepEqual(days(result), ['2026-09-03', '2026-10-03', '2026-11-03'])
})

test('nothing is due before the schedule starts', () => {
  const result = occurrences(bill({ frequency: 'monthly', anchor: '2026-11-03' }), '2026-09-01', '2026-12-31')
  assert.deepEqual(days(result), ['2026-11-03', '2026-12-03'])
})

test('a direct debit falling on a Sunday moves to the Monday', () => {
  // 4 October 2026 is a Sunday.
  const result = occurrences(
    bill({ frequency: 'monthly', anchor: '2026-10-04', shift: 'after' }),
    '2026-10-01',
    '2026-10-31',
  )
  assert.equal(result[0].day, '2026-10-05')
  assert.equal(result[0].nominalDay, '2026-10-04')
  assert.equal(result[0].moved, true)
})

test('a shift can also go backwards to the previous working day', () => {
  assert.equal(shiftToWorkingDay('2026-10-04', 'before'), '2026-10-02')
  assert.equal(shiftToWorkingDay('2026-10-04', 'after'), '2026-10-05')
  assert.equal(shiftToWorkingDay('2026-10-04', 'none'), '2026-10-04')
})

test('a payment steps over a run of bank holidays', () => {
  // Christmas Day 2026 is a Friday; the 28th is the substitute Bank Holiday
  // Monday. A payment due on the 25th lands on the 29th.
  const holidays = ['2026-12-25', '2026-12-28']
  assert.equal(shiftToWorkingDay('2026-12-25', 'after', new Set(holidays)), '2026-12-29')
})

test('a weekday payment is left alone', () => {
  assert.equal(shiftToWorkingDay('2026-09-16', 'after'), '2026-09-16')
})

test('a window far from the anchor is answered without walking every period', () => {
  const result = occurrences(bill({ frequency: 'weekly', anchor: '2015-01-05' }), '2026-09-01', '2026-09-30')
  assert.deepEqual(days(result), ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
})

test('income is positive and outgoings negative', () => {
  assert.equal(signedAmount({ kind: 'income', amountPence: 250_000 }), 250_000)
  assert.equal(signedAmount({ kind: 'outgoing', amountPence: 1200 }), -1200)
  // A sign typed into the amount does not flip the direction.
  assert.equal(signedAmount({ kind: 'outgoing', amountPence: -1200 }), -1200)
})

test('unlike frequencies compare on an annual basis', () => {
  assert.equal(annualisedPence({ amountPence: 1000, schedule: { frequency: 'monthly' } }), 12_000)
  assert.equal(annualisedPence({ amountPence: 1000, schedule: { frequency: 'weekly' } }), 52_000)
  assert.equal(annualisedPence({ amountPence: 12_000, schedule: { frequency: 'annual' } }), 12_000)
  assert.equal(annualisedPence({ amountPence: 1000, schedule: { frequency: 'one-off' } }), 0)
})

test('due dates across several commitments come back in date order', () => {
  const due = dueBetween(
    [
      { id: 'rent', name: 'Rent', kind: 'outgoing', amountPence: 120_000, schedule: { frequency: 'monthly', anchor: '2026-09-01' } },
      { id: 'pay', name: 'Salary', kind: 'income', amountPence: 280_000, schedule: { frequency: 'monthly', anchor: '2026-09-25' } },
      { id: 'gym', name: 'Gym', kind: 'outgoing', amountPence: 3500, schedule: { frequency: 'monthly', anchor: '2026-09-15' } },
    ],
    '2026-09-01',
    '2026-09-30',
  )
  assert.deepEqual(due.map((item) => [item.day, item.name, item.amountPence]), [
    ['2026-09-01', 'Rent', -120_000],
    ['2026-09-15', 'Gym', -3500],
    ['2026-09-25', 'Salary', 280_000],
  ])
})

test('an inactive commitment is not due', () => {
  const due = dueBetween(
    [{ id: 'old', name: 'Cancelled thing', kind: 'outgoing', amountPence: 999, active: false, schedule: { frequency: 'monthly', anchor: '2026-09-01' } }],
    '2026-09-01',
    '2026-09-30',
  )
  assert.deepEqual(due, [])
})

test('a commitment with no anchor is skipped rather than guessed at', () => {
  assert.deepEqual(occurrences(bill({ frequency: 'monthly' }), '2026-09-01', '2026-09-30'), [])
})
