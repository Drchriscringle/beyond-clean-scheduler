import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'
import { isRevealed } from '../src/state/scouting.js'

function newGame(clubId = 'arsenal') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  return state
}

test('inherited squad starts scouted, other clubs start hidden', () => {
  const state = newGame()
  assert.ok(state.squads.arsenal.every((p) => p.scouted === true))
  assert.ok(state.squads['man-city'].every((p) => p.scouted === false))
  assert.ok(state.squads['man-city'].every((p) => !isRevealed(p)))
  assert.ok(state.freeAgents.every((p) => !isRevealed(p)))
})

test('commissioning a scouting report reveals only the targeted player and debits the bank', () => {
  const state = newGame()
  const target = state.squads['man-city'][0]
  const bankBefore = state.clubs.arsenal.bankBalance

  const scouted = gameReducer(state, { type: 'SCOUT_PLAYER', payload: { playerId: target.id, clubId: 'man-city' } })
  const scoutedPlayer = scouted.squads['man-city'].find((p) => p.id === target.id)
  assert.equal(scoutedPlayer.scouted, true)
  assert.ok(isRevealed(scoutedPlayer))
  assert.equal(scouted.clubs.arsenal.bankBalance, bankBefore - 25_000)
  assert.ok(scouted.squads['man-city'].filter((p) => p.id !== target.id).every((p) => !p.scouted), 'other players should be unaffected')
})

test('buying a player or signing a free agent auto-reveals them', () => {
  const state = newGame()
  const buyTarget = state.squads['man-city'].find((p) => !p.scouted)
  const bought = gameReducer(state, { type: 'MAKE_OFFER', payload: { playerId: buyTarget.id, fromClubId: 'man-city', fee: 30_000_000 } })
  const ownedPlayer = bought.squads.arsenal.find((p) => p.id === buyTarget.id)
  assert.ok(ownedPlayer, 'setup: offer should be accepted at this fee')
  assert.equal(ownedPlayer.scouted, true)

  const freeAgent = state.freeAgents[0]
  const signed = gameReducer(state, { type: 'SIGN_FREE_AGENT', payload: { playerId: freeAgent.id, contractYears: 2 } })
  const signedPlayer = signed.squads.arsenal.find((p) => p.id === freeAgent.id)
  assert.equal(signedPlayer.scouted, true)
})

test('scouting is rejected without enough funds and makes no change', () => {
  const state = newGame()
  const target = state.squads['man-city'][1]
  const poorState = { ...state, clubs: { ...state.clubs, arsenal: { ...state.clubs.arsenal, bankBalance: 1000 } } }
  const rejected = gameReducer(poorState, { type: 'SCOUT_PLAYER', payload: { playerId: target.id, clubId: 'man-city' } })
  assert.ok(rejected.notice.includes('Not enough'))
  assert.equal(rejected.squads['man-city'].find((p) => p.id === target.id).scouted, false)
})
