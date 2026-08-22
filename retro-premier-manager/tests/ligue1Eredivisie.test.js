import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIGUE_1_CLUBS } from '../src/data/ligue1Clubs.js'
import { LIGUE_2_CLUBS } from '../src/data/ligue2Clubs.js'
import { EREDIVISIE_CLUBS } from '../src/data/eredivisieClubs.js'
import { EERSTE_DIVISIE_CLUBS } from '../src/data/eersteDivisieClubs.js'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, ALL_CLUBS, DIVISION_LABELS } from '../src/data/clubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../src/data/scottishClubs.js'
import { LA_LIGA_CLUBS } from '../src/data/laLigaClubs.js'
import { SEGUNDA_CLUBS } from '../src/data/segundaClubs.js'
import { SERIE_A_CLUBS } from '../src/data/serieAClubs.js'
import { SERIE_B_CLUBS } from '../src/data/serieBClubs.js'
import { BUNDESLIGA_CLUBS } from '../src/data/bundesligaClubs.js'
import { BUNDESLIGA_2_CLUBS } from '../src/data/bundesliga2Clubs.js'
import { FOREIGN_CLUBS } from '../src/data/foreignClubs.js'
import { generateSeasonFixtures } from '../src/state/fixtures.js'
import { generateObjective } from '../src/state/objectives.js'
import { tvIncomeForWeek } from '../src/state/finance.js'
import {
  gameReducer,
  makeInitialState,
  playerLeagueClubIds,
  standingsToTable,
  resolveLigue1PromotionRelegation,
  resolveEredivisiePromotionRelegation,
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
  ...FOREIGN_CLUBS,
]

test('Ligue 1 and Ligue 2 both have 18 clubs, all unique and collision-free', () => {
  assert.equal(LIGUE_1_CLUBS.length, 18)
  assert.equal(LIGUE_2_CLUBS.length, 18)
  for (const club of LIGUE_1_CLUBS) assert.equal(club.division, 'LIGUE1')
  for (const club of LIGUE_2_CLUBS) assert.equal(club.division, 'LIGUE2')

  const others = [...OTHER_DIVISIONS, ...EREDIVISIE_CLUBS, ...EERSTE_DIVISIE_CLUBS]
  assertNoIdCollisions(LIGUE_1_CLUBS, others, 'Ligue 1')
  assertNoIdCollisions(LIGUE_2_CLUBS, others, 'Ligue 2')

  for (const club of [...LIGUE_1_CLUBS, ...LIGUE_2_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  assert.equal(DIVISION_LABELS.LIGUE1, 'Ligue 1')
  assert.equal(DIVISION_LABELS.LIGUE2, 'Ligue 2')
})

test('the Eredivisie has 18 clubs and the Eerste Divisie has 20 clubs, all unique and collision-free', () => {
  assert.equal(EREDIVISIE_CLUBS.length, 18)
  assert.equal(EERSTE_DIVISIE_CLUBS.length, 20)
  for (const club of EREDIVISIE_CLUBS) assert.equal(club.division, 'EREDIVISIE')
  for (const club of EERSTE_DIVISIE_CLUBS) assert.equal(club.division, 'EERSTEDIVISIE')

  const others = [...OTHER_DIVISIONS, ...LIGUE_1_CLUBS, ...LIGUE_2_CLUBS]
  assertNoIdCollisions(EREDIVISIE_CLUBS, others, 'Eredivisie')
  assertNoIdCollisions(EERSTE_DIVISIE_CLUBS, others, 'Eerste Divisie')

  for (const club of [...EREDIVISIE_CLUBS, ...EERSTE_DIVISIE_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }
  assert.equal(DIVISION_LABELS.EREDIVISIE, 'Eredivisie')
  assert.equal(DIVISION_LABELS.EERSTEDIVISIE, 'Eerste Divisie')
})

test('PSG and Ajax, graduated from the foreign/European pool, are no longer in it', () => {
  const foreignIds = new Set(FOREIGN_CLUBS.map((c) => c.id))
  assert.ok(!foreignIds.has('euro-psg'), 'PSG should no longer be in the foreign/European opponent pool')
  assert.ok(!foreignIds.has('euro-ajax'), 'Ajax should no longer be in the foreign/European opponent pool')
})

test('generateSeasonFixtures fills exactly 38 weeks for every new division, including the 20-club Eerste Divisie', () => {
  for (const ids of [LIGUE_1_CLUBS, LIGUE_2_CLUBS, EREDIVISIE_CLUBS, EERSTE_DIVISIE_CLUBS].map((clubs) => clubs.map((c) => c.id))) {
    const fixtures = generateSeasonFixtures(ids, 38)
    assert.equal(fixtures.length, 38)
    for (const week of fixtures) {
      const clubsPlaying = week.matches.flatMap((m) => [m.home, m.away])
      assert.equal(new Set(clubsPlaying).size, ids.length)
    }
  }
})

test('generateObjective returns a sensible target position for Ligue 1/2 and Eredivisie/Eerste Divisie clubs', () => {
  for (const club of LIGUE_1_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'LIGUE1')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 15, `LIGUE1 target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of LIGUE_2_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'LIGUE2')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 15, `LIGUE2 target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of EREDIVISIE_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'EREDIVISIE')
    assert.ok(
      objective.targetPosition >= 1 && objective.targetPosition <= 15,
      `EREDIVISIE target ${objective.targetPosition} out of range for ${club.id}`,
    )
  }
  for (const club of EERSTE_DIVISIE_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'EERSTEDIVISIE')
    assert.ok(
      objective.targetPosition >= 1 && objective.targetPosition <= 17,
      `EERSTEDIVISIE target ${objective.targetPosition} out of range for ${club.id}`,
    )
  }
})

