import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  detectColumns, importCsv, mergeTransactions, parseAmountPence, parseCsv, parseCsvDate,
} from '../server/money/csv.js'

const statement = await readFile(fileURLToPath(new URL('../fixtures/statement.csv', import.meta.url)), 'utf8')

test('a comma inside a quoted field does not shift the columns', () => {
  const rows = parseCsv('Date,Description,Amount\n01/09/2026,"SMITH, J & SONS",-12.00')
  assert.deepEqual(rows[1], ['01/09/2026', 'SMITH, J & SONS', '-12.00'])
})

test('escaped quotes survive', () => {
  const rows = parseCsv('a,b\n1,"He said ""hello"""')
  assert.equal(rows[1][1], 'He said "hello"')
})

test('a spreadsheet BOM and CRLF line endings are handled', () => {
  const rows = parseCsv('﻿Date,Amount\r\n01/09/2026,-12.00\r\n')
  assert.deepEqual(rows[0], ['Date', 'Amount'])
  assert.equal(rows.length, 2)
})

test('blank lines are dropped', () => {
  assert.equal(parseCsv('a,b\n\n1,2\n\n').length, 2)
})

test('columns are detected from whatever the bank called them', () => {
  assert.deepEqual(detectColumns(['Transaction Date', 'Narrative', 'Money Out', 'Money In', 'Balance']), {
    day: 0, description: 1, debit: 2, credit: 3, balance: 4,
  })
  assert.deepEqual(detectColumns(['Date', 'Description', 'Amount']), { day: 0, description: 1, amount: 2 })
})

test('dates are read day-first, because these are UK exports', () => {
  assert.equal(parseCsvDate('05/03/2026'), '2026-03-05')
  assert.equal(parseCsvDate('05/03/2026', { dayFirst: false }), '2026-05-03')
  assert.equal(parseCsvDate('2026-03-05'), '2026-03-05')
  assert.equal(parseCsvDate('13 Sep 2026'), '2026-09-13')
  assert.equal(parseCsvDate('05/03/26'), '2026-03-05')
})

test('an unreadable date is refused rather than guessed', () => {
  assert.equal(parseCsvDate('last Tuesday'), null)
  assert.equal(parseCsvDate(''), null)
  assert.equal(parseCsvDate('05/13/2026'), null) // month 13, day-first cannot be right
})

test('amounts lose their decoration', () => {
  assert.equal(parseAmountPence('£1,200.00'), 120_000)
  assert.equal(parseAmountPence('-12.99'), -1_299)
  assert.equal(parseAmountPence('(12.34)'), -1_234) // accounting brackets
  assert.equal(parseAmountPence('0.01'), 1)
  assert.equal(parseAmountPence(''), null)
  assert.equal(parseAmountPence('n/a'), null)
})

test('a rounding error cannot creep in through floating point', () => {
  assert.equal(parseAmountPence('0.29'), 29)
  assert.equal(parseAmountPence('1234.56'), 123_456)
  assert.equal(parseAmountPence('8.30'), 830)
})

test('a real statement imports cleanly', () => {
  const { transactions, skipped } = importCsv(statement, { accountId: 'current' })
  assert.equal(skipped.length, 0)
  assert.equal(transactions.length, 8)
  assert.equal(transactions[0].amountPence, -120_000)
  assert.equal(transactions[0].description, 'RENT PAYMENT TO SMITH, J & SONS LTD')
  assert.equal(transactions[7].amountPence, 280_000) // the credit column
  assert.equal(transactions[0].balancePence, 180_000)
})

test('a single amount column carrying its own sign works too', () => {
  const { transactions } = importCsv('Date,Description,Amount\n01/09/2026,RENT,-1200.00\n25/09/2026,SALARY,2800.00')
  assert.deepEqual(transactions.map((transaction) => transaction.amountPence), [-120_000, 280_000])
})

test('unreadable rows are reported, not silently dropped', () => {
  const { transactions, skipped } = importCsv(
    'Date,Description,Amount\n01/09/2026,GOOD,-12.00\nnot-a-date,BAD,-13.00\n02/09/2026,NO AMOUNT,',
  )
  assert.equal(transactions.length, 1)
  assert.equal(skipped.length, 2)
  assert.equal(skipped[0].line, 3)
  assert.match(skipped[0].reason, /date/i)
  assert.match(skipped[1].reason, /amount/i)
})

test('a file whose columns cannot be read says so rather than importing nothing quietly', () => {
  const { transactions, skipped } = importCsv('col1,col2\nfoo,bar')
  assert.equal(transactions.length, 0)
  assert.match(skipped[0].reason, /date/i)
})

test('re-importing the same file adds nothing', () => {
  const first = importCsv(statement, { accountId: 'current' }).transactions
  const second = importCsv(statement, { accountId: 'current' }).transactions
  const merged = mergeTransactions(first, second)
  assert.equal(merged.added, 0)
  assert.equal(merged.duplicates, 8)
  assert.equal(merged.transactions.length, 8)
})

test('two genuinely identical payments on one day are both kept', () => {
  // Same day, same amount, different merchant — these are two real payments.
  const { transactions } = importCsv(
    'Date,Description,Amount\n01/09/2026,COFFEE,-3.40\n01/09/2026,BUS FARE,-3.40',
  )
  const merged = mergeTransactions([], transactions)
  assert.equal(merged.transactions.length, 2)
})

test('an empty file imports as nothing rather than throwing', () => {
  const result = importCsv('')
  assert.deepEqual(result.transactions, [])
})
