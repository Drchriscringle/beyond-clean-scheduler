import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDeadlineDay, isTransferWindowOpen, SUMMER_WINDOW_WEEKS, WINTER_WINDOW_WEEKS } from '../src/state/transferWindows.js'
import { aiTransferTick } from '../src/state/aiTransfers.js'
import { maybeGenerateOffer, generateDeadlineDayOffers } from '../src/state/incomingOffers.js'
import { gameReducer, makeInitialState } from '../src/state/gameReducer.js'
import { mulberry32 } from '../src/data/generateSquad.js'

test('isDeadlineDay is true only on the last week of each window', () => {
  assert.equal(isDeadlineDay(SUMMER_WINDOW_WEEKS[SUMMER_WINDOW_WEEKS.length - 1]), true)
  assert.equal(isDeadlineDay(WINTER_WINDOW_WEEKS[WINTER_WINDOW_WEEKS.length - 1]), true)
  for (const week of SUMMER_WINDOW_WEEKS.slice(0, -1)) assert.equal(isDeadlineDay(week), false)
  for (const week of WINTER_WINDOW_WEEKS.slice(0, -1)) assert.equal(isDeadlineDay(week), false)
  assert.equal(isDeadlineDay(10), false)
  assert.equal(isDeadlineDay(30), false)
})

test('aiTransferTick fires far more often on deadline day than a normal week', () => {
  // A 0.1 roll clears the deadline-day gate (ACTIVITY_CHANCE * 4 = 0.32) but not
  // the normal-week gate (ACTIVITY_CHANCE = 0.08), so the club is skipped entirely
  // on a normal week and attempted on deadline day.
  const gatingRng = () => 0.1
  const bigSquad = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, position: 'MF', age: 30, ability: 60, form: [] }))
  const clubs = { chelsea: { name: 'Chelsea' } }
  const squads = { chelsea: bigSquad }

  const normal = aiTransferTick({ clubs, squads, freeAgents: [], playerClubId: 'arsenal', week: 2, windowOpen: true, isDeadlineDay: false, rng: gatingRng })
  const deadline = aiTransferTick({ clubs, squads, freeAgents: [], playerClubId: 'arsenal', week: 4, windowOpen: true, isDeadlineDay: true, rng: gatingRng })

  assert.equal(normal.events.length, 0, 'a 0.1 roll should not clear the normal ACTIVITY_CHANCE of 0.08')
  assert.equal(deadline.events.length, 1, 'the same 0.1 roll should clear the deadline-day ACTIVITY_CHANCE of 0.32')
  assert.equal(deadline.events[0].outcome, 'released')
})

function makeListedSquad(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `listed-${i}`,
    name: `Listed Player ${i}`,
    position: 'FW',
    age: 26,
    ability: 70,
    wage: 10000,
    listed: true,
  }))
}

test('maybeGenerateOffer never returns more than one offer, generateDeadlineDayOffers can return several', () => {
  const squad = makeListedSquad(5)
  const clubIds = ['arsenal', 'chelsea', 'man-city', 'liverpool']

  const single = maybeGenerateOffer({ squad, clubIds, playerClubId: 'arsenal', week: 2, rng: () => 0.01 })
  assert.ok(single, 'a low roll should produce an offer')
  assert.equal(typeof single.id, 'string')

  const many = generateDeadlineDayOffers({ squad, clubIds, playerClubId: 'arsenal', week: 4, rng: () => 0.01 })
  assert.equal(many.length, 5, 'a roll comfortably under DEADLINE_DAY_OFFER_CHANCE should draw a bid for every listed player')

  const none = generateDeadlineDayOffers({ squad, clubIds, playerClubId: 'arsenal', week: 4, rng: () => 0.99 })
  assert.equal(none.length, 0, 'a roll above DEADLINE_DAY_OFFER_CHANCE should draw no bids at all')
})

test('ADVANCE_WEEK on deadline day can populate multiple incoming offers and mentions DEADLINE DAY in the notice', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })

  const listedIds = state.squads.arsenal.slice(0, 6).map((p) => p.id)
  state = {
    ...state,
    week: SUMMER_WINDOW_WEEKS[SUMMER_WINDOW_WEEKS.length - 1] - 1,
    squads: { ...state.squads, arsenal: state.squads.arsenal.map((p) => (listedIds.includes(p.id) ? { ...p, listed: true } : p)) },
  }
  assert.ok(isTransferWindowOpen(state.week + 1))
  assert.ok(isDeadlineDay(state.week + 1))

  const originalRandom = Math.random
  try {
    Math.random = mulberry32(42)
    const after = gameReducer(state, { type: 'ADVANCE_WEEK' })
    assert.equal(after.week, state.week + 1)
    assert.ok(after.incomingOffers.length <= 5, 'incoming offers should stay capped at 5')
    if (after.incomingOffers.length > state.incomingOffers.length) {
      assert.match(after.notice, /DEADLINE DAY/, 'a new offer arriving on deadline day should be flagged in the notice')
    }
  } finally {
    Math.random = originalRandom
  }
})
