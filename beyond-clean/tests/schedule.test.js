import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS as s, depositFor, applyDiscount, estimateOneOff, inServiceArea, planPrice, planVisitValue,
  slotAvailability, validatePlan, frequencyLabel,
} from '../supabase/functions/_shared/pricing.js'
import { addDays, allJobs, hoursUntil, isoWeekday, mondayOf, planVisits } from '../supabase/functions/_shared/schedule.js'

test('date helpers', () => {
  assert.equal(isoWeekday('2026-11-16'), 1) // Monday
  assert.equal(isoWeekday('2026-11-22'), 7)
  assert.equal(mondayOf('2026-11-19'), '2026-11-16')
  assert.equal(addDays('2026-03-28', 2), '2026-03-30') // across the clock change
})

test('fortnightly plans: price, one slot, label', () => {
  // £20 × 2h × 0.5 × 52/12 = £86.67 → £87
  assert.equal(planPrice(s, 0.5, 2).monthlyPence, 8700)
  const avail = slotAvailability(s, [])
  assert.deepEqual(validatePlan(s, avail, { visitsPerWeek: 0.5, hoursPerVisit: 2, slots: [{ day: 1, start: '09:00' }] }), [])
  assert.match(validatePlan(s, avail, { visitsPerWeek: 0.5, hoursPerVisit: 2, slots: [] })[0], /Pick 1 time/)
  assert.equal(frequencyLabel(0.5, true), 'Every 2 weeks')
})

const plan = { id: 'p1', status: 'active', start_date: '2026-11-18', visits_per_week: 1, hours_per_visit: 3, slots: [{ day: 1, start: '09:00' }], monthly_pence: 26000 }

test('weekly visits start on the first slot day on/after the start date', () => {
  const v = planVisits(plan, [], '2026-11-16', '2026-12-08')
  assert.deepEqual(v.map((x) => x.date), ['2026-11-23', '2026-11-30', '2026-12-07'])
  assert.equal(v[0].end, '12:00')
})

test('fortnightly visits alternate weeks from the first clean', () => {
  const f = { ...plan, visits_per_week: 0.5 }
  assert.deepEqual(planVisits(f, [], '2026-11-16', '2027-01-01').map((x) => x.date), ['2026-11-23', '2026-12-07', '2026-12-21'])
  // Starting the window on an "off" week still lands on the right weeks.
  assert.deepEqual(planVisits(f, [], '2026-11-30', '2026-12-31').map((x) => x.date), ['2026-12-07', '2026-12-21'])
})

test('skips, cover, extras and moves are applied', () => {
  const changes = [
    { subscription_id: 'p1', kind: 'skip', visit_date: '2026-11-30', visit_start: '09:00' },
    { subscription_id: 'p1', kind: 'cover', visit_date: '2026-11-23', visit_start: '09:00', cleaner_id: 'c2' },
    { subscription_id: 'p1', kind: 'extra', visit_date: '2026-11-23', visit_start: '09:00', extra_id: 'oven' },
    { subscription_id: 'p1', kind: 'move', status: 'confirmed', visit_date: '2026-12-07', visit_start: '09:00', new_date: '2026-12-09', new_time: '13:00' },
    { subscription_id: 'p1', kind: 'move', status: 'confirmed', visit_date: '2026-12-14', visit_start: '09:00', new_date: '2026-12-01', new_time: '10:00' },
  ]
  const v = planVisits({ ...plan, cleaner_id: 'c1' }, changes, '2026-11-16', '2026-12-10')
  const by = Object.fromEntries(v.map((x) => [x.date, x]))
  assert.equal(by['2026-11-23'].cleanerId, 'c2')
  assert.equal(by['2026-11-23'].extras.length, 1)
  assert.equal(by['2026-11-30'].skipped, true)
  assert.equal(by['2026-12-09'].start, '13:00')
  assert.equal(by['2026-12-01'].start, '10:00') // moved in from outside the window
  assert.equal(by['2026-12-07'], undefined)
})

test('allJobs merges live plans and booked one-offs only', () => {
  const jobs = allJobs({
    plans: [plan, { ...plan, id: 'p2', status: 'cancelled' }],
    changes: [],
    enquiries: [{ id: 'e1', status: 'booked', booked_date: '2026-11-24', booked_time: '10:00', est_hours: 4 }, { id: 'e2', status: 'replied', booked_date: '2026-11-24' }],
  }, '2026-11-23', '2026-11-29')
  assert.deepEqual(jobs.map((j) => j.key), ['plan:p1:2026-11-23:09:00', 'enq:e1'])
  assert.equal(jobs[1].end, '14:00')
})

test('service area matching', () => {
  assert.equal(inServiceArea(s, 'KA7 2DG'), true)
  assert.equal(inServiceArea(s, 'ka10 6aa'), true)
  assert.equal(inServiceArea(s, 'G1 1AA'), false)
  assert.equal(inServiceArea(s, 'KY1 1AA'), false)
  const tight = { serviceAreas: ['KA7', 'KA8'] }
  assert.equal(inServiceArea(tight, 'KA7 1AA'), true)
  assert.equal(inServiceArea(tight, 'KA70 1AA'), false)
  assert.equal(inServiceArea(tight, 'KA9 2AA'), false)
  assert.equal(inServiceArea({ serviceAreas: [] }, 'ZZ1 1ZZ'), true)
})

test('one-off estimates', () => {
  // standard 2 bed 1 bath: (1.5 + 1.5 + .75) = 3.75h × £22 = £82.50 → £75–£95
  const e = estimateOneOff(s, { property_type: 'house', clean_type: 'regular', bedrooms: 2, bathrooms: 1, extras: [] })
  assert.deepEqual(e, { hours: 4, lowPence: 7500, highPence: 9500 })
  const deep = estimateOneOff(s, { property_type: 'house', clean_type: 'deep', bedrooms: 2, bathrooms: 1, extras: ['oven'] })
  assert.ok(deep.lowPence > e.highPence)
  assert.equal(estimateOneOff(s, { property_type: 'office', clean_type: 'commercial' }), null)
  assert.equal(estimateOneOff(s, { property_type: 'flat', clean_type: 'regular', bedrooms: 0, bathrooms: 1, extras: [] }).lowPence, 5000) // minimum
})

test('deposits, discounts and skip credit', () => {
  assert.equal(depositFor(s, 9500), 2375)
  assert.equal(depositFor({ depositPercent: 0 }, 9500), 0)
  assert.equal(applyDiscount(10000, { percent_off: 10 }), 9000)
  assert.equal(applyDiscount(1000, { amount_off_pence: 1500 }), 0)
  assert.equal(planVisitValue(plan), 6000)
})

test('hoursUntil is roughly right', () => {
  const now = new Date('2026-11-23T08:00:00Z') // 8am UK in winter
  assert.equal(hoursUntil('2026-11-25', '09:00', now), 49)
})
