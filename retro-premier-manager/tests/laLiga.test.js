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
import { SEGUNDA_CLUBS } from '../src/data/segundaClubs.js'
import { gameReducer, makeInitialState, playerLeagueClubIds, standingsToTable, resolveLaLigaPromotionRelegation } from '../src/state/gameReducer.js'

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

test('starting a new game as a La Liga club sets up all fourteen divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'real-madrid', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'real-madrid')
  assert.equal(state.clubs['real-madrid'].division, 'LALIGA')
  assert.equal(playerLeagueClubIds(state).length, 20)

  for (const division of ['PL', 'CH', 'SPL', 'SCH', 'LALIGA', 'SEGUNDA', 'SERIEA', 'SERIEB', 'BUNDESLIGA', 'BUNDESLIGA2', 'LIGUE1', 'LIGUE2', 'EREDIVISIE', 'EERSTEDIVISIE']) {
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
  assert.equal(divisionsPlaying.size, 14)

  assert.equal(state.fixtures.length, 38)
})

test('finishing in the top 4 of La Liga qualifies for the Champions League, same rule as the Premier League', () => {
  assert.equal(qualificationForPosition(1), 'UCL')
  assert.equal(qualificationForPosition(4), 'UCL')
  assert.equal(qualificationForPosition(6), 'UEL')
  assert.equal(qualificationForPosition(7), null)
})

test('Segunda Division has 20 clubs, unique ids, and no collisions with any other division', () => {
  assert.equal(SEGUNDA_CLUBS.length, 20)

  const allIds = new Set()
  for (const club of SEGUNDA_CLUBS) {
    assert.ok(!allIds.has(club.id), `duplicate id: ${club.id}`)
    allIds.add(club.id)
    assert.equal(club.division, 'SEGUNDA')
    assert.ok(Array.isArray(club.stands) && club.stands.length > 0)
    assert.ok(club.startingBudget > 0 && club.bankBalance > 0 && club.ticketPrice > 0)
  }

  const otherIds = new Set(
    [...CLUBS, ...CHAMPIONSHIP_CLUBS, ...SCOTTISH_PREMIERSHIP_CLUBS, ...SCOTTISH_CHAMPIONSHIP_CLUBS, ...LA_LIGA_CLUBS, ...FOREIGN_CLUBS].map(
      (c) => c.id,
    ),
  )
  for (const id of allIds) assert.ok(!otherIds.has(id), `Segunda Division id collides with another club: ${id}`)

  for (const club of SEGUNDA_CLUBS) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }

  assert.equal(DIVISION_LABELS.SEGUNDA, 'Segunda Division')
})

test('generateObjective returns a sensible target position for Segunda Division clubs', () => {
  for (const club of SEGUNDA_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'SEGUNDA')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 17, `SEGUNDA target ${objective.targetPosition} out of range for ${club.id}`)
  }
})

test('tvIncomeForWeek gives the Segunda Division a smaller pot than La Liga', () => {
  assert.ok(tvIncomeForWeek(1, 'SEGUNDA') < tvIncomeForWeek(1, 'LALIGA'))
})

test('resolveLaLigaPromotionRelegation relegates the bottom 3 of La Liga, promotes the top 2 of the Segunda Division and one play-off contender, and keeps both divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'real-madrid', managerName: 'Test' } })

  const laLigaIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'LALIGA')
  const segundaIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'SEGUNDA')
  assert.equal(laLigaIds.length, 20)
  assert.equal(segundaIds.length, 20)

  const standings = {}
  laLigaIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (laLigaIds.length - i) * 3 }
  })
  segundaIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (segundaIds.length - i) * 3 }
  })
  state = { ...state, standings }

  const laLigaTable = standingsToTable(state.standings, laLigaIds)
  const segundaTable = standingsToTable(state.standings, segundaIds)
  const expectedRelegated = laLigaTable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = segundaTable.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = segundaTable.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveLaLigaPromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'SEGUNDA', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'LALIGA', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'LALIGA')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  const laLigaCountAfter = Object.values(clubs).filter((c) => c.division === 'LALIGA').length
  const segundaCountAfter = Object.values(clubs).filter((c) => c.division === 'SEGUNDA').length
  assert.equal(laLigaCountAfter, 20)
  assert.equal(segundaCountAfter, 20)
})
