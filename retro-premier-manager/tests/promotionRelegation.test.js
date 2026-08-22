import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameReducer, makeInitialState, resolvePromotionRelegation, standingsToTable } from '../src/state/gameReducer.js'

// resolvePromotionRelegation is exercised directly with a hand-crafted
// standings table (strictly decreasing points per club, so ranking is
// unambiguous) rather than by playing out a live season - live match
// simulation is unseeded (Math.random), and a rollover-time sack for the
// player's own club intentionally short-circuits the whole league's
// promotion/relegation for that season, which would make a live-season
// version of this test flaky for reasons unrelated to what it's checking.
test('relegates the bottom 3 PL clubs, promotes the top 2 CH clubs automatically, and one of the play-off contenders', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })

  const plIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'PL')
  const chIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'CH')
  assert.equal(plIds.length, 20)
  assert.equal(chIds.length, 20)

  const standings = {}
  plIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (plIds.length - i) * 3 }
  })
  chIds.forEach((id, i) => {
    standings[id] = { played: 46, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (chIds.length - i) * 3 }
  })
  state = { ...state, standings }

  const plTable = standingsToTable(state.standings, plIds)
  const chTable = standingsToTable(state.standings, chIds)
  const expectedRelegated = plTable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = chTable.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = chTable.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolvePromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'CH', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'PL', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'PL')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  // League size is preserved overall.
  const plCountAfter = Object.values(clubs).filter((c) => c.division === 'PL').length
  const chCountAfter = Object.values(clubs).filter((c) => c.division === 'CH').length
  assert.equal(plCountAfter, 20)
  assert.equal(chCountAfter, 20)
})
