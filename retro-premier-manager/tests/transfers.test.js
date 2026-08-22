import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'
import { estimatePlayerValue } from '../src/state/finance.js'

function newGame(clubId = 'arsenal') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  return state
}

test('a part-exchange makeweight and sell-on clause can turn a rejected cash offer into an accepted one', () => {
  const state = newGame()
  const target = [...state.squads['man-city']].sort((a, b) => estimatePlayerValue(b) - estimatePlayerValue(a))[0]
  const cashOnlyFee = Math.round(estimatePlayerValue(target) * 0.6)

  const cashOnlyResult = gameReducer(state, { type: 'MAKE_OFFER', payload: { playerId: target.id, fromClubId: 'man-city', fee: cashOnlyFee } })
  assert.ok(!cashOnlyResult.squads.arsenal.some((p) => p.id === target.id), 'a lowball cash-only offer should be rejected')

  const makeweight = state.squads.arsenal.find((p) => p.id !== target.id)
  const negotiated = gameReducer(state, {
    type: 'MAKE_OFFER',
    payload: { playerId: target.id, fromClubId: 'man-city', fee: cashOnlyFee, swapPlayerIds: [makeweight.id], sellOnPercent: 20 },
  })
  const acquired = negotiated.squads.arsenal.find((p) => p.id === target.id)
  assert.ok(acquired, 'the same cash fee plus a makeweight and sell-on clause should be accepted')
  assert.ok(negotiated.squads['man-city'].some((p) => p.id === makeweight.id), 'the makeweight should move to the selling club')
  assert.deepEqual(acquired.sellOnClauses, [{ clubId: 'man-city', percent: 20 }])
})

test('a sell-on clause pays out to the clause-holder on every future resale', () => {
  let state = newGame()
  const target = [...state.squads['man-city']].sort((a, b) => estimatePlayerValue(b) - estimatePlayerValue(a))[0]
  const fee = Math.round(estimatePlayerValue(target) * 0.6)
  const makeweight = state.squads.arsenal.find((p) => p.id !== target.id)

  state = gameReducer(state, {
    type: 'MAKE_OFFER',
    payload: { playerId: target.id, fromClubId: 'man-city', fee, swapPlayerIds: [makeweight.id], sellOnPercent: 20 },
  })
  assert.ok(state.squads.arsenal.some((p) => p.id === target.id), 'setup: player should be acquired with a clause attached')

  const resaleFee = 40_000_000
  const mcBankBefore = state.clubs['man-city'].bankBalance
  const arsenalBankBefore = state.clubs.arsenal.bankBalance
  const withOffer = { ...state, incomingOffers: [{ id: 'test-offer', playerId: target.id, playerName: target.name, fromClubId: 'chelsea', fee: resaleFee, week: state.week }] }
  const afterResale = gameReducer(withOffer, { type: 'RESPOND_TO_OFFER', payload: { offerId: 'test-offer', accept: true } })

  const expectedCut = Math.round(resaleFee * 0.2)
  assert.equal(afterResale.clubs['man-city'].bankBalance, mcBankBefore + expectedCut)
  assert.equal(afterResale.clubs.arsenal.bankBalance, arsenalBankBefore + (resaleFee - expectedCut))
})
