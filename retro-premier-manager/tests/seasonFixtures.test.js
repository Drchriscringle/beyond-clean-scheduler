import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'

test('ADVANCE_WEEK stamps results onto the season-long fixtures list, leaving future weeks untouched', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })

  const week1 = state.fixtures.find((f) => f.week === 1)
  for (const m of week1.matches) assert.equal(m.homeGoals, undefined, 'no fixture should have a result before any week is played')

  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })

  const playedWeek1 = after.fixtures.find((f) => f.week === 1)
  for (const m of playedWeek1.matches) {
    const expected = after.weekResults.find((r) => r.home === m.home && r.away === m.away)
    assert.ok(expected, `no weekResults entry found for ${m.home} vs ${m.away}`)
    assert.equal(m.homeGoals, expected.homeGoals)
    assert.equal(m.awayGoals, expected.awayGoals)
  }

  const stillUpcomingWeek2 = after.fixtures.find((f) => f.week === 2)
  for (const m of stillUpcomingWeek2.matches) assert.equal(m.homeGoals, undefined, 'week 2 should still be unplayed')
})
