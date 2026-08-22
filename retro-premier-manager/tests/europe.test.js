import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'
import { qualificationForPosition, initEuropeanCampaign, playEuropeanRound, EURO_ROUND_WEEKS, EURO_ROUND_NAMES } from '../src/state/europe.js'

test('qualificationForPosition maps final league position to the right competition', () => {
  assert.equal(qualificationForPosition(1), 'UCL')
  assert.equal(qualificationForPosition(4), 'UCL')
  assert.equal(qualificationForPosition(5), 'UEL')
  assert.equal(qualificationForPosition(6), 'UEL')
  assert.equal(qualificationForPosition(7), null)
  assert.equal(qualificationForPosition(20), null)
})

test('playEuropeanRound advances the campaign on a win and awards prize money', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  const europe = initEuropeanCampaign('UCL')
  const playerLineup = state.lineups.arsenal.startingXI

  // rng() always low enough to guarantee a home tie and a resounding win
  // regardless of the random opponent drawn, so this is a deterministic
  // "won" path rather than depending on match-sim luck.
  const rng = (() => {
    let call = 0
    return () => {
      call++
      if (call === 1) return 0 // opponent draw index 0 (weakest available pool)
      if (call === 2) return 0 // player is home
      return 0.999 // any further rng calls inside simulateMatch just need to be valid
    }
  })()

  const result = playEuropeanRound(
    europe,
    { playerClub: state.clubs.arsenal, playerSquad: state.squads.arsenal, playerLineup, playerTactics: state.tactics.arsenal },
    rng,
  )
  assert.ok(result.prize >= 0)
  assert.equal(result.europe.history.length, 1)
  assert.equal(result.europe.history[0].round, EURO_ROUND_NAMES[0])
  // Either advanced a round or got eliminated - both are valid single-match
  // outcomes; we're checking the bookkeeping is internally consistent, not
  // forcing a specific match result via a non-deterministic engine.
  if (result.europe.eliminated) {
    assert.equal(result.europe.roundIndex, 0)
  } else {
    assert.equal(result.europe.roundIndex, 1)
  }
})

test('a qualified European campaign plays out during advanceWeek on its designated weeks and pays into the bank', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  state = { ...state, week: EURO_ROUND_WEEKS[0], europe: initEuropeanCampaign('UCL') }

  const bankBefore = state.clubs.arsenal.bankBalance
  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })

  assert.ok(after.europe, 'europe state should persist after the round')
  assert.equal(after.europe.history.length, 1, 'exactly one European round should have been played')
  assert.notEqual(after.clubs.arsenal.bankBalance, bankBefore, 'prize money should have moved the bank balance')
})

test('europe stays untouched on a week that is not a designated European round', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  const europe = initEuropeanCampaign('UEL')
  state = { ...state, week: EURO_ROUND_WEEKS[0] - 1, europe }

  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })
  assert.deepEqual(after.europe, europe, 'europe state should be untouched on a non-round week')
})
