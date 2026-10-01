import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seededRng } from '../src/engine/rng.js'
import { parseSpokenScore } from '../src/voice.js'
import { applyVisit, createMatch } from '../src/engine/match.js'
import { eligibility } from '../src/career/entry.js'
import { newCareer, startEvent, submitUserResult, touch } from '../src/career/career.js'

const fresh = (opts = {}) => newCareer({ name: 'Tester', nation: 'ENG', age: 30, avg: 70, ...opts }, seededRng(5))

test('spoken scores are understood', () => {
  assert.deepEqual(parseSpokenScore('one hundred and forty'), { score: 140 })
  assert.deepEqual(parseSpokenScore('ton forty one'), { score: 141 })
  assert.deepEqual(parseSpokenScore('sixty'), { score: 60 })
  assert.deepEqual(parseSpokenScore('Twenty-six'), { score: 26 })
  assert.deepEqual(parseSpokenScore('one eighty!'), { score: 180 })
  assert.deepEqual(parseSpokenScore('maximum'), { score: 180 })
  assert.deepEqual(parseSpokenScore('100'), { score: 100 })
  assert.deepEqual(parseSpokenScore('no score'), { score: 0 })
  assert.deepEqual(parseSpokenScore('bust'), { bust: true })
  assert.deepEqual(parseSpokenScore('game shot'), { checkout: true })
  assert.deepEqual(parseSpokenScore('ton'), { score: 100 })
  assert.equal(parseSpokenScore('hello there'), null)
})

test('the match engine counts 170s and ton-plus finishes', () => {
  let m = createMatch({ format: { legs: 1, sets: 0 }, startingPlayer: 0 })
  for (const v of [180, 0, 151, 0]) m = applyVisit(m, { scored: v, dartsThrown: 3 })
  m = applyVisit(m, { scored: 170, checkout: true, dartsThrown: 3 })
  assert.equal(m.stats[0].bigFish, 1)
  assert.equal(m.stats[0].tonPlusOuts, 1)
})

test('a nine-darter on the oche pays a bonus and makes the papers', () => {
  const c = fresh()
  c.players.user.tour = 'pro'
  c.players.user.cardExpiry = c.year + 1
  touch(c)
  c.eventIndex = c.calendar.findIndex((e) => e.key === 'pc')
  startEvent(c, true, { status: 'in', reason: 'test' }, seededRng(1))
  const bank = c.finance.bank
  const stats = { darts: 9, points: 501, s180: 2, s140: 0, s100: 0, checkouts: 1, highCheckout: 141, legDarts: [9], dartsAtDouble: 1, doubles: {} }
  submitUserResult(c, { userWon: true, score: [1, 0], legs: [1, 0], userAvg: 167, oppAvg: 60, userStats: stats, simulated: false }, seededRng(2))
  assert.equal(c.finance.bank - bank, 5000)
  assert.ok(c.inbox.some((m) => m.subject.includes('Nine-dart bonus')))
  assert.equal(c.records.nineDarters.length, 1)
})

test("Women's Series and Seniors Tour entry rules", () => {
  const ev = (c, k) => c.calendar.find((e) => e.key === k)
  const man = fresh()
  assert.equal(eligibility(man, ev(man, 'women')).status, 'out')
  const woman = fresh({ gender: 'f' })
  assert.equal(eligibility(woman, ev(woman, 'women')).status, 'in')
  const young = fresh({ age: 30 })
  assert.equal(eligibility(young, ev(young, 'seniorsWorlds')).status, 'out')
  const veteran = fresh({ age: 52 })
  assert.equal(eligibility(veteran, ev(veteran, 'seniorsWorlds')).status, 'qualifier')
  veteran.players.user.tour = 'pro'
  touch(veteran)
  assert.equal(eligibility(veteran, ev(veteran, 'seniorsWorlds')).status, 'out')
})

test('a save file round-trips', async () => {
  const store = {}
  globalThis.localStorage ??= { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } }
  const { parseSave } = await import('../src/backup.js')
  const c = fresh({ name: 'Backup Test' })
  const text = JSON.stringify({ app: 'professional-darts-tour', career: c })
  const back = parseSave(text)
  assert.equal(back.players.user.name, 'Backup Test')
  assert.equal(back.settings.crowd, true)
  assert.throws(() => parseSave('{"hello":1}'), /isn't a Professional Darts Tour save/)
})

