import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seededRng } from '../src/engine/rng.js'
import { bandFor, opponentAverage } from '../src/career/difficulty.js'
import { prizeFund, roundFormat, qualifierFormat } from '../src/career/formats.js'
import { createGroups, createKnockout, createStaged, resolveRound, seedOrder, stageFor } from '../src/career/tournament.js'
import { eligibility, buildField, worldCupTeams } from '../src/career/entry.js'
import { ranking } from '../src/career/rankings.js'
import { seasonSchedule } from '../src/career/data/schedule.js'
import { advance, currentEvent, endSeason, finishEvent, handleAction, newCareer, nextUserTask, setEntry, simulatePeriod, simulateUntilUserMatch, simulateUserMatch, touch } from '../src/career/career.js'

const fresh = (opts = {}) => newCareer({ name: 'Tester', nation: 'ENG', age: 30, avg: 70, ...opts }, seededRng(5))
const play = () => ({ winner: 0, score: [3, 1], legs: [3, 1], averages: [80, 70] })

test('the season matches the real calendar', () => {
  const s = seasonSchedule()
  const count = (k) => s.filter((e) => e.key === k).length
  assert.equal(count('pc'), 34)
  assert.equal(count('et'), 15)
  assert.equal(count('ct'), 24)
  assert.equal(count('dt'), 24)
  assert.equal(count('premier'), 16)
  assert.equal(s[0].name, 'Q-School First Stage Day 1')
  assert.equal(s.at(-1).key, 'worlds')
})

test('difficulty: Challenge Tour averages climb from 60–75 to 75–90', () => {
  assert.deepEqual(bandFor('dev', 0), [60, 75])
  assert.deepEqual(bandFor('dev', 1), [75, 90])
  const c = fresh({ difficultyMode: 'progressive' })
  const rng = seededRng(3)
  for (let i = 0; i < 100; i++) {
    const early = opponentAverage(c, 70, { level: 'dev', progress: 0 }, rng).actual
    const final = opponentAverage(c, 70, { level: 'dev', progress: 1 }, rng).actual
    assert.ok(early >= 60 && early <= 75)
    assert.ok(final >= 75 && final <= 90)
  }
})

test('difficulty: a 40-average player can play opponents between 30 and 50', () => {
  const c = fresh({ avg: 40, rangeMin: 30, rangeMax: 50 })
  assert.equal(c.user.difficulty.mode, 'range')
  const rng = seededRng(6)
  let early = 0
  let late = 0
  for (let i = 0; i < 200; i++) {
    const a = opponentAverage(c, 95, { level: 'worlds', progress: 0 }, rng).actual
    const b = opponentAverage(c, 60, { level: 'dev', progress: 1 }, rng).actual
    assert.ok(a >= 30 && a <= 50 && b >= 30 && b <= 50)
    early += a
    late += b
  }
  assert.ok(late > early, 'opponents get tougher later in an event')
  // With no range given, it defaults to around the player's own average.
  const d = fresh({ avg: 40 }).user.difficulty
  assert.deepEqual([d.rangeMin, d.rangeMax], [30, 50])
})

test('prize money rises every season', () => {
  const c = fresh()
  const before = prizeFund('worlds', c.prizeScale)
  endSeason(c, seededRng(2))
  assert.ok(c.prizeScale > 1.03 && c.prizeScale < 1.1)
  assert.ok(prizeFund('worlds', c.prizeScale) > before)
  assert.ok(c.inbox.some((m) => m.subject === `Prize money for ${c.year}`))
})

test('difficulty: fixed mode throws the chosen average', () => {
  const c = fresh({ difficultyMode: 'fixed', fixedAvg: 55 })
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(opponentAverage(c, 95, { level: 'worlds', progress: 1 }).actual - 55) < 6)
})

test('formats scale with match length and keep their special rules', () => {
  const mp = roundFormat('matchplay', 0, 'full')
  assert.equal(mp.legs, 10)
  assert.equal(mp.winBy2, true)
  assert.equal(mp.sdAt, 12)
  assert.equal(roundFormat('grandprix', 0, 'full').doubleIn, true)
  assert.equal(roundFormat('worlds', 6, 'full').sets, 7)
  assert.equal(roundFormat('pc', 0, 'quick').legs, 2)
  assert.equal(roundFormat('grandslam', 0, 'full', 3).legs, 5) // group match: best of 9
  assert.equal(qualifierFormat('full').legs, 6)
})

