import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRIMEIRA_LIGA_CLUBS } from '../src/data/primeiraLigaClubs.js'
import { LIGA_PORTUGAL_2_CLUBS } from '../src/data/ligaPortugal2Clubs.js'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, ALL_CLUBS, DIVISION_LABELS } from '../src/data/clubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../src/data/scottishClubs.js'
import { LA_LIGA_CLUBS } from '../src/data/laLigaClubs.js'
import { SEGUNDA_CLUBS } from '../src/data/segundaClubs.js'
import { SERIE_A_CLUBS } from '../src/data/serieAClubs.js'
import { SERIE_B_CLUBS } from '../src/data/serieBClubs.js'
import { BUNDESLIGA_CLUBS } from '../src/data/bundesligaClubs.js'
import { BUNDESLIGA_2_CLUBS } from '../src/data/bundesliga2Clubs.js'
import { LIGUE_1_CLUBS } from '../src/data/ligue1Clubs.js'
import { LIGUE_2_CLUBS } from '../src/data/ligue2Clubs.js'
import { EREDIVISIE_CLUBS } from '../src/data/eredivisieClubs.js'
import { EERSTE_DIVISIE_CLUBS } from '../src/data/eersteDivisieClubs.js'
import { FOREIGN_CLUBS } from '../src/data/foreignClubs.js'
import { generateSeasonFixtures } from '../src/state/fixtures.js'
import { generateObjective } from '../src/state/objectives.js'
import { tvIncomeForWeek } from '../src/state/finance.js'
import { europeanOpponentPool } from '../src/state/europe.js'
import {
  gameReducer,
  makeInitialState,
  playerLeagueClubIds,
  standingsToTable,
  resolvePrimeiraLigaPromotionRelegation,
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

const OTHER_DIVISIONS = [
  ...CLUBS,
  ...CHAMPIONSHIP_CLUBS,
  ...SCOTTISH_PREMIERSHIP_CLUBS,
  ...SCOTTISH_CHAMPIONSHIP_CLUBS,
  ...LA_LIGA_CLUBS,
  ...SEGUNDA_CLUBS,
  ...SERIE_A_CLUBS,
  ...SERIE_B_CLUBS,
  ...BUNDESLIGA_CLUBS,
  ...BUNDESLIGA_2_CLUBS,
  ...LIGUE_1_CLUBS,
  ...LIGUE_2_CLUBS,
  ...EREDIVISIE_CLUBS,
  ...EERSTE_DIVISIE_CLUBS,
  ...FOREIGN_CLUBS,
]

test('the Primeira Liga and Liga Portugal 2 both have 18 clubs, all unique and collision-free', () => {
  assert.equal(PRIMEIRA_LIGA_CLUBS.length, 18)
  assert.equal(LIGA_PORTUGAL_2_CLUBS.length, 18)
  for (const club of PRIMEIRA_LIGA_CLUBS) assert.equal(club.division, 'PRIMEIRALIGA')
  for (const club of LIGA_PORTUGAL_2_CLUBS) assert.equal(club.division, 'LIGAPORTUGAL2')

  assertNoIdCollisions(PRIMEIRA_LIGA_CLUBS, OTHER_DIVISIONS, 'Primeira Liga')
  assertNoIdCollisions(LIGA_PORTUGAL_2_CLUBS, OTHER_DIVISIONS, 'Liga Portugal 2')

  for (const club of [...PRIMEIRA_LIGA_CLUBS, ...LIGA_PORTUGAL_2_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  assert.equal(DIVISION_LABELS.PRIMEIRALIGA, 'Primeira Liga')
  assert.equal(DIVISION_LABELS.LIGAPORTUGAL2, 'Liga Portugal 2')
})

test('Porto and Benfica, graduated from the foreign/European pool, are no longer in it', () => {
  const foreignIds = new Set(FOREIGN_CLUBS.map((c) => c.id))
  assert.ok(!foreignIds.has('euro-porto'), 'Porto should no longer be in the foreign/European opponent pool')
  assert.ok(!foreignIds.has('euro-benfica'), 'Benfica should no longer be in the foreign/European opponent pool')
})

test('generateSeasonFixtures fills exactly 38 weeks for both new 18-club divisions', () => {
  for (const ids of [PRIMEIRA_LIGA_CLUBS, LIGA_PORTUGAL_2_CLUBS].map((clubs) => clubs.map((c) => c.id))) {
    const fixtures = generateSeasonFixtures(ids, 38)
    assert.equal(fixtures.length, 38)
    for (const week of fixtures) {
      const clubsPlaying = week.matches.flatMap((m) => [m.home, m.away])
      assert.equal(new Set(clubsPlaying).size, ids.length)
    }
  }
})

test('generateObjective returns a sensible target position for Primeira Liga/Liga Portugal 2 clubs', () => {
  for (const club of PRIMEIRA_LIGA_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'PRIMEIRALIGA')
    assert.ok(
      objective.targetPosition >= 1 && objective.targetPosition <= 15,
      `PRIMEIRALIGA target ${objective.targetPosition} out of range for ${club.id}`,
    )
  }
  for (const club of LIGA_PORTUGAL_2_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'LIGAPORTUGAL2')
    assert.ok(
      objective.targetPosition >= 1 && objective.targetPosition <= 15,
      `LIGAPORTUGAL2 target ${objective.targetPosition} out of range for ${club.id}`,
    )
  }
})

test('tvIncomeForWeek gives Liga Portugal 2 a smaller pot than the Primeira Liga', () => {
  assert.ok(tvIncomeForWeek(1, 'LIGAPORTUGAL2') < tvIncomeForWeek(1, 'PRIMEIRALIGA'))
  assert.notEqual(tvIncomeForWeek(1, 'PRIMEIRALIGA'), tvIncomeForWeek(1, 'PL'))
})

test('the European opponent pool now includes the Primeira Liga, excluding a Primeira Liga manager\'s own division', () => {
  const plPool = europeanOpponentPool('PL')
  assert.ok(plPool.some((c) => c.id === 'benfica'))
  assert.ok(plPool.some((c) => c.id === 'porto'))

  const primeiraLigaPool = europeanOpponentPool('PRIMEIRALIGA')
  assert.ok(!primeiraLigaPool.some((c) => c.division === 'PRIMEIRALIGA'))
  assert.ok(primeiraLigaPool.some((c) => c.id === 'real-madrid'))
})

test('resolvePrimeiraLigaPromotionRelegation relegates the bottom 3 of the Primeira Liga, promotes the top 2 of Liga Portugal 2 and one play-off contender, and keeps both 18-club divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'benfica', managerName: 'Test' } })

  const primeiraLigaIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'PRIMEIRALIGA')
  const ligaPortugal2Ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'LIGAPORTUGAL2')
  assert.equal(primeiraLigaIds.length, 18)
  assert.equal(ligaPortugal2Ids.length, 18)

  const standings = {}
  primeiraLigaIds.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (primeiraLigaIds.length - i) * 3 }
  })
  ligaPortugal2Ids.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (ligaPortugal2Ids.length - i) * 3 }
  })
  state = { ...state, standings }

  const primeiraLigaTable = standingsToTable(state.standings, primeiraLigaIds)
  const ligaPortugal2Table = standingsToTable(state.standings, ligaPortugal2Ids)
  const expectedRelegated = primeiraLigaTable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = ligaPortugal2Table.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = ligaPortugal2Table.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolvePrimeiraLigaPromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'LIGAPORTUGAL2', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'PRIMEIRALIGA', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'PRIMEIRALIGA')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  assert.equal(Object.values(clubs).filter((c) => c.division === 'PRIMEIRALIGA').length, 18)
  assert.equal(Object.values(clubs).filter((c) => c.division === 'LIGAPORTUGAL2').length, 18)
})

test('starting a new game as a Primeira Liga club sets up all sixteen divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'benfica', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'benfica')
  assert.equal(state.clubs.benfica.division, 'PRIMEIRALIGA')
  assert.equal(playerLeagueClubIds(state).length, 18)

  const week1 = state.fixtures.find((f) => f.week === 1)
  const divisionsPlaying = new Set(week1.matches.map((m) => state.clubs[m.home].division))
  assert.equal(divisionsPlaying.size, 16)
  assert.equal(state.fixtures.length, 38)
})
