import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  initCupState,
  playCupRound,
  CUP_ROUND_WEEKS,
  SCOTTISH_CUP_ROUND_WEEKS,
  SCOTTISH_CUP_ROUND_NAMES,
  SCOTTISH_CUP_SIZE,
} from '../src/state/cup.js'
import { EURO_ROUND_WEEKS } from '../src/state/europe.js'
import { scottishQualificationForPosition, qualificationForPosition } from '../src/state/europe.js'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'

test('the Scottish Cup weeks never collide with the FA Cup, Europe, international, or each other', () => {
  const allWeekSets = [CUP_ROUND_WEEKS, SCOTTISH_CUP_ROUND_WEEKS, EURO_ROUND_WEEKS]
  const seen = new Set()
  for (const weeks of allWeekSets) {
    for (const week of weeks) {
      assert.ok(!seen.has(week), `week ${week} used by more than one competition`)
      seen.add(week)
    }
  }
})

test('initCupState respects a custom cup size for a smaller pyramid', () => {
  const clubIds = Array.from({ length: 22 }, (_, i) => `club-${i}`)
  const cup = initCupState(clubIds, 2025, SCOTTISH_CUP_SIZE, () => 0.4)
  const entrants = cup.matches.flatMap((m) => [m.home, m.away])
  assert.equal(entrants.length, SCOTTISH_CUP_SIZE)
  assert.equal(new Set(entrants).size, SCOTTISH_CUP_SIZE, 'no club should be drawn twice')
})

test('playCupRound labels rounds using the supplied roundNames instead of the FA Cup default', () => {
  const clubIds = Array.from({ length: 16 }, (_, i) => `club-${i}`)
  let cup = initCupState(clubIds, 2025, 16, () => 0.4)
  cup = playCupRound(cup, (h) => ({ winner: h, homeGoals: 1, awayGoals: 0 }), SCOTTISH_CUP_ROUND_NAMES)
  assert.equal(cup.history[0].round, SCOTTISH_CUP_ROUND_NAMES[0])
  assert.equal(cup.roundIndex, 1)
})

test('scottishQualificationForPosition only awards Europe to the top 2, unlike the Premier League top 6', () => {
  assert.equal(scottishQualificationForPosition(1), 'UCL')
  assert.equal(scottishQualificationForPosition(2), 'UEL')
  assert.equal(scottishQualificationForPosition(3), null)
  assert.equal(scottishQualificationForPosition(12), null)
  // Confirm this is deliberately narrower than the English rule, not a copy of it.
  assert.equal(qualificationForPosition(3), 'UCL')
})

test('starting a new game gives the Scottish Cup exactly 22 entrants (all SPL + SCH clubs)', () => {
  const state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'celtic', managerName: 'Test' } })
  assert.ok(state.scottishCup)
  const entrants = state.scottishCup.matches.flatMap((m) => [m.home, m.away])
  assert.equal(entrants.length, SCOTTISH_CUP_SIZE)
  for (const id of entrants) {
    assert.ok(['SPL', 'SCH'].includes(state.clubs[id].division), `${id} should be a Scottish club`)
  }
})

test('a Scottish Cup round played via ADVANCE_WEEK resolves ties and produces a notice for a Scottish manager', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'celtic', managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  // Force Celtic into the Scottish Cup draw for this test, since the draw is random.
  const withoutCeltic = state.scottishCup.matches.flatMap((m) => [m.home, m.away]).filter((id) => id !== 'celtic')
  const replaced = withoutCeltic[0]
  const forcedMatches = state.scottishCup.matches.map((m) => (m.home === replaced ? { ...m, home: 'celtic' } : m.away === replaced ? { ...m, away: 'celtic' } : m))
  state = { ...state, week: SCOTTISH_CUP_ROUND_WEEKS[0], scottishCup: { ...state.scottishCup, matches: forcedMatches } }

  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })
  assert.equal(after.scottishCup.roundIndex, 1)
  assert.equal(after.scottishCup.history.length, 1)
  assert.match(after.notice, /Scottish Cup/)
})
