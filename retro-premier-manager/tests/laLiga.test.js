import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LA_LIGA_CLUBS } from '../src/data/laLigaClubs.js'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, ALL_CLUBS, DIVISION_LABELS } from '../src/data/clubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../src/data/scottishClubs.js'
import { FOREIGN_CLUBS } from '../src/data/foreignClubs.js'
import { generateSeasonFixtures } from '../src/state/fixtures.js'
import { generateObjective } from '../src/state/objectives.js'
import { tvIncomeForWeek } from '../src/state/finance.js'
import { qualificationForPosition } from '../src/state/europe.js'
import { gameReducer, makeInitialState, playerLeagueClubIds } from '../src/state/gameReducer.js'

test('La Liga has 20 clubs, unique ids, and no collisions with English/Scottish/foreign clubs', () => {
  assert.equal(LA_LIGA_CLUBS.length, 20)

  const allIds = new Set()
  for (const club of LA_LIGA_CLUBS) {
    assert.ok(!allIds.has(club.id), `duplicate id: ${club.id}`)
    allIds.add(club.id)
    assert.equal(club.division, 'LALIGA')
    assert.ok(Array.isArray(club.stands) && club.stands.length > 0)
    assert.ok(club.startingBudget > 0 && club.bankBalance > 0 && club.ticketPrice > 0)
  }

  const otherIds = new Set(
    [...CLUBS, ...CHAMPIONSHIP_CLUBS, ...SCOTTISH_PREMIERSHIP_CLUBS, ...SCOTTISH_CHAMPIONSHIP_CLUBS, ...FOREIGN_CLUBS].map((c) => c.id),
  )
  for (const id of allIds) assert.ok(!otherIds.has(id), `La Liga id collides with another club: ${id}`)

  for (const club of LA_LIGA_CLUBS) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }

  assert.equal(DIVISION_LABELS.LALIGA, 'La Liga')
})

test('the four clubs graduated from the foreign/European pool into La Liga are no longer in it', () => {
  const graduated = ['real-madrid', 'barcelona', 'atletico-madrid', 'sevilla']
  const foreignIds = new Set(FOREIGN_CLUBS.map((c) => c.id))
  for (const id of graduated) {
    assert.ok(!foreignIds.has(`euro-${id}`), `${id} should no longer be in the foreign/European opponent pool`)
  }
})

test('generateSeasonFixtures fills exactly 38 weeks for La Liga (a 20-club league, same as the natural cycle)', () => {
  const laLigaIds = LA_LIGA_CLUBS.map((c) => c.id)
  const fixtures = generateSeasonFixtures(laLigaIds, 38)
  assert.equal(fixtures.length, 38)
  for (const week of fixtures) {
    const clubsPlaying = week.matches.flatMap((m) => [m.home, m.away])
    assert.equal(new Set(clubsPlaying).size, laLigaIds.length)
  }
})

test('generateObjective returns a sensible target position for La Liga clubs', () => {
  for (const club of LA_LIGA_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'LALIGA')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 17, `LALIGA target ${objective.targetPosition} out of range for ${club.id}`)
  }
})

test('tvIncomeForWeek gives La Liga its own independent pot, distinct from the Premier League', () => {
  assert.notEqual(tvIncomeForWeek(1, 'LALIGA'), tvIncomeForWeek(1, 'PL'))
  assert.ok(tvIncomeForWeek(1, 'LALIGA') > tvIncomeForWeek(1, 'CH'))
})

test('starting a new game as a La Liga club sets up all five divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'real-madrid', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'real-madrid')
  assert.equal(state.clubs['real-madrid'].division, 'LALIGA')
  assert.equal(playerLeagueClubIds(state).length, 20)

  for (const division of ['PL', 'CH', 'SPL', 'SCH', 'LALIGA']) {
    const ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === division)
    assert.ok(ids.length > 0, `no clubs found for division ${division}`)
    for (const id of ids) {
      assert.ok(state.squads[id]?.length > 0, `missing squad for ${id}`)
      assert.ok(state.clubs[id].facilities, `missing facilities for ${id}`)
      assert.ok(state.clubs[id].objective, `missing objective for ${id}`)
    }
  }

  const week1 = state.fixtures.find((f) => f.week === 1)
  const divisionsPlaying = new Set(week1.matches.map((m) => state.clubs[m.home].division))
  assert.equal(divisionsPlaying.size, 5)

  assert.equal(state.fixtures.length, 38)
})

test('finishing in the top 4 of La Liga qualifies for the Champions League, same rule as the Premier League', () => {
  assert.equal(qualificationForPosition(1), 'UCL')
  assert.equal(qualificationForPosition(4), 'UCL')
  assert.equal(qualificationForPosition(6), 'UEL')
  assert.equal(qualificationForPosition(7), null)
})

test('La Liga clubs are never touched by promotion/relegation - there is no Segunda División modelled', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'real-madrid', managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  const laLigaIdsBefore = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'LALIGA').sort()

  state = { ...state, week: 39 } // past every division's last fixture week
  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })

  const laLigaIdsAfter = Object.keys(after.clubs).filter((id) => after.clubs[id].division === 'LALIGA').sort()
  assert.deepEqual(laLigaIdsAfter, laLigaIdsBefore, 'the set of La Liga clubs should be unchanged across a season rollover')
})
