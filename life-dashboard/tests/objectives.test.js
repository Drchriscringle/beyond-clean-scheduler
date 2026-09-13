import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completeStep, createObjective, daysSinceMoved, nextStep, progressOf, review, touch,
} from '../server/objectives.js'

const TODAY = '2026-09-13'
const daysAgo = (days) => new Date(Date.parse(`${TODAY}T09:00:00Z`) - days * 86_400_000).toISOString()

test('an objective takes sensible defaults', () => {
  const objective = createObjective({ title: 'Land three retainer clients' })
  assert.equal(objective.horizon, 'quarter')
  assert.equal(objective.state, 'active')
  assert.deepEqual(objective.steps, [])
  assert.ok(objective.lastMovedAt)
})

test('a nonsense horizon or state falls back rather than being stored', () => {
  const objective = createObjective({ title: 'X', horizon: 'eventually', state: 'vibes' })
  assert.equal(objective.horizon, 'quarter')
  assert.equal(objective.state, 'active')
})

test('progress prefers a real metric over counting steps', () => {
  const objective = createObjective({
    title: 'Clients',
    metric: { name: 'clients', start: 2, current: 8, goal: 12, unit: '' },
    steps: [{ title: 'a', done: true }, { title: 'b' }, { title: 'c' }, { title: 'd' }],
  })
  const progress = progressOf(objective)
  assert.equal(progress.kind, 'metric')
  assert.equal(progress.fraction, 0.6) // 6 of the 10 needed
  assert.equal(progress.label, '8 of 12')
})

test('progress falls back to steps when there is no metric', () => {
  const objective = createObjective({ title: 'X', steps: [{ title: 'a', done: true }, { title: 'b' }] })
  assert.deepEqual(progressOf(objective), { kind: 'steps', fraction: 0.5, label: '1 of 2 steps' })
})

test('progress past the goal does not exceed complete', () => {
  const objective = createObjective({ title: 'X', metric: { start: 0, current: 15, goal: 10 } })
  assert.equal(progressOf(objective).fraction, 1)
})

test('an objective with nothing to measure reports nothing rather than zero-of-zero', () => {
  assert.deepEqual(progressOf(createObjective({ title: 'X' })), { kind: 'none', fraction: 0, label: null })
})

test('the next step is the soonest-due unfinished one', () => {
  const objective = createObjective({
    title: 'X',
    steps: [
      { id: 's1', title: 'Done thing', done: true },
      { id: 's2', title: 'Later', dueOn: '2026-10-01' },
      { id: 's3', title: 'Sooner', dueOn: '2026-09-15' },
    ],
  })
  assert.equal(nextStep(objective).id, 's3')
})

test('with every step done there is no next step', () => {
  const objective = createObjective({ title: 'X', steps: [{ id: 's1', title: 'a', done: true }] })
  assert.equal(nextStep(objective), null)
})

test('ticking a step records that the objective moved', () => {
  const objective = { ...createObjective({ title: 'X', steps: [{ id: 's1', title: 'a' }] }), lastMovedAt: daysAgo(30) }
  const updated = completeStep(objective, 's1', true, new Date(`${TODAY}T10:00:00Z`))
  assert.equal(updated.steps[0].done, true)
  assert.ok(updated.steps[0].doneAt)
  assert.equal(daysSinceMoved(updated, TODAY), 0)
})

test('ticking a step that was already ticked does not reset the clock', () => {
  const objective = { ...createObjective({ title: 'X', steps: [{ id: 's1', title: 'a', done: true }] }), lastMovedAt: daysAgo(30) }
  const updated = completeStep(objective, 's1', true)
  assert.equal(daysSinceMoved(updated, TODAY), 30)
})

test('an objective that has not moved in a fortnight is stalled', () => {
  const plans = review(
    [
      { ...createObjective({ title: 'Moving' }), id: 'a', lastMovedAt: daysAgo(3) },
      { ...createObjective({ title: 'Stuck' }), id: 'b', lastMovedAt: daysAgo(21) },
    ],
    TODAY,
  )
  assert.deepEqual(plans.stalled.map((entry) => entry.title), ['Stuck'])
  assert.equal(plans.stalled[0].idleDays, 21)
})

test('a finished or parked objective is never called stalled', () => {
  const plans = review(
    [
      { ...createObjective({ title: 'Finished', state: 'done' }), id: 'a', lastMovedAt: daysAgo(90) },
      { ...createObjective({ title: 'Parked', state: 'parked' }), id: 'b', lastMovedAt: daysAgo(90) },
    ],
    TODAY,
  )
  assert.deepEqual(plans.stalled, [])
})

test('an overdue objective is overdue, not merely stalled', () => {
  const plans = review(
    [{ ...createObjective({ title: 'Late', dueOn: '2026-09-01' }), id: 'a', lastMovedAt: daysAgo(30) }],
    TODAY,
  )
  assert.equal(plans.overdue.length, 1)
  assert.equal(plans.stalled.length, 0, 'overdue is the more useful label of the two')
  assert.equal(plans.overdue[0].dueLabel, '12 days ago')
})

test('an objective due within a fortnight is flagged early', () => {
  const plans = review(
    [
      { ...createObjective({ title: 'Soon', dueOn: '2026-09-20' }), id: 'a' },
      { ...createObjective({ title: 'Far off', dueOn: '2026-12-20' }), id: 'b' },
    ],
    TODAY,
  )
  assert.deepEqual(plans.dueSoon.map((entry) => entry.title), ['Soon'])
})

test('an objective with a step due today claims today', () => {
  const plans = review(
    [
      { ...createObjective({ title: 'Today', steps: [{ id: 's', title: 'Call the bank', dueOn: TODAY }] }), id: 'a' },
      { ...createObjective({ title: 'Later', steps: [{ id: 's', title: 'Next week', dueOn: '2026-09-30' }] }), id: 'b' },
    ],
    TODAY,
  )
  assert.deepEqual(plans.onToday.map((entry) => entry.title), ['Today'])
  assert.equal(plans.onToday[0].nextStep.title, 'Call the bank')
})

test('touching an objective updates when it last moved', () => {
  const before = { ...createObjective({ title: 'X' }), lastMovedAt: daysAgo(10) }
  assert.equal(daysSinceMoved(touch(before, new Date(`${TODAY}T09:00:00Z`)), TODAY), 0)
})

test('reviewing nothing gives empty lists rather than failing', () => {
  const plans = review([], TODAY)
  assert.deepEqual(plans.active, [])
  assert.deepEqual(plans.stalled, [])
})
