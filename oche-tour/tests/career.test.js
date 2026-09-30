import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seededRng } from '../src/engine/rng.js'
import { seedOrder, createTournament, resolveRound } from '../src/career/tournament.js'
import { opponentAverages } from '../src/career/difficulty.js'
import { roundFormat } from '../src/career/calendar.js'
import {
  advance, currentEvent, endSeason, finishEvent, newCareer, nextUserTask, proRanking,
  resolveEntry, simulateUntilUserMatch, simulateUserMatch, startEvent, submitUserResult,
} from '../src/career/career.js'

const fresh = (opts = {}) => newCareer({ name: 'Tester', avg: 60, ...opts }, seededRng(5))

test('seeding keeps the top two seeds apart until the final', () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6])
})

test('a bracket with byes still produces a champion', () => {
  const event = { size: 16, seeded: true, legs: [2, 2, 2, 2] }
  const t = createTournament(event, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
  while (!t.finished) resolveRound(t, event, { avgFor: () => 80, matchLength: 'quick', rng: seededRng(1) })
  assert.ok(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].includes(t.champion))
})

test('opponents get harder deeper into an event and in bigger events', () => {
  const c = fresh()
  const early = opponentAverages(c, 85, { round: 0, tier: 1 }).expected
  const late = opponentAverages(c, 85, { round: 5, tier: 1 }).expected
  const major = opponentAverages(c, 85, { round: 5, tier: 4 }).expected
  assert.ok(late > early && major > late)
})

test('opponent averages are scaled to the player\'s own standard', () => {
  const pub = fresh({ avg: 40 })
  const pro = fresh({ avg: 90 })
  assert.ok(opponentAverages(pub, 85).expected < 45)
  assert.ok(opponentAverages(pro, 85).expected > 80)
})

test('match length setting scales tour formats', () => {
  const event = { legs: [6], sets: null }
  assert.equal(roundFormat(event, 0, 'quick').legs, 2)
  assert.equal(roundFormat(event, 0, 'full').legs, 6)
})

test('a new career starts at Q-School in January', () => {
  const c = fresh()
  advance(c, seededRng(2))
  assert.equal(currentEvent(c).name, 'Q-School Day 1')
  assert.ok(c.active)
  assert.equal(nextUserTask(c).kind, 'round')
})

test('reaching a Q-School day final wins a two-year Tour Card', () => {
  const c = fresh()
  const rng = seededRng(9)
  advance(c, rng)
  while (!c.active.tournament.finished) {
    simulateUntilUserMatch(c, rng)
    if (nextUserTask(c).kind !== 'round') break
    submitUserResult(c, { userWon: true, score: [3, 0], legs: [3, 0], userAvg: 60, oppAvg: 50, simulated: true }, rng)
  }
  finishEvent(c, rng)
  assert.equal(c.players.user.tour, 'pro')
  assert.equal(c.status.cardExpiry, c.year + 1)
  assert.equal(c.status.qschool, false)
  // Remaining Q-School days are skipped once a card is won.
  advance(c, rng)
  assert.notEqual(currentEvent(c).key, 'qschool')
})

test('Challenge Tour members cannot enter Players Championships', () => {
  const c = fresh()
  c.status.qschool = false
  c.eventIndex = 4
  const entry = resolveEntry(c, currentEvent(c), seededRng(1))
  assert.equal(currentEvent(c).key, 'pc')
  assert.equal(entry.userIn, false)
})

test('a card holder outside the top 32 must qualify for a European Tour event', () => {
  const c = fresh()
  const rng = seededRng(4)
  c.players.user.tour = 'pro'
  c.status = { qschool: false, cardExpiry: c.year + 1 }
  c.eventIndex = c.calendar.findIndex((e) => e.key === 'et')
  startEvent(c, rng)
  assert.equal(nextUserTask(c).kind, 'qualifier')
  submitUserResult(c, { userWon: true, score: [2, 1], legs: [2, 1], userAvg: 60, oppAvg: 55, simulated: true }, rng)
  simulateUntilUserMatch(c, rng)
  assert.equal(nextUserTask(c).kind, 'round')
  assert.ok(c.active.tournament.rounds[0].flat().includes('user'))
})

test('top two on the Challenge Tour earn a card; everyone else goes back to Q-School', () => {
  const winner = fresh()
  winner.status.qschool = false
  winner.players.user.ctMoney[winner.year] = 999999
  endSeason(winner, seededRng(1))
  assert.equal(winner.players.user.tour, 'pro')
  assert.equal(winner.status.cardExpiry, winner.year + 1)

  const loser = fresh()
  loser.status.qschool = false
  endSeason(loser, seededRng(1))
  assert.equal(loser.players.user.tour, 'challenge')
  assert.equal(loser.status.qschool, true)
})

test('a card expires outside the top 64 after two years', () => {
  const c = fresh()
  c.players.user.tour = 'pro'
  c.status = { qschool: false, cardExpiry: c.year }
  endSeason(c, seededRng(1))
  assert.equal(c.players.user.tour, 'challenge')
  assert.equal(c.status.qschool, true)

  const keeper = fresh()
  keeper.players.user.tour = 'pro'
  keeper.status = { qschool: false, cardExpiry: keeper.year }
  keeper.players.user.money[keeper.year] = 5000000
  endSeason(keeper, seededRng(1))
  assert.equal(keeper.players.user.tour, 'pro')
  assert.equal(keeper.status.cardExpiry, keeper.year + 1)
})

test('a full auto-simulated season completes and keeps the tour at 128 cards', () => {
  const c = fresh()
  const rng = seededRng(21)
  while (c.seasons.length < 1) {
    advance(c, rng)
    if (!c.active) continue
    for (;;) {
      simulateUntilUserMatch(c, rng)
      const task = nextUserTask(c)
      if (task.kind === 'qualifier' || task.kind === 'round') simulateUserMatch(c, rng)
      else break
    }
    finishEvent(c, rng)
  }
  assert.equal(c.year, 2028)
  const aiPros = proRanking(c).filter((id) => id !== 'user')
  assert.equal(aiPros.length, 128)
})
