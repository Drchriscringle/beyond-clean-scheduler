import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SERIE_A_CLUBS } from '../src/data/serieAClubs.js'
import { SERIE_B_CLUBS } from '../src/data/serieBClubs.js'
import { BUNDESLIGA_CLUBS } from '../src/data/bundesligaClubs.js'
import { BUNDESLIGA_2_CLUBS } from '../src/data/bundesliga2Clubs.js'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, ALL_CLUBS, DIVISION_LABELS } from '../src/data/clubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../src/data/scottishClubs.js'
import { LA_LIGA_CLUBS } from '../src/data/laLigaClubs.js'
import { SEGUNDA_CLUBS } from '../src/data/segundaClubs.js'
import { FOREIGN_CLUBS } from '../src/data/foreignClubs.js'
import { generateSeasonFixtures } from '../src/state/fixtures.js'
import { generateObjective } from '../src/state/objectives.js'
import { tvIncomeForWeek } from '../src/state/finance.js'
import {
  gameReducer,
  makeInitialState,
  playerLeagueClubIds,
  standingsToTable,
  resolveSerieAPromotionRelegation,
  resolveBundesligaPromotionRelegation,
} from '../src/state/gameReducer.js'

function assertNoIdCollisions(clubs, otherClubs, label) {
  const allIds = new Set()
  for (const club of clubs) {
    assert.ok(!allIds.has(club.id), `duplicate id: ${club.id}`)
    allIds.add(club.id)
    assert.ok(Array.isArray(club.stands) && club.stands.length > 0)
    assert.ok(club.startingBudget > 0 && club.bankBalance > 0 && club.ticketPrice > 0)
  }
  const otherIds = new Set(otherClubs.map((c) => c.id))
  for (const id of allIds) assert.ok(!otherIds.has(id), `${label} id collides with another club: ${id}`)
}

