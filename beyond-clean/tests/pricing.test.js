import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  DEFAULT_SETTINGS, addHours, formatPounds, mergeSettings, planPrice, slotAvailability, validatePlan,
} from '../supabase/functions/_shared/pricing.js'
import { verifyStripeSignature } from '../supabase/functions/_shared/stripe-signature.js'

const s = DEFAULT_SETTINGS

test('monthly price averages 52 weeks over 12 months and rounds to whole pounds', () => {
  // £20/h × 2h × 1/week × 52/12 = £173.33 → £173
  const p = planPrice(s, 1, 2)
  assert.equal(p.perVisitPence, 4000)
  assert.equal(p.monthlyPence, 17300)
  assert.equal(p.savingPence, 33)
})

test('discounts apply per visits per week', () => {
  // £20 × 3h × 3/week × 52/12 = £780, less 10% = £702
  assert.equal(planPrice(s, 3, 3).monthlyPence, 70200)
  assert.equal(planPrice(s, 3, 3).discountPct, 10)
  // 2/week 5%: £20 × 2 × 2 × 4.333 = £346.67 × .95 = £329.33 → £329
  assert.equal(planPrice(s, 2, 2).monthlyPence, 32900)
})

test('mergeSettings keeps defaults for missing keys', () => {
  const m = mergeSettings({ hourlyRate: 22, discounts: { 3: 15 } })
  assert.equal(m.hourlyRate, 22)
  assert.deepEqual(m.discounts, { 1: 0, 2: 5, 3: 15 })
  assert.equal(m.slotCapacity, 2)
  assert.deepEqual(mergeSettings(null).slots, s.slots)
})

test('slot availability subtracts plans already using a slot', () => {
  const a = slotAvailability(s, [{ day: 1, start: '09:00', used: 2 }, { day: 2, start: '13:00', used: 1 }])
  assert.equal(a.find((x) => x.day === 1 && x.start === '09:00').remaining, 0)
  assert.equal(a.find((x) => x.day === 2 && x.start === '13:00').remaining, 1)
  assert.equal(a.find((x) => x.day === 3 && x.start === '09:00').remaining, 2)
  assert.equal(a[0].day, 1)
})

test('validatePlan checks count, distinct days and capacity', () => {
  const avail = slotAvailability(s, [{ day: 1, start: '09:00', used: 2 }])
  const ok = { visitsPerWeek: 2, hoursPerVisit: 3, slots: [{ day: 2, start: '09:00' }, { day: 4, start: '13:00' }] }
  assert.deepEqual(validatePlan(s, avail, ok), [])
  assert.match(validatePlan(s, avail, { ...ok, slots: [ok.slots[0]] })[0], /Pick 2 times/)
  assert.match(validatePlan(s, avail, { ...ok, slots: [{ day: 2, start: '09:00' }, { day: 2, start: '13:00' }] })[0], /different day/)
  assert.match(validatePlan(s, avail, { ...ok, slots: [{ day: 1, start: '09:00' }, { day: 3, start: '09:00' }] })[0], /just been taken/)
  assert.match(validatePlan(s, avail, { ...ok, slots: [{ day: 7, start: '09:00' }, { day: 3, start: '09:00' }] })[0], /not a bookable/)
  assert.match(validatePlan(s, avail, { ...ok, visitsPerWeek: 5 })[0], /how many cleans/)
})

test('helpers', () => {
  assert.equal(addHours('09:00', 3), '12:00')
  assert.equal(addHours('13:30', 2.5), '16:00')
  assert.equal(formatPounds(17300), '£173')
  assert.equal(formatPounds(4550), '£45.50')
})

test('Stripe signature check accepts genuine and rejects forged or stale events', async () => {
  const secret = 'whsec_test'
  const body = '{"id":"evt_1"}'
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, secret), true)
  assert.equal(await verifyStripeSignature(body + ' ', `t=${t},v1=${sig}`, secret), false)
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'other'), false)
  const old = t - 1000
  const oldSig = createHmac('sha256', secret).update(`${old}.${body}`).digest('hex')
  assert.equal(await verifyStripeSignature(body, `t=${old},v1=${oldSig}`, secret), false)
  assert.equal(await verifyStripeSignature(body, null, secret), false)
})
