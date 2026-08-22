import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'

function newGame(clubId = 'arsenal') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  return state
}

test('a loaned-out player joins the borrowing club and auto-returns when the loan expires', () => {
  const state = newGame()
  const fringe = state.squads.arsenal.find((p) => p.position === 'MF')
  const loanClubId = Object.keys(state.clubs).find((id) => state.clubs[id].division === 'CH' && id !== 'arsenal')

  const loaned = gameReducer(state, { type: 'LOAN_OUT_PLAYER', payload: { playerId: fringe.id, clubId: loanClubId, weeks: 6 } })
  assert.ok(!loaned.squads.arsenal.some((p) => p.id === fringe.id), 'player should leave the parent squad while on loan')
  const onLoan = loaned.squads[loanClubId].find((p) => p.id === fringe.id)
  assert.ok(onLoan, 'player should appear in the borrowing club squad')
  assert.equal(onLoan.loanFromClubId, 'arsenal')
  assert.equal(onLoan.loanWeeksRemaining, 6)

  let ticking = loaned
  for (let i = 0; i < 5; i++) ticking = gameReducer(ticking, { type: 'ADVANCE_WEEK' })
  assert.ok(ticking.squads[loanClubId].some((p) => p.id === fringe.id), 'should still be on loan after 5 of 6 weeks')

  const afterExpiry = gameReducer(ticking, { type: 'ADVANCE_WEEK' })
  assert.ok(afterExpiry.squads.arsenal.some((p) => p.id === fringe.id), 'player should auto-return to the parent club after the 6th week')
  assert.ok(!afterExpiry.squads[loanClubId].some((p) => p.id === fringe.id))
  const returned = afterExpiry.squads.arsenal.find((p) => p.id === fringe.id)
  assert.equal(returned.loanFromClubId, null)
  assert.equal(returned.loanWeeksRemaining, 0)
})

test('a loaned-out player can be recalled early', () => {
  const state = newGame()
  const fringe = state.squads.arsenal.find((p) => p.position === 'MF')
  const loanClubId = Object.keys(state.clubs).find((id) => state.clubs[id].division === 'CH' && id !== 'arsenal')

  const loaned = gameReducer(state, { type: 'LOAN_OUT_PLAYER', payload: { playerId: fringe.id, clubId: loanClubId, weeks: 10 } })
  assert.ok(!loaned.squads.arsenal.some((p) => p.id === fringe.id), 'setup: player should be on loan')

  const recalled = gameReducer(loaned, { type: 'RECALL_LOAN', payload: { playerId: fringe.id } })
  assert.ok(recalled.squads.arsenal.some((p) => p.id === fringe.id), 'player should return immediately on recall')
})
