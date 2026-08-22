import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickPersonality,
  PERSONALITIES,
  moraleSwingMultiplier,
  injuryChanceMultiplier,
  cardChanceMultiplier,
  formVarianceMultiplier,
  isLeader,
} from '../src/state/personality.js'
import { pushFormRating } from '../src/state/form.js'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'

test('pickPersonality always returns a known key and respects the rng roll', () => {
  // rng() = 0 should always land on the first-weighted entry (balanced);
  // rng() close to 1 should land on the last entry (leader).
  assert.equal(pickPersonality(() => 0), 'balanced')
  assert.equal(pickPersonality(() => 0.9999), 'leader')
  for (let i = 0; i < 50; i++) {
    const key = pickPersonality(() => i / 50)
    assert.ok(Object.keys(PERSONALITIES).includes(key))
  }
})

test('every generated player has a valid personality key', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  for (const p of state.squads.arsenal) {
    assert.ok(Object.keys(PERSONALITIES).includes(p.personality), `${p.name} has an unknown personality: ${p.personality}`)
  }
})

test('multiplier helpers only special-case their own trait', () => {
  assert.equal(moraleSwingMultiplier('model-professional'), 0.6)
  assert.equal(moraleSwingMultiplier('temperamental'), 1.5)
  assert.equal(moraleSwingMultiplier('balanced'), 1)
  assert.equal(injuryChanceMultiplier('injury-prone'), 1.6)
  assert.equal(injuryChanceMultiplier('balanced'), 1)
  assert.equal(cardChanceMultiplier('temperamental'), 1.5)
  assert.equal(cardChanceMultiplier('balanced'), 1)
  assert.equal(formVarianceMultiplier('inconsistent'), 1.5)
  assert.equal(formVarianceMultiplier('balanced'), 1)
  assert.equal(isLeader('leader'), true)
  assert.equal(isLeader('balanced'), false)
})

test('pushFormRating widens the stored value away from baseline for an inconsistent player, and leaves a balanced one untouched', () => {
  const inconsistent = { personality: 'inconsistent', formHistory: [] }
  const balanced = { personality: 'balanced', formHistory: [] }
  const rating = 8.0 // 2.0 above the 6.0 baseline

  const after1 = pushFormRating(inconsistent, rating)
  const after2 = pushFormRating(balanced, rating)

  assert.equal(after2.formHistory[0], rating, 'a balanced player\'s rating should pass through unchanged')
  assert.ok(after1.formHistory[0] > rating, 'an inconsistent player\'s above-baseline rating should be pushed further from baseline')
})
