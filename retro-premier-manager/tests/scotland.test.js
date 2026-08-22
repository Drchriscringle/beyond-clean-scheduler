import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../src/data/scottishClubs.js'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, ALL_CLUBS, DIVISION_LABELS } from '../src/data/clubs.js'
import { generateFixtures, generateSeasonFixtures, combineFixturesByWeek } from '../src/state/fixtures.js'
import { generateObjective } from '../src/state/objectives.js'
import { driftConfidence } from '../src/state/boardroom.js'
import { matchdayIncome, tvIncomeForWeek } from '../src/state/finance.js'
import {
  gameReducer,
  makeInitialState,
  standingsToTable,
  playerLeagueClubIds,
  resolveScottishPromotionRelegation,
} from '../src/state/gameReducer.js'

test('Scottish Premiership and Championship have the right number of clubs, unique ids, and no collisions with English/foreign clubs', () => {
  assert.equal(SCOTTISH_PREMIERSHIP_CLUBS.length, 12)
  assert.equal(SCOTTISH_CHAMPIONSHIP_CLUBS.length, 10)

  const allIds = new Set()
  for (const club of [...SCOTTISH_PREMIERSHIP_CLUBS, ...SCOTTISH_CHAMPIONSHIP_CLUBS]) {
    assert.ok(!allIds.has(club.id), `duplicate id: ${club.id}`)
    allIds.add(club.id)
    assert.ok(Array.isArray(club.stands) && club.stands.length > 0)
    assert.ok(club.startingBudget > 0 && club.bankBalance > 0 && club.ticketPrice > 0)
  }
  for (const club of SCOTTISH_PREMIERSHIP_CLUBS) assert.equal(club.division, 'SPL')
  for (const club of SCOTTISH_CHAMPIONSHIP_CLUBS) assert.equal(club.division, 'SCH')

  const englishIds = new Set([...CLUBS, ...CHAMPIONSHIP_CLUBS].map((c) => c.id))
  for (const id of allIds) assert.ok(!englishIds.has(id), `Scottish id collides with an English club: ${id}`)

  for (const club of [...SCOTTISH_PREMIERSHIP_CLUBS, ...SCOTTISH_CHAMPIONSHIP_CLUBS]) {
    assert.equal(CLUB_BY_ID[club.id]?.name, club.name)
    assert.ok(ALL_CLUBS.some((c) => c.id === club.id))
  }

  assert.equal(DIVISION_LABELS.SPL, 'Scottish Premiership')
  assert.equal(DIVISION_LABELS.SCH, 'Scottish Championship')
})

test('generateSeasonFixtures fills exactly targetWeeks weeks for any league size, and is a no-op for a league whose natural cycle already equals targetWeeks', () => {
  const twentyIds = CLUBS.map((c) => c.id)
  const unwrapped = generateFixtures(twentyIds)
  const wrapped = generateSeasonFixtures(twentyIds, 38)
  assert.equal(unwrapped.length, 38, 'sanity check: a 20-club double round-robin is naturally 38 weeks')
  assert.equal(wrapped.length, 38)
  // Same matches every week, just with ids regenerated - content is identical.
  for (let i = 0; i < 38; i++) {
    assert.deepEqual(
      wrapped[i].matches.map((m) => [m.home, m.away]),
      unwrapped[i].matches.map((m) => [m.home, m.away]),
    )
  }

  const splIds = SCOTTISH_PREMIERSHIP_CLUBS.map((c) => c.id)
  const schIds = SCOTTISH_CHAMPIONSHIP_CLUBS.map((c) => c.id)
  const splFixtures = generateSeasonFixtures(splIds, 38)
  const schFixtures = generateSeasonFixtures(schIds, 38)
  assert.equal(splFixtures.length, 38)
  assert.equal(schFixtures.length, 38)
  // Every week, every club in the division has exactly one fixture (a
  // complete round each week, even though the cycle wraps around).
  for (const week of splFixtures) {
    const clubsPlaying = week.matches.flatMap((m) => [m.home, m.away])
    assert.equal(new Set(clubsPlaying).size, splIds.length)
  }
  // Match ids stay unique within each week even after wrapping around.
  const week30Ids = new Set(splFixtures[29].matches.map((m) => m.id))
  assert.equal(week30Ids.size, splFixtures[29].matches.length)
})

test('combineFixturesByWeek merges all four divisions into one shared weekly calendar', () => {
  const a = generateSeasonFixtures(['a1', 'a2'], 4)
  const b = generateSeasonFixtures(['b1', 'b2'], 4)
  const c = generateSeasonFixtures(['c1', 'c2'], 4)
  const combined = combineFixturesByWeek(a, b, c)
  assert.equal(combined.length, 4)
  for (let i = 0; i < 4; i++) {
    assert.equal(combined[i].week, i + 1)
    assert.equal(combined[i].matches.length, 3) // one match from each of the 3 mini-divisions
  }
})

test('generateObjective returns a sensible target position for Scottish divisions (never a position the league does not have)', () => {
  for (const club of SCOTTISH_PREMIERSHIP_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'SPL')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 12, `SPL target ${objective.targetPosition} out of range for ${club.id}`)
  }
  for (const club of SCOTTISH_CHAMPIONSHIP_CLUBS) {
    const objective = generateObjective(club.reputation, () => 0, 'SCH')
    assert.ok(objective.targetPosition >= 1 && objective.targetPosition <= 10, `SCH target ${objective.targetPosition} out of range for ${club.id}`)
  }
})