test('European Tour draws give the 16 seeds a bye to round two', () => {
  const entrants = Array.from({ length: 48 }, (_, i) => `x${i}`)
  const t = createKnockout(64, entrants, { seeded: true })
  const byes = t.rounds[0].filter((p) => p.includes(null))
  assert.equal(byes.length, 16)
  assert.ok(byes.every((p) => Number(p.find(Boolean).slice(1)) < 16))
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3])
})

test('UK Open: 160 players over nine rounds with staged entry', () => {
  const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`)
  const t = createStaged([ids('a', 64), ids('b', 32), ids('c', 32), ids('d', 32)], 9)
  while (!t.finished) resolveRound(t, play)
  assert.equal(t.results[0].length, 32)
  assert.equal(t.results[1].length, 32)
  assert.equal(t.results[3].length, 32)
  assert.equal(t.results[4].length, 16)
  assert.equal(stageFor(t, t.champion), 0)
})

test('Grand Slam: eight groups of four, top two into a 16-player knockout', () => {
  const groups = Array.from({ length: 8 }, (_, g) => [0, 1, 2, 3].map((i) => `g${g}p${i}`))
  const t = createGroups(groups, { advance: 2, koRounds: 4 })
  for (let md = 0; md < 3; md++) resolveRound(t, play)
  assert.equal(t.rounds[t.round].length, 8)
  assert.equal(Object.values(t.eliminated).filter((x) => x === 'group').length, 16)
  while (!t.finished) resolveRound(t, play)
  assert.ok(t.champion)
})

test('World Cup: 40 two-player teams, four seeds straight to round two', () => {
  const c = fresh()
  const teams = worldCupTeams(c)
  assert.equal(teams.length, 40)
  assert.ok(teams.every((t) => t.players.length === 2))
  const event = c.calendar.find((e) => e.key === 'worldcup')
  const field = buildField(c, event, false, seededRng(1))
  assert.equal(field.groups.length, 12)
  assert.equal(field.seedsToKo.length, 4)
  const t = createGroups(field.groups, { advance: 1, koRounds: 4, seedsToKo: field.seedsToKo })
  for (let md = 0; md < 3; md++) resolveRound(t, play)
  assert.equal(t.rounds[t.round].length, 8)
})

test('Q-School registration is required before January', () => {
  const c = fresh()
  const res = advance(c, seededRng(2))
  assert.equal(res.needs, 'qschool')
  const mail = c.inbox.find((m) => m.actions?.some((a) => a.action === 'registerQschool'))
  const bank = c.finance.bank
  handleAction(c, mail.id, 'registerQschool')
  assert.equal(c.finance.bank, bank - 570) // £475 + VAT at UK Q-School
  assert.equal(c.qschool.userStage, 'first')
  advance(c, seededRng(2))
  assert.equal(currentEvent(c).key, 'qsFirst')
  assert.equal(nextUserTask(c).kind, 'round')
})

test('reaching a Final Stage final wins a Tour Card', () => {
  const c = fresh()
  const rng = seededRng(9)
  advance(c, rng)
  handleAction(c, c.inbox.find((m) => m.actions?.some((a) => a.action === 'registerQschool')).id, 'registerQschool')
  c.qschool.userStage = 'final'
  c.qschool.exempt = true
  // Skip the First Stage days
  for (let i = 0; i < 3; i++) advance(c, rng)
  advance(c, rng)
  assert.equal(currentEvent(c).key, 'qsFinal')
  while (!c.active.tournament.finished) {
    simulateUntilUserMatch(c, rng)
    if (nextUserTask(c).kind !== 'round') break
    // submit a win by auto-sim with a huge average
    c.user.avg = 140
    simulateUserMatch(c, rng)
  }
  finishEvent(c, rng)
  assert.equal(c.players.user.tour, 'pro')
  assert.equal(c.players.user.cardExpiry, c.year + 1)
  assert.ok(c.inbox.some((m) => m.subject === 'Tour Card won!'))
})

test('entry rules follow the real tour', () => {
  const c = fresh({ age: 21 })
  const ev = (k) => c.calendar.find((e) => e.key === k)
  c.qschool.registered = true
  assert.equal(eligibility(c, ev('ct')).status, 'in')
  assert.equal(eligibility(c, ev('dt')).status, 'in')
  assert.equal(eligibility(c, ev('pc')).status, 'reserve')
  assert.equal(eligibility(c, ev('matchplay')).status, 'out')
  c.players.user.tour = 'pro'
  touch(c)
  assert.equal(eligibility(c, ev('ct')).status, 'out')
  assert.equal(eligibility(c, ev('pc')).status, 'in')
  assert.equal(eligibility(c, ev('et')).status, 'qualifier')
  assert.equal(eligibility(c, ev('ukopen')).status, 'in')
  c.players.user.earn[c.year] = { ranked: 9000000, pt: 9000000 }
  touch(c)
  assert.equal(eligibility(c, ev('et')).seed, true)
  assert.equal(eligibility(c, ev('matchplay')).status, 'in')
  assert.equal(eligibility(c, ev('worlds')).status, 'in')
})

test('entry confirmation emails gate events, and withdrawing skips them', () => {
  const c = fresh()
  const rng = seededRng(12)
  c.players.user.tour = 'pro'
  c.players.user.cardExpiry = c.year + 1
  c.qschool.registered = false
  touch(c)
  let res = advance(c, rng)
  while (res.needs !== 'entry') {
    if (res.needs === 'premier') handleAction(c, c.inbox.find((m) => m.actions?.some((a) => a.action === 'acceptPL')).id, 'acceptPL')
    res = advance(c, rng)
  }
  const e = currentEvent(c)
  assert.ok(c.inbox.some((m) => m.key === `entry-${e.id}`))
  setEntry(c, e.id, 'withdrawn')
  advance(c, rng)
  assert.notEqual(currentEvent(c).id, e.id)
  assert.equal(c.results[e.id].user, null)
})

test('season end: card rules for the user and the AI tour', () => {
  const keep = fresh()
  keep.players.user.tour = 'pro'
  keep.players.user.cardExpiry = keep.year
  keep.players.user.earn[keep.year] = { ranked: 5000000 }
  touch(keep)
  endSeason(keep, seededRng(1))
  assert.equal(keep.players.user.cardExpiry, keep.year + 1)

  const lose = fresh()
  lose.players.user.tour = 'pro'
  lose.players.user.cardExpiry = lose.year
  touch(lose)
  endSeason(lose, seededRng(1))
  assert.equal(lose.players.user.tour, 'challenge')
  assert.ok(lose.lastSeason.lostCards.includes('user'))
  assert.equal(lose.qschool.exempt, true) // lost cards go straight to the Final Stage

  const ct = fresh()
  ct.players.user.earn[ct.year] = { ct: 99999 }
  touch(ct)
  endSeason(ct, seededRng(1))
  assert.equal(ct.players.user.tour, 'pro')
})

test('a full season runs, keeps the tour near 128 cards and fills the inbox', () => {
  const c = fresh({ avg: 90, age: 22 })
  const rng = seededRng(21)
  let guard = 0
  while (c.seasons.length < 1 && guard++ < 3000) {
    const res = advance(c, rng)
    if (res.needs === 'qschool') { handleAction(c, c.inbox.find((m) => m.actions?.some((a) => a.action === 'registerQschool') && !m.resolved).id, 'registerQschool'); continue }
    if (res.needs === 'premier') { c.pl.pending = false; continue }
    if (res.needs === 'entry') { setEntry(c, currentEvent(c).id, 'confirmed'); continue }
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
  assert.ok(c.honours.some((h) => h.key === 'worlds'))
  const cards = Object.values(c.players).filter((p) => p.tour === 'pro').length
  assert.ok(cards > 90 && cards <= 132, `cards ${cards}`)
  assert.ok(c.inbox.length > 20)
  assert.ok(ranking(c, 'oom').length >= 128)
})

test('simulating a two-week holiday skips your events; playing mode enters them', () => {
  const setup = () => {
    const c = fresh({ avg: 90 })
    c.players.user.tour = 'pro'
    c.players.user.cardExpiry = c.year + 1
    c.qschool.registered = false
    c.pl.pending = false
    touch(c)
    c.eventIndex = c.calendar.findIndex((e) => e.name === 'Players Championship 1')
    return c
  }
  const start = (c) => Date.UTC(c.year, 1, 9)
  const away = setup()
  const res = simulatePeriod(away, { until: start(away) + 13 * 86400000, mode: 'skip' }, seededRng(3))
  assert.equal(res.played.length, 0)
  assert.ok(currentEvent(away).month >= 2 && (currentEvent(away).month > 2 || currentEvent(away).day > 22))
  assert.equal(away.results[away.calendar.find((e) => e.name === 'Players Championship 1').id].user, null)

  const home = setup()
  const r2 = simulatePeriod(home, { until: start(home) + 13 * 86400000, mode: 'play' }, seededRng(3))
  const names = r2.played.map((p) => p.name)
  assert.ok(names.includes('Players Championship 1') && names.includes('Players Championship 4'), names.join(', '))
  assert.equal(home.active, null)
})