test('the caller gets more excited the bigger the score', async () => {
  const { scoreCall } = await import('../src/caller.js')
  const peak = (s) => Math.max(...scoreCall(s).map((p) => p.pitch))
  const slowest = (s) => Math.min(...scoreCall(s).map((p) => p.rate))
  assert.ok(peak(45) < peak(100) && peak(100) < peak(140) && peak(140) < peak(180))
  assert.ok(slowest(180) < slowest(140) && slowest(140) < slowest(45))
  assert.equal(scoreCall(180).length, 3) // "One hundred" ... "and" ... "eight-y!"
  assert.equal(scoreCall(45)[0].text, 'forty-five.')
  assert.equal(scoreCall(0)[0].text, 'No score.')
})


test('five different MCs, picked at random unless a favourite is chosen', async () => {
  const { ANNOUNCERS, pickAnnouncer } = await import('../src/caller.js')
  assert.equal(ANNOUNCERS.length, 5)
  const styles = new Set(ANNOUNCERS.map((a) => `${a.pitch}/${a.rate}/${a.excite}`))
  assert.equal(styles.size, 5, 'every MC sounds different')
  const rng = seededRng(3)
  const seen = new Set()
  for (let i = 0; i < 60; i++) seen.add(pickAnnouncer('random', rng).id)
  assert.equal(seen.size, 5)
  assert.equal(pickAnnouncer('kelly').name, 'Kelly Marsh')
})

test('store-safe names replace every trademarked event name', async () => {
  const store = {}
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } }
  const { brandText, setStoreNamePreview } = await import('../src/brand.js')
  const { seasonSchedule } = await import('../src/career/data/schedule.js')
  const { COMPETITIONS } = await import('../src/career/data/competitions.js')
  assert.equal(brandText('World Matchplay'), 'World Matchplay') // test build keeps real names
  setStoreNamePreview(true)
  assert.equal(brandText('Players Championship Finals'), 'Pro Tour Finals')
  assert.equal(brandText("Women's World Matchplay winner"), "Women's Matchplay winner")
  assert.equal(brandText('PDC Order of Merit'), 'PDT Order of Merit')
  assert.equal(brandText('Bahrain Darts Masters'), 'Bahrain Masters')
  assert.equal(brandText('European Darts Grand Prix'), 'European Grand Prix')
  const banned = /PDC|PDPA|Premier League|World Matchplay|Grand Slam|World Grand Prix|Players Championship|World Masters|UK Open|World Series|World Cup of Darts|Q-School|Challenge Tour|Development Tour|European Tour|European Championship| Darts (Masters|Open|Trophy|Grand Prix|Championship)/
  const all = [...seasonSchedule().map((e) => e.name), ...Object.values(COMPETITIONS).flatMap((c) => [c.name, c.blurb])]
  const leaks = all.map(brandText).filter((t) => banned.test(t))
  assert.deepEqual(leaks, [])
  setStoreNamePreview(false)
})

test('achievements unlock once, toast and email', async () => {
  const { checkAchievements } = await import('../src/career/achievements.js')
  const { newCareer } = await import('../src/career/career.js')
  const { seededRng } = await import('../src/engine/rng.js')
  const c = newCareer({ name: 'Tester', nation: 'ENG', age: 30, avg: 70 }, seededRng(9))
  c.stats.s180 = 1
  c.stats.won = 1
  const first = checkAchievements(c).map((a) => a.id)
  assert.ok(first.includes('first180') && first.includes('firstWin'))
  assert.ok(!first.includes('ten180'))
  assert.deepEqual(c.newAchievements, first)
  assert.ok(c.inbox.some((m) => m.from === 'Achievements'))
  assert.equal(checkAchievements(c).length, 0)
})

test('rivalries form from close head-to-heads and press answers move your profile', async () => {
  const { afterMatch, maybePress, answerPress, profileOf } = await import('../src/career/media.js')
  const { marketValue } = await import('../src/career/finance.js')
  const c = fresh()
  const opp = Object.keys(c.players).find((id) => id !== 'user' && !id.startsWith('w') && !id.startsWith('s'))
  const event = { key: 'pc', name: 'Players Championship 1', tier: 1 }
  c.h2h[opp] = { w: 2, l: 1, meetings: [] }
  afterMatch(c, { opponent: opp, won: false, stage: 'Last 64', event, played: true })
  assert.equal(c.rival?.id, opp)
  assert.ok(c.inbox.some((m) => m.subject.includes('rivalry')))
  const before = marketValue(c)
  maybePress(c, { opponent: opp, won: true, stage: 'Last 32', event, avg: 80, title: false, rng: () => 0.9 })
  assert.ok(c.pressPending, 'the media want to talk after a rival match')
  assert.equal(c.pressPending.answers.length, 3)
  const out = answerPress(c, 'fiery')
  assert.equal(out.profile, 4)
  assert.equal(profileOf(c), 54)
  assert.equal(c.pressPending, null)
  assert.ok(marketValue(c) >= before)
})
