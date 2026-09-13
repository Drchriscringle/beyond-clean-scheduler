import test from 'node:test'
import assert from 'node:assert/strict'
import {
  annualBreakdown, dueSoon, forecast, nextPayday, runway, totalOpeningPence,
} from '../server/money/forecast.js'

const monthly = (id, name, kind, amountPence, anchor, extra = {}) => ({
  id, name, kind, amountPence, schedule: { frequency: 'monthly', anchor }, ...extra,
})

const HOUSEHOLD = [
  monthly('rent', 'Rent', 'outgoing', 120_000, '2026-09-01', { category: 'rent-mortgage' }),
  monthly('council', 'Council tax', 'outgoing', 18_500, '2026-09-05', { category: 'direct-debit' }),
  monthly('broadband', 'Broadband', 'outgoing', 3_200, '2026-09-12', { category: 'direct-debit' }),
  monthly('salary', 'Salary', 'income', 280_000, '2026-09-25', { category: 'salary' }),
]

test('the opening balance sums the accounts that count', () => {
  const accounts = [
    { id: 'a', balancePence: 150_000 },
    { id: 'b', balancePence: 20_000 },
    { id: 'isa', balancePence: 900_000, includeInForecast: false },
  ]
  assert.equal(totalOpeningPence(accounts), 170_000)
})