test('Serie A has 20 clubs and Serie B has 20 clubs, all unique and collision-free', () => {
  assert.equal(SERIE_A_CLUBS.length, 20)
  assert.equal(SERIE_B_CLUBS.length, 20)
  for (const club of SERIE_A_CLUBS) assert.equal(club.division, 'SERIEA')
  for (const club of SERIE_B_CLUBS) assert.equal(club.division, 'SERIEB')

  const others = [
    ...CLUBS,
    ...CHAMPIONSHIP_CLUBS,
    ...SCOTTISH_PREMIERSHIP_CLUBS,
    ...SCOTTISH_CHAMPIONSHIP_CLUBS,
    ...LA_LIGA_CLUBS,
    ...SEGUNDA_CLUBS,
    ...BUNDESLIGA_CLUBS,
    ...BUNDESLIGA_2_CLUBS,
    ...FOREIGN_CLUBS,
  ]
  assertNoIdCollisions(SERIE_A_CLUBS, others, 'Serie A')
  assertNoIdCollisions(SERIE_B_CLUBS, others, 'Serie B')

  for (const club of [...SERIE_A_CLUBS, ...SERIE_B_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  assert.equal(DIVISION_LABELS.SERIEA, 'Serie A')
  assert.equal(DIVISION_LABELS.SERIEB, 'Serie B')
})

test('the Bundesliga has 18 clubs and 2. Bundesliga has 18 clubs, all unique and collision-free', () => {
  assert.equal(BUNDESLIGA_CLUBS.length, 18)
  assert.equal(BUNDESLIGA_2_CLUBS.length, 18)
  for (const club of BUNDESLIGA_CLUBS) assert.equal(club.division, 'BUNDESLIGA')
  for (const club of BUNDESLIGA_2_CLUBS) assert.equal(club.division, 'BUNDESLIGA2')

  const others = [
    ...CLUBS,
    ...CHAMPIONSHIP_CLUBS,
    ...SCOTTISH_PREMIERSHIP_CLUBS,
    ...SCOTTISH_CHAMPIONSHIP_CLUBS,
    ...LA_LIGA_CLUBS,
    ...SEGUNDA_CLUBS,
    ...SERIE_A_CLUBS,
    ...SERIE_B_CLUBS,
    ...FOREIGN_CLUBS,
  ]
  assertNoIdCollisions(BUNDESLIGA_CLUBS, others, 'Bundesliga')
  assertNoIdCollisions(BUNDESLIGA_2_CLUBS, others, '2. Bundesliga')

  for (const club of [...BUNDESLIGA_CLUBS, ...BUNDESLIGA_2_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  assert.equal(DIVISION_LABELS.BUNDESLIGA, 'Bundesliga')
  assert.equal(DIVISION_LABELS.BUNDESLIGA2, '2. Bundesliga')
})

test('the four clubs graduated from the foreign/European pool into the Bundesliga/Serie A are no longer in it', () => {
  const graduated = ['bayern-munich', 'borussia-dortmund', 'rb-leipzig', 'inter-milan', 'ac-milan', 'juventus', 'napoli']
  const foreignIds = new Set(FOREIGN_CLUBS.map((c) => c.id))
  for (const id of graduated) {
    assert.ok(!foreignIds.has(`euro-${id}`), `${id} should no longer be in the foreign/European opponent pool`)
  }
})

test('generateSeasonFixtures fills exactly 38 weeks for every new division, including the 18-club Bundesliga pair', () => {
  for (const ids of [SERIE_A_CLUBS, SERIE_B_CLUBS, BUNDESLIGA_CLUBS, BUNDESLIGA_2_CLUBS].map((clubs) => clubs.map((c) => c.id))) {
    const fixtures = generateSeasonFixtures(ids, 38)
    assert.equal(fixtures.length, 38)
    for (const week of fixtures) {
      const clubsPlaying = week.matches.flatMap((m) => [m.home, m.away])
      assert.equal(new Set(clubsPlaying).size, ids.length)
    }
  }
})

test('generateObjective returns a sensible target position for Serie A/B and Bundesliga/2 clubs', () => {
  for (const club of SERIE_A_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'SERIEA')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 17, `SERIEA target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of SERIE_B_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'SERIEB')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 17, `SERIEB target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of BUNDESLIGA_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'BUNDESLIGA')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 15, `BUNDESLIGA target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of BUNDESLIGA_2_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'BUNDESLIGA2')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 15, `BUNDESLIGA2 target ${objective.targetPosition} out of range for ${club.id}`)
  }
})

test('tvIncomeForWeek gives Serie B a smaller pot than Serie A, and 2. Bundesliga a smaller pot than the Bundesliga', () => {
  assert.ok(tvIncomeForWeek(1, 'SERIEB') < tvIncomeForWeek(1, 'SERIEA'))
  assert.ok(tvIncomeForWeek(1, 'BUNDESLIGA2') < tvIncomeForWeek(1, 'BUNDESLIGA'))
  assert.notEqual(tvIncomeForWeek(1, 'SERIEA'), tvIncomeForWeek(1, 'PL'))
  assert.notEqual(tvIncomeForWeek(1, 'BUNDESLIGA'), tvIncomeForWeek(1, 'PL'))
})

test('resolveSerieAPromotionRelegation relegates the bottom 3 of Serie A, promotes the top 2 of Serie B and one play-off contender, and keeps both divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'inter-milan', managerName: 'Test' } })

  const serieAIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'SERIEA')
  const serieBIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'SERIEB')
  assert.equal(serieAIds.length, 20)
  assert.equal(serieBIds.length, 20)

  const standings = {}
  serieAIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (serieAIds.length - i) * 3 }
  })
  serieBIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (serieBIds.length - i) * 3 }
  })
  state = { ...state, standings }

  const serieATable = standingsToTable(state.standings, serieAIds)
  const serieBTable = standingsToTable(state.standings, serieBIds)
  const expectedRelegated = serieATable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = serieBTable.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = serieBTable.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveSerieAPromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'SERIEB', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'SERIEA', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'SERIEA')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  assert.equal(Object.values(clubs).filter((c) => c.division === 'SERIEA').length, 20)
  assert.equal(Object.values(clubs).filter((c) => c.division === 'SERIEB').length, 20)
})

test('resolveBundesligaPromotionRelegation relegates the bottom 3 of the Bundesliga, promotes the top 2 of 2. Bundesliga and one play-off contender, and keeps both 18-club divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'bayern-munich', managerName: 'Test' } })

  const bundesligaIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'BUNDESLIGA')
  const bundesliga2Ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'BUNDESLIGA2')
  assert.equal(bundesligaIds.length, 18)
  assert.equal(bundesliga2Ids.length, 18)

  const standings = {}
  bundesligaIds.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (bundesligaIds.length - i) * 3 }
  })
  bundesliga2Ids.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (bundesliga2Ids.length - i) * 3 }
  })
  state = { ...state, standings }

  const bundesligaTable = standingsToTable(state.standings, bundesligaIds)
  const bundesliga2Table = standingsToTable(state.standings, bundesliga2Ids)
  const expectedRelegated = bundesligaTable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = bundesliga2Table.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = bundesliga2Table.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveBundesligaPromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'BUNDESLIGA2', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'BUNDESLIGA', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'BUNDESLIGA')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  assert.equal(Object.values(clubs).filter((c) => c.division === 'BUNDESLIGA').length, 18)
  assert.equal(Object.values(clubs).filter((c) => c.division === 'BUNDESLIGA2').length, 18)
})

test('starting a new game as a Bundesliga club sets up all fourteen divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'bayern-munich', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'bayern-munich')
  assert.equal(state.clubs['bayern-munich'].division, 'BUNDESLIGA')
  assert.equal(playerLeagueClubIds(state).length, 18)

  const week1 = state.fixtures.find((f) => f.week === 1)
  const divisionsPlaying = new Set(week1.matches.map((m) => state.clubs[m.home].division))
  assert.equal(divisionsPlaying.size, 14)
  assert.equal(state.fixtures.length, 38)
})
