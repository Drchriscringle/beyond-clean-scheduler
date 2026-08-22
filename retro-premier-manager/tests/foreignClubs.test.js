import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FOREIGN_CLUBS } from '../src/data/foreignClubs.js'
import { CLUB_BY_ID, ALL_CLUBS, CLUBS, CHAMPIONSHIP_CLUBS } from '../src/data/clubs.js'
import { generateJobOffers } from '../src/state/jobOffers.js'
import { gameReducer, makeInitialState, playerLeagueClubIds } from '../src/state/gameReducer.js'
import { playEuropeanRound, initEuropeanCampaign } from '../src/state/europe.js'
import { estimatePlayerValue } from '../src/state/finance.js'

test('every foreign club has a unique id, a league label, and a valid 1-5 reputation', () => {
  const ids = new Set()
  for (const club of FOREIGN_CLUBS) {
    assert.ok(!ids.has(club.id), `duplicate foreign club id: ${club.id}`)
    ids.add(club.id)
    assert.equal(club.division, 'FOREIGN')
    assert.equal(typeof club.league, 'string')
    assert.ok(club.reputation >= 1 && club.reputation <= 5)
  }
  // Scotland has its own fully simulated Premiership/Championship now (see
  // scotland.test.js), not a slot in the shopping-pool-only foreign tier.
  assert.ok(!FOREIGN_CLUBS.some((c) => c.league === 'Scottish Premiership'))
})

test('foreign clubs are resolvable by id everywhere English clubs are, with no id collisions', () => {
  for (const club of FOREIGN_CLUBS) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  const englishIds = new Set([...CLUBS, ...CHAMPIONSHIP_CLUBS].map((c) => c.id))
  for (const club of FOREIGN_CLUBS) assert.ok(!englishIds.has(club.id), `foreign id collides with an English club: ${club.id}`)
})

function newGame(clubId = 'arsenal') {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId, managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  return state
}

test('starting a new game gives every foreign club a persistent squad and bank balance, but no fixtures/table entry', () => {
  const state = newGame()
  for (const club of FOREIGN_CLUBS) {
    assert.ok(state.clubs[club.id], `missing clubs entry for ${club.id}`)
    assert.equal(typeof state.clubs[club.id].bankBalance, 'number')
    assert.ok(state.squads[club.id]?.length > 0, `missing squad for ${club.id}`)
  }
  // Foreign clubs never appear in either division's league table, or in the
  // standings map at all - they never play a match that would need one.
  const plIds = playerLeagueClubIds(state)
  for (const club of FOREIGN_CLUBS) {
    assert.ok(!plIds.includes(club.id))
    assert.equal(club.id in state.standings, false)
  }
})

test('a foreign club can be bought from via MAKE_OFFER and paid into their bank balance', () => {
  const state = newGame()
  // The cheapest foreign club (lowest reputation) keeps the fee comfortably
  // inside Arsenal's starting budget regardless of which player is picked.
  const foreignId = [...FOREIGN_CLUBS].sort((a, b) => a.reputation - b.reputation)[0].id
  const target = [...state.squads[foreignId]].sort((a, b) => a.ability - b.ability)[0]
  const fee = estimatePlayerValue(target) // at the full value, evaluateOffer's >=0.92 threshold is always cleared
  const bankBefore = state.clubs[foreignId].bankBalance

  const after = gameReducer(state, { type: 'MAKE_OFFER', payload: { playerId: target.id, fromClubId: foreignId, fee } })
  assert.ok(after.squads.arsenal.some((p) => p.id === target.id), 'the player should have moved to Arsenal')
  assert.ok(!after.squads[foreignId].some((p) => p.id === target.id))
  assert.equal(after.clubs[foreignId].bankBalance, bankBefore + fee)
})

test('a foreign club can receive a player via OFFER_PLAYER_TO_CLUB', () => {
  const state = newGame()
  const foreignId = FOREIGN_CLUBS[0].id
  // A goalkeeper, since every squad (however big) only carries 2-3 of them -
  // well under evaluateClubInterest's same-position depth cap of 5, so the
  // deal can't be rejected for being an already-deep position regardless of
  // which foreign club is targeted.
  const player = state.squads.arsenal.find((p) => p.position === 'GK')

  const after = gameReducer(state, { type: 'OFFER_PLAYER_TO_CLUB', payload: { playerId: player.id, clubId: foreignId, askingFee: 1 } })
  assert.ok(after.squads[foreignId].some((p) => p.id === player.id), 'a trivially low asking fee for an uncontested position should always be accepted')
  assert.ok(!after.squads.arsenal.some((p) => p.id === player.id))
})

test('generateJobOffers never offers a foreign club regardless of reputation gap', () => {
  const allClubs = {
    arsenal: { id: 'arsenal', reputation: 1, division: 'PL' },
    ...Object.fromEntries(FOREIGN_CLUBS.map((c) => [c.id, c])),
  }
  const offers = generateJobOffers({
    club: allClubs.arsenal,
    objectiveMet: true,
    finalPosition: 1,
    divisionSize: 20,
    allClubs,
    playerClubId: 'arsenal',
    rng: () => 0,
  })
  for (const id of offers) assert.ok(!FOREIGN_CLUBS.some((c) => c.id === id), `foreign club ${id} should never be offered as a job`)
})

test('the European opponent draw is confined to the foreign pool (no Scottish clubs, which now have their own domestic league)', () => {
  const state = newGame()
  const europe = initEuropeanCampaign('UCL')
  const playerLineup = state.lineups.arsenal.startingXI

  // pickOpponent does Math.floor(rng() * candidates.length), so a rng that
  // always returns just under 1 deterministically selects the last entry of
  // whichever reputation-filtered pool applies to this round. For round 0
  // (minRep 2) that's all 16 EUROPEAN_CLUBS - Shakhtar Donetsk is last.
  const rng = () => 0.999
  const result = playEuropeanRound(
    europe,
    { playerClub: state.clubs.arsenal, playerSquad: state.squads.arsenal, playerLineup, playerTactics: state.tactics.arsenal, allSquads: state.squads },
    rng,
  )
  assert.equal(result.europe.history[0].opponent, 'Shakhtar Donetsk')
  assert.ok(FOREIGN_CLUBS.some((c) => c.name === result.europe.history[0].opponent))
})