test('the balance runs forward day by day', () => {
  const projection = forecast({
    openingPence: 200_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(projection.days[0].closingPence, 80_000) // rent on the 1st
  assert.equal(projection.closingPence, 200_000 - 120_000 - 18_500 - 3_200 + 280_000)
  assert.equal(projection.totals.incomePence, 280_000)
  assert.equal(projection.totals.outgoingPence, 141_700)
})

test('the lowest point is reported, not just the closing balance', () => {
  // Ends the month up, but dips to £583 the day before payday.
  const projection = forecast({
    openingPence: 200_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(projection.lowest.balancePence, 58_300)
  assert.equal(projection.lowest.day, '2026-09-12')
  assert.ok(projection.closingPence > projection.lowest.balancePence)
})

test('a dip below the buffer is flagged with what caused it', () => {
  const projection = forecast({
    openingPence: 130_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
    bufferPence: 20_000,
  })
  // £1,300 opening less £1,200 rent leaves £100 — already under the £200
  // buffer on the 1st, before the council tax makes it worse.
  assert.ok(projection.breaches.length > 0)
  assert.equal(projection.firstBreach.day, '2026-09-01')
  assert.equal(projection.firstBreach.trigger, 'Rent')
  assert.equal(projection.firstBreach.belowZero, false)
  assert.equal(projection.breaches[1].day, '2026-09-05')
  assert.equal(projection.breaches[1].belowZero, true)
})

test('going overdrawn is called out as such', () => {
  const projection = forecast({
    openingPence: 125_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(projection.firstBreach.belowZero, true)
  assert.equal(projection.firstBreach.day, '2026-09-05')
})

test('a comfortable month has no breaches', () => {
  const projection = forecast({
    openingPence: 500_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
    bufferPence: 20_000,
  })
  assert.deepEqual(projection.breaches, [])
  assert.equal(projection.firstBreach, null)
})

test('payday is the next wage, not the next money in', () => {
  const due = forecast({
    openingPence: 0,
    commitments: [
      ...HOUSEHOLD,
      { id: 'inv', name: 'Invoice 114', kind: 'income', amountPence: 60_000, category: 'invoice', schedule: { frequency: 'one-off', anchor: '2026-09-18' } },
    ],
    from: '2026-09-13',
    to: '2026-10-31',
  }).due
  const payday = nextPayday(due, '2026-09-13')
  assert.equal(payday.day, '2026-09-25')
  assert.equal(payday.name, 'Salary')
})

test('with no wages at all, the next income stands in for payday', () => {
  const due = forecast({
    openingPence: 0,
    commitments: [{ id: 'inv', name: 'Invoice 114', kind: 'income', amountPence: 60_000, category: 'invoice', schedule: { frequency: 'one-off', anchor: '2026-09-18' } }],
    from: '2026-09-13',
    to: '2026-10-31',
  }).due
  assert.equal(nextPayday(due, '2026-09-13').name, 'Invoice 114')
})

test('the runway says what leaves before payday and what is safe to spend', () => {
  const projection = forecast({
    openingPence: 100_000,
    commitments: HOUSEHOLD,
    from: '2026-09-10',
    to: '2026-10-31',
    bufferPence: 10_000,
  })
  const result = runway({ forecast: projection, bufferPence: 10_000, from: '2026-09-10' })

  assert.equal(result.payday.day, '2026-09-25')
  assert.equal(result.daysToPayday, 15)
  // Only broadband falls between the 10th and payday.
  assert.equal(result.outgoingCount, 1)
  assert.equal(result.outgoingBeforePaydayPence, 3_200)
  assert.equal(result.lowestBeforePaydayPence, 96_800)
  assert.equal(result.safeToSpendPence, 86_800)
  assert.equal(result.tight, false)
})

test('safe to spend is measured at the dip, not at payday', () => {
  // £1,400 now, £1,200 rent on the 1st, £2,800 in on the 25th. The month ends
  // well but there is almost nothing spare in between.
  const projection = forecast({
    openingPence: 140_000,
    commitments: HOUSEHOLD,
    from: '2026-08-30',
    to: '2026-10-31',
    bufferPence: 0,
  })
  const result = runway({ forecast: projection, bufferPence: 0, from: '2026-08-30' })
  assert.equal(result.lowestBeforePaydayPence, -1_700)
  assert.equal(result.safeToSpendPence, 0)
  assert.equal(result.tight, true)
})

test('a tight month is flagged against the buffer, not just against zero', () => {
  const projection = forecast({
    openingPence: 130_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-10-31',
    bufferPence: 50_000,
  })
  const result = runway({ forecast: projection, bufferPence: 50_000, from: '2026-09-01' })
  assert.equal(result.tight, true)
  assert.equal(result.safeToSpendPence, 0)
})

test('due soon covers the next fortnight only', () => {
  const projection = forecast({ openingPence: 0, commitments: HOUSEHOLD, from: '2026-09-01', to: '2026-10-31' })
  const soon = dueSoon(projection.due, '2026-09-01', 14)
  assert.deepEqual(soon.map((item) => item.name), ['Rent', 'Council tax', 'Broadband'])
})

test('annualising compares unlike frequencies', () => {
  const breakdown = annualBreakdown([
    { id: '1', name: 'Netflix', kind: 'outgoing', category: 'subscription', amountPence: 1_299, schedule: { frequency: 'monthly' } },
    { id: '2', name: 'Amazon Prime', kind: 'outgoing', category: 'subscription', amountPence: 9_500, schedule: { frequency: 'annual' } },
    { id: '3', name: 'Salary', kind: 'income', category: 'salary', amountPence: 280_000, schedule: { frequency: 'monthly' } },
  ])
  const subscriptions = breakdown.find((row) => row.category === 'subscription')
  assert.equal(subscriptions.annualPence, 1_299 * 12 + 9_500)
  assert.equal(breakdown[0].category, 'income') // biggest first
})

test('an empty life forecasts flat rather than crashing', () => {
  const projection = forecast({ openingPence: 5_000, commitments: [], from: '2026-09-01', to: '2026-09-07' })
  assert.equal(projection.closingPence, 5_000)
  assert.equal(projection.days.length, 7)
  assert.deepEqual(projection.breaches, [])
  const result = runway({ forecast: projection, from: '2026-09-01' })
  assert.equal(result.payday, null)
})

test('a balance that stays low is one breach, not one per day', () => {
  // Sitting below the buffer for three weeks is a single problem. Only the
  // days something actually moves should be listed.
  const projection = forecast({
    openingPence: 130_000,
    commitments: HOUSEHOLD,
    from: '2026-09-01',
    to: '2026-09-30',
    bufferPence: 20_000,
  })
  assert.deepEqual(projection.breaches.map((breach) => breach.day), [
    '2026-09-01', '2026-09-05', '2026-09-12',
  ])
  assert.deepEqual(projection.breaches.map((breach) => breach.trigger), [
    'Rent', 'Council tax', 'Broadband',
  ])
})
