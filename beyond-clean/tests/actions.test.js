import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS as s } from '../supabase/functions/_shared/pricing.js'
import { decidePlanAction } from '../supabase/functions/_shared/actions.js'

// Monday 23 Nov 2026, 08:00 UK
const now = new Date('2026-11-23T08:00:00Z')
const plan = { id: 'p1', status: 'active', start_date: '2026-11-01', visits_per_week: 1, hours_per_visit: 3, slots: [{ day: 3, start: '09:00' }], monthly_pence: 26000 }

test('skip with notice is credited, short notice is not', () => {
  const ok = decidePlanAction(s, plan, [], { action: 'skip', date: '2026-12-02', start: '09:00' }, now)
  assert.equal(ok.inserts[0].credit_pence, 6000)
  assert.deepEqual(ok.balance, [{ amount: -6000, description: 'Skipped clean 2026-12-02' }])
  const late = decidePlanAction(s, plan, [], { action: 'skip', date: '2026-11-25', start: '09:00' }, new Date('2026-11-24T20:00:00Z'))
  assert.equal(late.inserts[0].credit_pence, 0)
  assert.equal(late.balance.length, 0)
  assert.match(decidePlanAction(s, plan, [], { action: 'skip', date: '2026-11-26', start: '09:00' }, now).error, /not on your schedule/)
})

test('unskip gives the credit back', () => {
  const changes = [{ id: 'c1', kind: 'skip', visit_date: '2026-12-02', visit_start: '09:00', credit_pence: 6000 }]
  const r = decidePlanAction(s, plan, changes, { action: 'unskip', date: '2026-12-02', start: '09:00' }, now)
  assert.deepEqual(r.deletes, ['c1'])
  assert.equal(r.balance[0].amount, 6000)
})

test('pause skips every clean in the range', () => {
  const r = decidePlanAction(s, plan, [], { action: 'pause', from: '2026-11-28', to: '2026-12-12' }, now)
  assert.deepEqual(r.inserts.map((i) => i.visit_date), ['2026-12-02', '2026-12-09'])
  assert.equal(r.balance[0].amount, -12000)
  assert.match(decidePlanAction(s, plan, [], { action: 'pause', from: '2026-12-01', to: '2027-03-01' }, now).error, /8 weeks/)
})

test('move requests and extras', () => {
  const m = decidePlanAction(s, plan, [], { action: 'move', date: '2026-12-02', start: '09:00', newDate: '2026-12-03', newTime: '13:00' }, now)
  assert.equal(m.inserts[0].status, 'requested')
  assert.match(decidePlanAction(s, plan, [], { action: 'move', date: '2026-12-02', start: '09:00', newDate: '2027-01-30' }, now).error, /2 weeks/)
  const e = decidePlanAction(s, plan, [], { action: 'extra', date: '2026-12-02', start: '09:00', extraId: 'oven', extraLabel: 'Oven clean' }, now)
  assert.equal(e.invoiceItems[0].amount, 4500)
  const dup = decidePlanAction(s, plan, [{ kind: 'extra', visit_date: '2026-12-02', visit_start: '09:00', extra_id: 'oven', amount_pence: 4500 }],
    { action: 'extra', date: '2026-12-02', start: '09:00', extraId: 'oven' }, now)
  assert.match(dup.error, /already/)
  // Skipping a clean with an extra credits the extra too.
  const sk = decidePlanAction(s, plan, [{ kind: 'extra', visit_date: '2026-12-02', visit_start: '09:00', extra_id: 'oven', amount_pence: 4500 }],
    { action: 'skip', date: '2026-12-02', start: '09:00' }, now)
  assert.equal(sk.inserts[0].credit_pence, 10500)
})

test('inactive plans cannot be changed', () => {
  assert.match(decidePlanAction(s, { ...plan, status: 'cancelled' }, [], { action: 'skip' }, now).error, /not active/)
})
