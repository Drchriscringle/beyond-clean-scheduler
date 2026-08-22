import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INTERNATIONAL_WEEKS,
  isEligibleForInternationalJob,
  maybeOfferInternationalJob,
  initInternationalJob,
  playInternationalFixture,
} from '../src/state/international.js'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'

test('eligibility requires either high club reputation or a league title', () => {
  assert.equal(isEligibleForInternationalJob({ reputation: 3, wonLeagueTitle: false }), false)
  assert.equal(isEligibleForInternationalJob({ reputation: 4, wonLeagueTitle: false }), true)
  assert.equal(isEligibleForInternationalJob({ reputation: 2, wonLeagueTitle: true }), true)
})

test('maybeOfferInternationalJob never offers if already appointed or not eligible', () => {
  assert.equal(maybeOfferInternationalJob({ alreadyHasJob: true, eligible: true, rng: () => 0 }), false)
  assert.equal(maybeOfferInternationalJob({ alreadyHasJob: false, eligible: false, rng: () => 0 }), false)
  assert.equal(maybeOfferInternationalJob({ alreadyHasJob: false, eligible: true, rng: () => 0 }), true)
  assert.equal(maybeOfferInternationalJob({ alreadyHasJob: false, eligible: true, rng: () => 0.99 }), false)
})

function newGame(clubId = 'man-city') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  return state
}

test('playInternationalFixture produces a valid, tallied result', () => {
  const state = newGame()
  const international = initInternationalJob(state.season)
  const result = playInternationalFixture(
    international,
    {
      playerSquad: state.squads['man-city'],
      playerLineup: state.lineups['man-city'].startingXI,
      playerTactics: state.tactics['man-city'],
    },
    () => 0.3,
  )

  assert.equal(result.international.played, 1)
  const total = result.international.won + result.international.drawn + result.international.lost
  assert.equal(total, 1)
  assert.equal(result.international.form.length, 1)
  assert.ok(result.notice.startsWith('England '))
  assert.ok(result.international.lastResult.opponent.length > 0)
})

test('accepting an England offer through the reducer starts a job, and ADVANCE_WEEK on an international week auto-resolves a fixture', () => {
  let state = newGame()
  state = { ...state, internationalOffer: true }
  state = gameReducer(state, { type: 'RESPOND_TO_INTERNATIONAL_OFFER', payload: { accept: true } })
  assert.ok(state.international, 'accepting should start the international job')
  assert.equal(state.internationalOffer, false)

  // advanceWeek resolves the fixture for whichever week is *currently* in
  // state.week (it advances state.week to the next value only afterward),
  // so the state must already sit on the international week itself.
  state = { ...state, week: INTERNATIONAL_WEEKS[0] }
  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })
  assert.equal(after.international.played, 1, 'advancing into an international week should auto-resolve exactly one fixture')
})

test('declining an offer leaves no job, and resigning clears an active one', () => {
  let state = newGame()
  state = { ...state, internationalOffer: true }
  const declined = gameReducer(state, { type: 'RESPOND_TO_INTERNATIONAL_OFFER', payload: { accept: false } })
  assert.equal(declined.international, null)
  assert.equal(declined.internationalOffer, false)

  const accepted = gameReducer(state, { type: 'RESPOND_TO_INTERNATIONAL_OFFER', payload: { accept: true } })
  const resigned = gameReducer(accepted, { type: 'RESIGN_INTERNATIONAL' })
  assert.equal(resigned.international, null)
})
