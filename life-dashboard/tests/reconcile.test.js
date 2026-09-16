import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { importCsv } from '../server/money/csv.js'
import { findUnknownRecurring, matchScore, normalizeDescription, reconcile } from '../server/money/reconcile.js'

const statement = await readFile(fileURLToPath(new URL('../fixtures/statement.csv', import.meta.url)), 'utf8')
const { transactions } = importCsv(statement, { accountId: 'current' })

const COMMITMENTS = [
  { id: 'rent', name: 'Rent', kind: 'outgoing', category: 'rent-mortgage', amountPence: 120_000, schedule: { frequency: 'monthly', anchor: '2026-09-01' } },
  { id: 'gas', name: 'British Gas', kind: 'outgoing', category: 'direct-debit', amountPence: 7_800, variable: true, schedule: { frequency: 'monthly', anchor: '2026-09-03' } },
  { id: 'council', name: 'Council tax', kind: 'outgoing', category: 'direct-debit', amountPence: 18_500, schedule: { frequency: 'monthly', anchor: '2026-09-05' } },
  { id: 'broadband', name: 'Broadband', kind: 'outgoing', category: 'direct-debit', amountPence: 3_499, schedule: { frequency: 'monthly', anchor: '2026-09-12' } },
  { id: 'water', name: 'Water', kind: 'outgoing', category: 'direct-debit', amountPence: 4_200, schedule: { frequency: 'monthly', anchor: '2026-09-10' } },
  { id: 'salary', name: 'Salary', kind: 'income', category: 'salary', amountPence: 280_000, schedule: { frequency: 'monthly', anchor: '2026-09-25' } },
]

test('bank shouting is normalised down to the words that matter', () => {
  assert.equal(normalizeDescription('DD NETFLIX.COM 1029384756'), 'netflix com')
  assert.equal(normalizeDescription('CARD PAYMENT TESCO STORES 3364'), 'tesco stores')
  assert.equal(normalizeDescription('BGC ACME TRADING LTD SALARY'), 'acme trading ltd salary')
})

test('a commitment name matches the narrative it appears in', () => {
  assert.ok(matchScore('Netflix', 'DD NETFLIX.COM 1029384756') >= 0.6)
  assert.ok(matchScore('Council tax', 'DD COUNCIL TAX BOROUGH 4471') >= 0.6)
  assert.ok(matchScore('British Gas', 'DD BRITISH GAS ENERGY 8829301') >= 0.6)
  assert.ok(matchScore('Netflix', 'CARD PAYMENT TESCO STORES') < 0.6)
})

test('an unrelated payment does not match', () => {
  assert.equal(matchScore('Rent', 'CARD PAYMENT COFFEE HOUSE'), 0)
})

test('expected payments are matched to what actually left', () => {
  const result = reconcile({ commitments: COMMITMENTS, transactions, from: '2026-09-01', to: '2026-09-30' })
  const names = (list) => list.map((entry) => entry.name).sort()
  assert.deepEqual(names(result.paid), ['Broadband', 'Council tax', 'Rent', 'Salary'])
})

test('a bill that went up is reported as changed, with the difference', () => {
  const result = reconcile({ commitments: COMMITMENTS, transactions, from: '2026-09-01', to: '2026-09-30' })
  const gas = result.changed.find((entry) => entry.name === 'British Gas')
  assert.ok(gas, 'the gas bill should be flagged')
  assert.equal(gas.paidPence, -8_450)
  assert.equal(gas.deltaPence, -650) // £6.50 more than expected
})

test('a direct debit that never came out is reported as missing', () => {
  const result = reconcile({ commitments: COMMITMENTS, transactions, from: '2026-09-01', to: '2026-09-30' })
  assert.deepEqual(result.missing.map((entry) => entry.name), ['Water'])
})