test('driftConfidence and matchdayIncome position bonuses scale to the division size instead of assuming a 20-club league', () => {
  // A reputation-1 club finishing 1st (way overachieving) should always be
  // treated as beating expectations, in a 20-club or a 12-club league alike.
  const big = driftConfidence({ boardConfidence: 50, leaguePosition: 1, reputation: 1, resultPoints: 1, divisionSize: 20 })
  const small = driftConfidence({ boardConfidence: 50, leaguePosition: 1, reputation: 1, resultPoints: 1, divisionSize: 12 })
  assert.ok(big > 50)
  assert.ok(small > 50)

  // The top club's matchday position bonus should be the same regardless of
  // division size (same club, same reputation, same "1st place" bonus).
  const club = { reputation: 3, stands: [] }
  const topBig = matchdayIncome({ club, capacity: 10000, ticketPrice: 30, leaguePosition: 1, formGoodwill: 0, divisionSize: 20, rng: () => 0.5 })
  const topSmall = matchdayIncome({ club, capacity: 10000, ticketPrice: 30, leaguePosition: 1, formGoodwill: 0, divisionSize: 12, rng: () => 0.5 })
  assert.equal(topBig.attendancePct, topSmall.attendancePct)
})

test('tvIncomeForWeek gives Scottish divisions a smaller pot than the English equivalent', () => {
  assert.ok(tvIncomeForWeek(1, 'SPL') < tvIncomeForWeek(1, 'CH'))
  assert.ok(tvIncomeForWeek(1, 'SCH') < tvIncomeForWeek(1, 'SPL'))
})

test('resolveScottishPromotionRelegation relegates the bottom 2 of the Premiership, promotes the Championship winner and one play-off contender, and keeps both divisions the same size', () => {
  let state = makeInitialState()
  state = gameReducer(state, { type: 'START_NEW_GAME', payload: { clubId: 'celtic', managerName: 'Test' } })

  const splIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'SPL')
  const schIds = Object.keys(state.clubs).filter((id) => state.clubs[id].division === 'SCH')
  assert.equal(splIds.length, 12)
  assert.equal(schIds.length, 10)

  const standings = {}
  splIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (splIds.length - i) * 3 }
  })
  schIds.forEach((id, i) => {
    standings[id] = { played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: (schIds.length - i) * 3 }
  })
  state = { ...state, standings }

  const splTable = standingsToTable(state.standings, splIds)
  const schTable = standingsToTable(state.standings, schIds)
  const expectedRelegated = splTable.slice(-2).map((r) => r.clubId)
  const expectedAutoPromoted = schTable.slice(0, 1).map((r) => r.clubId)
  const playoffContenders = schTable.slice(1, 5).map((r) => r.clubId)

  const clubs = { ...state.clubs }
  resolveScottishPromotionRelegation(state, clubs)

  for (const id of expectedRelegated) assert.equal(clubs[id].division, 'SCH', `${id} should be relegated`)
  for (const id of expectedAutoPromoted) assert.equal(clubs[id].division, 'SPL', `${id} should be automatically promoted`)

  const promotedFromPlayoff = playoffContenders.filter((id) => clubs[id].division === 'SPL')
  assert.equal(promotedFromPlayoff.length, 1, 'exactly one of the 4 play-off contenders should go up')

  const splCountAfter = Object.values(clubs).filter((c) => c.division === 'SPL').length
  const schCountAfter = Object.values(clubs).filter((c) => c.division === 'SCH').length
  assert.equal(splCountAfter, 12)
  assert.equal(schCountAfter, 10)
})

test('starting a new game as a Scottish club sets up all five divisions correctly', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'celtic', managerName: 'Test' } })

  assert.equal(state.playerClubId, 'celtic')
  assert.equal(state.clubs.celtic.division, 'SPL')
  assert.equal(playerLeagueClubIds(state).length, 12)

  for (const division of ['PL', 'CH', 'SPL', 'SCH', 'LALIGA']) {
    const ids = Object.keys(state.clubs).filter((id) => state.clubs[id].division === division)
    assert.ok(ids.length > 0, `no clubs found for division ${division}`)
    for (const id of ids) {
      assert.ok(state.squads[id]?.length > 0, `missing squad for ${id}`)
      assert.ok(state.clubs[id].facilities, `missing facilities for ${id}`)
      assert.ok(state.clubs[id].objective, `missing objective for ${id}`)
    }
  }

  // Week 1 fixtures should include matches from every division.
  const week1 = state.fixtures.find((f) => f.week === 1)
  const divisionsPlaying = new Set(week1.matches.map((m) => state.clubs[m.home].division))
  assert.equal(divisionsPlaying.size, 5)

  // The whole season still runs to exactly 38 weeks for every division.
  assert.equal(state.fixtures.length, 38)
})

test('advancing past the final week (season rollover) does not crash on foreign clubs, which have no facilities/objective of their own', () => {
  let state = gameReducer(makeInitialState(), { type: 'START_NEW_GAME', payload: { clubId: 'arsenal', managerName: 'Test' } })
  state = gameReducer(state, {
    type: 'CONFIRM_COMMERCIAL_DEALS',
    payload: { sponsorshipId: state.commercial.sponsorshipOptions[0].id, merchandiseId: state.commercial.merchandiseOptions[0].id },
  })
  const foreignId = Object.keys(state.clubs).find((id) => state.clubs[id].division === 'FOREIGN')
  const foreignSquadBefore = state.squads[foreignId]

  state = { ...state, week: 39 } // past every division's last fixture week
  const after = gameReducer(state, { type: 'ADVANCE_WEEK' })

  assert.equal(after.squads[foreignId], foreignSquadBefore, 'a foreign club squad should pass through season rollover completely unchanged')
})
