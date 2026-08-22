import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'
import { computeBonusPayout } from '../src/state/contracts.js'

function newGame(clubId = 'arsenal') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  return state
}

test('contract bonuses are stored on renewal acceptance', () => {
  const state = newGame()
  const player = state.squads.arsenal[0]

  const withBonus = gameReducer(state, {
    type: 'OFFER_CONTRACT',
    payload: { playerId: player.id, wage: player.wage, years: 3, goalBonus: 5000, assistBonus: 2000 },
  })
  const updated = withBonus.squads.arsenal.find((p) => p.id === player.id)
  assert.equal(updated.goalBonus, 5000)
  assert.equal(updated.assistBonus, 2000)
})

test('computeBonusPayout sums goal and assist bonuses for the relevant match', () => {
  const squad = [
    { id: 'a', goalBonus: 5000, assistBonus: 2000 },
    { id: 'b', goalBonus: 0, assistBonus: 0 },
    { id: 'c', goalBonus: 3000, assistBonus: 1000 },
  ]
  // 'a' scores twice, 'c' assists once and scores once; 'b' has no bonuses so is skipped entirely.
  const goals = [
    { scorerId: 'a', assistId: 'c' },
    { scorerId: 'a', assistId: null },
    { scorerId: 'c', assistId: null },
  ]
  const total = computeBonusPayout(squad, goals)
  // a: 2 goals * 5000 = 10000; c: 1 assist * 1000 + 1 goal * 3000 = 4000
  assert.equal(total, 14000)
})

test('computeBonusPayout ignores players with no bonus clauses even if they score', () => {
  const squad = [{ id: 'a', goalBonus: 0, assistBonus: 0 }]
  const goals = [{ scorerId: 'a', assistId: null }]
  assert.equal(computeBonusPayout(squad, goals), 0)
})