test('a payment not yet due is not called missing', () => {
  const result = reconcile({
    commitments: [{ id: 'later', name: 'Insurance', kind: 'outgoing', amountPence: 5_000, schedule: { frequency: 'monthly', anchor: '2026-10-20' } }],
    transactions,
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.deepEqual(result.missing, [])
})

test('payments that match no commitment are handed back', () => {
  const result = reconcile({ commitments: COMMITMENTS, transactions, from: '2026-09-01', to: '2026-09-30' })
  const descriptions = result.unmatched.map((transaction) => transaction.description)
  assert.ok(descriptions.some((text) => text.includes('TESCO')))
  assert.ok(descriptions.some((text) => text.includes('NETFLIX')))
  assert.ok(descriptions.some((text) => text.includes('COFFEE')))
})

test('a payment a few days late still matches its bill', () => {
  const result = reconcile({
    commitments: [{ id: 'x', name: 'Gym', kind: 'outgoing', amountPence: 3_500, schedule: { frequency: 'monthly', anchor: '2026-09-10' } }],
    transactions: [{ id: 't1', day: '2026-09-13', description: 'DD GYM GROUP', amountPence: -3_500 }],
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(result.paid.length, 1)
  assert.equal(result.paid[0].daysOff, 3)
})

test('a payment far outside the tolerance is not claimed', () => {
  const result = reconcile({
    commitments: [{ id: 'x', name: 'Gym', kind: 'outgoing', amountPence: 3_500, schedule: { frequency: 'monthly', anchor: '2026-09-10' } }],
    transactions: [{ id: 't1', day: '2026-09-25', description: 'DD GYM GROUP', amountPence: -3_500 }],
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(result.missing.length, 1)
})

test('an outgoing is never matched to money coming in', () => {
  const result = reconcile({
    commitments: [{ id: 'x', name: 'Acme', kind: 'outgoing', amountPence: 5_000, schedule: { frequency: 'monthly', anchor: '2026-09-10' } }],
    transactions: [{ id: 't1', day: '2026-09-10', description: 'ACME REFUND', amountPence: 5_000 }],
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(result.missing.length, 1)
  assert.equal(result.unmatched.length, 1)
})

test('one transaction cannot settle two different bills', () => {
  const result = reconcile({
    commitments: [
      { id: 'a', name: 'Gym', kind: 'outgoing', amountPence: 3_500, schedule: { frequency: 'monthly', anchor: '2026-09-10' } },
      { id: 'b', name: 'Gym', kind: 'outgoing', amountPence: 3_500, schedule: { frequency: 'monthly', anchor: '2026-09-11' } },
    ],
    transactions: [{ id: 't1', day: '2026-09-10', description: 'DD GYM GROUP', amountPence: -3_500 }],
    from: '2026-09-01',
    to: '2026-09-30',
  })
  assert.equal(result.paid.length, 1)
  assert.equal(result.missing.length, 1)
})

test('a forgotten subscription is found in the payments nothing explains', () => {
  const unmatched = [
    { id: '1', day: '2026-06-14', description: 'DD NETFLIX.COM 102938', amountPence: -1_299 },
    { id: '2', day: '2026-07-14', description: 'DD NETFLIX.COM 102938', amountPence: -1_299 },
    { id: '3', day: '2026-08-14', description: 'DD NETFLIX.COM 102938', amountPence: -1_299 },
    { id: '4', day: '2026-09-14', description: 'DD NETFLIX.COM 102938', amountPence: -1_299 },
    { id: '5', day: '2026-09-15', description: 'CARD PAYMENT COFFEE HOUSE', amountPence: -340 },
  ]
  const [found, ...rest] = findUnknownRecurring(unmatched)
  assert.equal(rest.length, 0, 'a one-off coffee is not a subscription')
  assert.equal(found.occurrences, 4)
  assert.equal(found.frequency, 'monthly')
  assert.equal(found.amountPence, 1_299)
  assert.ok(found.annualPence > 15_000 && found.annualPence < 16_000)
})

test('irregular payments to the same shop are not called a subscription', () => {
  const unmatched = [
    { id: '1', day: '2026-09-01', description: 'TESCO STORES', amountPence: -5_219 },
    { id: '2', day: '2026-09-03', description: 'TESCO STORES', amountPence: -1_140 },
    { id: '3', day: '2026-09-19', description: 'TESCO STORES', amountPence: -8_800 },
  ]
  assert.deepEqual(findUnknownRecurring(unmatched), [])
})

test('money coming in is never mistaken for a subscription', () => {
  const unmatched = [
    { id: '1', day: '2026-07-01', description: 'INTEREST PAID', amountPence: 120 },
    { id: '2', day: '2026-08-01', description: 'INTEREST PAID', amountPence: 120 },
    { id: '3', day: '2026-09-01', description: 'INTEREST PAID', amountPence: 120 },
  ]
  assert.deepEqual(findUnknownRecurring(unmatched), [])
})

test('reconciling with nothing on either side is empty, not an error', () => {
  const result = reconcile({ commitments: [], transactions: [], from: '2026-09-01', to: '2026-09-30' })
  assert.deepEqual(result.entries, [])
  assert.deepEqual(result.unmatched, [])
})