test('tvIncomeForWeek gives Ligue 2 a smaller pot than Ligue 1, and the Eerste Divisie a smaller pot than the Eredivisie', () => {
  assert.ok(tvIncomeForWeek(1, 'LIGUE2') < tvIncomeForWeek(1, 'LIGUE1'))
  assert.ok(tvIncomeForWeek(1, 'EERSTEDIVISIE') < tvIncomeForWeek(1, 'EREDIVISIE'))
  assert.notEqual(tvIncomeForWeek(1, 'LIGUE1'), tvIncomeForWeek(1, 'PL'))
  assert.notEqual(tvIncomeForWeek(1, 'EREDIVISIE'), tvIncomeForWeek(1, 'PL'))
})

test('resolveLigue1PromotionRelegation relegates the bottom 3 of Ligue 1, promotes the top 2 of Ligue 2 and one play-off contender, and keeps both 18-club divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'psg', managerName: 'Test' } })

  const ligue1Ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'LIGUE1')
  const ligue2Ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'LIGUE2')
  assert.equal(ligue1Ids.length, 18)
  assert.equal(ligue2Ids.length, 18)

  const standings = {}
  ligue1Ids.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (ligue1Ids.length - i) * 3 }
  })
  ligue2Ids.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (ligue2Ids.length - i) * 3 }
  })
  state = { ...state, standings }

  const ligue1Table = standingsToTable(state.standings, ligue1Ids)
  const ligue2Table = standingsToTable(state.standings, ligue2Ids)
  const expectedRelegated = ligue1Table.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = ligue2Table.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = ligue2Table.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveLigue1PromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'LIGUE2', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'LIGUE1', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'LIGUE1')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  assert.equal(Object.values(clubs).filter((c) => c.division === 'LIGUE1').length, 18)
  assert.equal(Object.values(clubs).filter((c) => c.division === 'LIGUE2').length, 18)
})

test('resolveEredivisiePromotionRelegation relegates the bottom 3 of the Eredivisie, promotes the top 2 of the Eerste Divisie and one play-off contender, and keeps both divisions the same size', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'ajax', managerName: 'Test' } })

  const eredivisieIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'EREDIVISIE')
  const eersteDivisieIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'EERSTEDIVISIE')
  assert.equal(eredivisieIds.length, 18)
  assert.equal(eersteDivisieIds.length, 20)

  const standings = {}
  eredivisieIds.forEach((id, i) => {
    standings[id] = { played: 34, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (eredivisieIds.length - i) * 3 }
  })
  eersteDivisieIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (eersteDivisieIds.length - i) * 3 }
  })
  state = { ...state, standings }

  const eredivisieTable = standingsToTable(state.standings, eredivisieIds)
  const eersteDivisieTable = standingsToTable(state.standings, eersteDivisieIds)
  const expectedRelegated = eredivisieTable.slice(-3).map((r) => r.clubId)
  const expectedAutoPromoted = eersteDivisieTable.slice(0, 2).map((r) => r.clubId)
  const playoffContenders = eersteDivisieTable.slice(2, 6).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveEredivisiePromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'EERSTEDIVISIE', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'EREDIVISIE', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'EREDIVISIE')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  assert.equal(Object.values(clubs).filter((c) => c.division === 'EREDIVISIE').length, 18)
  assert.equal(Object.values(clubs).filter((c) => c.division === 'EERSTEDIVISIE').length, 20)
})

test('starting a new game as a Ligue 1 or Eredivisie club sets up all fourteen divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'psg', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'psg')
  assert.equal(state.clubs.psg.division, 'LIGUE1')
  assert.equal(playerLeagueClubIds(state).length, 18)

  const week1 = state.fixtures.find((f) => f.week === 1)
  const divisionsPlaying = new Set(week1.matches.map((m) => state.clubs[m.home].division))
  assert.equal(divisionsPlaying.size, 14)
  assert.equal(state.fixtures.length, 38)
})
