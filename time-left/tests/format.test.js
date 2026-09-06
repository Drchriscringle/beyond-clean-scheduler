import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAge, formatCompact, formatSigned, pad, splitCountdown } from '../src/lib/format.js'

test('splitCountdown breaks a span into years, days and clock time', () => {
  const parts = splitCountdown(new Date(2026, 0, 1, 0, 0, 0), new Date(2027, 0, 2, 3, 4, 5, 600))
  assert.equal(parts.years, 1)
  assert.equal(parts.days, 1)
  assert.equal(parts.hours, 3)
  assert.equal(parts.minutes, 4)
  assert.equal(parts.seconds, 5)
  assert.equal(parts.tenths, 6)
})

test('splitCountdown lands exactly on a whole number of years', () => {
  const parts = splitCountdown(new Date(2026, 5, 15, 9, 30), new Date(2061, 5, 15, 9, 30))
  assert.equal(parts.years, 35)
  assert.equal(parts.days, 0)
  assert.equal(parts.hours, 0)
  assert.equal(parts.minutes, 0)
})

test('splitCountdown bottoms out at zero rather than going negative', () => {
  const parts = splitCountdown(new Date(2026, 0, 2), new Date(2026, 0, 1))
  assert.deepEqual(parts, { years: 0, days: 0, hours: 0, minutes: 0, seconds: 0, tenths: 0, total: 0 })
})

test('big numbers are said in words, smaller ones in full', () => {
  assert.equal(formatCompact(1_333_480_320), '1.3 billion')
  assert.equal(formatCompact(2_500_000_000_000), '2.5 trillion')
  assert.equal(formatCompact(999), '999')
})

test('padding and signing keep the clock and the adjustment readable', () => {
  assert.equal(pad(7), '07')
  assert.equal(pad(7, 3), '007')
  assert.equal(pad(-3), '00')
  assert.equal(formatSigned(3.5), '+3.5')
  assert.equal(formatSigned(-10), '-10')
  assert.equal(formatSigned(0), '0')
})

test('ages read as a sentence', () => {
  assert.equal(formatAge({ years: 46, months: 2, days: 5 }), '46 years, 2 months, 5 days')
  assert.equal(formatAge({ years: 1, months: 1, days: 1 }), '1 year, 1 month, 1 day')
})
