import test from 'node:test'
import assert from 'node:assert/strict'
import { attentionFor, createBrief, formatPence, profileOf } from '../server/brief.js'
import { loadDemo } from '../server/demo.js'
import { withStore } from './helpers.js'

const TODAY = '2026-09-13'
const NOW = () => new Date('2026-09-13T08:00:00Z')
const offline = async () => { throw new Error('no network in tests') }

async function demoBrief(t, options = {}) {
  const store = await withStore(t)
  await loadDemo(store, TODAY)
  const brief = createBrief({ store, fetchImpl: offline, now: NOW })
  return { store, brief, result: await brief.build({ day: TODAY, includeNews: false, ...options }) }
}

test('a missing profile falls back to sensible defaults', () => {
  const profile = profileOf({})
  assert.equal(profile.timezone, 'Europe/London')
  assert.equal(profile.currency, 'GBP')
  assert.equal(profileOf({ currency: 'EUR' }).currency, 'EUR')
})

test('money reads the way a person writes it', () => {
  assert.equal(formatPence(120_000), '£1,200')
  assert.equal(formatPence(1_299), '£12.99')
  assert.equal(formatPence(-1_299), '−£12.99')
  assert.equal(formatPence(1_299, { signed: true }), '+£12.99')
  assert.equal(formatPence(0), '£0')
})

test('the brief assembles every panel for one day', async (t) => {
  const { result } = await demoBrief(t)
  assert.equal(result.today, TODAY)
  assert.equal(result.heading, 'Sunday 13 September')
  assert.match(result.greeting, /Good morning, Chris/)
  assert.ok(result.money)
  assert.ok(result.agenda)
  assert.ok(result.objectives)
  assert.ok(Array.isArray(result.attention))
})

test('the agenda groups the week by day', async (t) => {
  const { result } = await demoBrief(t)
  assert.deepEqual(result.agenda.today.map((entry) => entry.title), ['Five-a-side'])
  assert.equal(result.agenda.days[0].day, TODAY)
  assert.equal(result.agenda.days[0].relative, 'today')
  assert.ok(result.agenda.days.some((day) => day.entries.some((entry) => entry.title.startsWith('Quarterly review'))))
})

test('a broken calendar feed does not take the rest of the brief down', async (t) => {
  const store = await withStore(t)
  await loadDemo(store, TODAY)
  await store.add('feeds', { id: 'broken', name: 'Work', url: 'https://example.com/dead.ics' })
  const result = await createBrief({ store, fetchImpl: offline, now: NOW }).build({ day: TODAY, includeNews: false })

  assert.equal(result.agenda.problems.length, 1)
  assert.ok(result.money.openingPence > 0, 'money is unaffected')
  assert.deepEqual(result.agenda.today.map((entry) => entry.title), ['Five-a-side'])
})

test('the money panel answers "what leaves before payday"', async (t) => {
  const { result } = await demoBrief(t)
  const { runway } = result.money
  assert.equal(runway.payday.day, '2026-09-25')
  assert.ok(runway.outgoingCount > 0)
  assert.ok(runway.safeToSpendPence >= 0)
  assert.equal(result.money.openingPence, 214_300, 'savings are excluded from the forecast')
})

test('the money panel catches the three things a bill list cannot', async (t) => {
  const { result } = await demoBrief(t)
  const { reconciliation } = result.money

  assert.deepEqual(reconciliation.missing.map((entry) => entry.name), ['Water'])
  assert.deepEqual(reconciliation.changed.map((entry) => entry.name), ['British Gas'])
  assert.equal(reconciliation.unexpected.length, 1)
  assert.match(reconciliation.unexpected[0].description, /CLOUDSTORE/)
  assert.equal(reconciliation.unexpected[0].frequency, 'monthly')
})

test('objectives report what has stopped moving', async (t) => {
  const { result } = await demoBrief(t)
  assert.deepEqual(result.objectives.overdue.map((entry) => entry.title), ['Rewrite the services page'])
  assert.equal(result.objectives.active.length, 3)
  const clients = result.objectives.active.find((entry) => entry.title.startsWith('Land three'))
  assert.equal(clients.progress.label, '1 of 3')
})

test('the attention list is short, ordered and specific', async (t) => {
  const { result } = await demoBrief(t)
  assert.ok(result.attention.length <= 6, 'a long list of warnings is no list at all')

  const severities = result.attention.map((item) => ({ high: 0, medium: 1, low: 2 })[item.severity])
  assert.deepEqual([...severities].sort(), severities, 'worst first')
  assert.ok(result.attention.some((item) => /Water/.test(item.text)))
})

test('going overdrawn leads the attention list', () => {
  const attention = attentionFor({
    money: {
      breaches: [{ day: '2026-09-20', belowZero: true, trigger: 'Rent', balancePence: -5_000 }],
      reconciliation: { missing: [], changed: [], unexpected: [] },
    },
    plans: { overdue: [], stalled: [] },
    agenda: { entries: [] },
    today: TODAY,
  })
  assert.equal(attention[0].severity, 'high')
  assert.match(attention[0].text, /overdrawn on 20 September when Rent goes out/)
})

test('a stalled objective says how long and what is next', () => {
  const attention = attentionFor({
    money: { breaches: [], reconciliation: { missing: [], changed: [], unexpected: [] } },
    plans: {
      overdue: [],
      stalled: [{ title: 'Rewrite the services page', idleDays: 23, nextStep: { title: 'Get photographs taken' } }],
    },
    agenda: { entries: [] },
    today: TODAY,
  })
  assert.match(attention[0].text, /has not moved in 23 days.*Get photographs taken/)
})

test('a bill that went up is described in the right direction', () => {
  const attention = attentionFor({
    money: {
      breaches: [],
      reconciliation: {
        missing: [],
        changed: [{ name: 'British Gas', day: '2026-09-03', paidPence: -9_140, amountPence: -7_800, deltaPence: -1_340 }],
        unexpected: [],
      },
    },
    plans: { overdue: [], stalled: [] },
    agenda: { entries: [] },
    today: TODAY,
  })
  assert.match(attention[0].text, /British Gas came out higher than expected — −£91.40 against −£78/)
})

test('a quiet day produces an empty attention list rather than filler', () => {
  const attention = attentionFor({
    money: { breaches: [], reconciliation: { missing: [], changed: [], unexpected: [] } },
    plans: { overdue: [], stalled: [] },
    agenda: { entries: [] },
    today: TODAY,
  })
  assert.deepEqual(attention, [])
})

test('an empty dashboard builds without error', async (t) => {
  const store = await withStore(t)
  const result = await createBrief({ store, fetchImpl: offline, now: NOW }).build({ day: TODAY })
  assert.equal(result.money.openingPence, 0)
  assert.deepEqual(result.agenda.today, [])
  assert.deepEqual(result.news.items, [])
  assert.deepEqual(result.attention, [])
})

test('the brief works fully offline', async (t) => {
  // Every network call fails; the brief should still be complete and honest.
  const store = await withStore(t)
  await loadDemo(store, TODAY)
  await store.add('targets', { id: 't', name: 'Acme Trading', kind: 'company' })
  const result = await createBrief({ store, fetchImpl: offline, now: NOW }).build({ day: TODAY })

  assert.ok(result.money.runway.payday)
  assert.ok(result.agenda.today.length > 0)
  assert.deepEqual(result.news.items, [])
  assert.ok(result.news.problems.length > 0, 'the failure is reported, not hidden')
})
