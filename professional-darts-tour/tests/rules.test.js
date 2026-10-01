import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordLeg } from '../src/engine/rules.js'
import { playVisit, sigmaForAverage } from '../src/engine/bot.js'
import { applyVisit, createMatch, pairsThrower } from '../src/engine/match.js'
import { fastMatch, legWinProbability } from '../src/engine/fastsim.js'
import { simulateMatch } from '../src/engine/sim.js'
import { seededRng } from '../src/engine/rng.js'

test('World Matchplay: must win by two, sudden death two past the target', () => {
  const f = { legs: 10, sets: 0, winBy2: true, sdAt: 12 }
  const s = { legs: [9, 9], sets: [0, 0] }
  assert.equal(recordLeg(s, f, 0).matchWinner, null) // 10-9: not two clear
  assert.equal(recordLeg(s, f, 1).matchWinner, null) // 10-10
  s.legs = [12, 12]
  assert.equal(recordLeg(s, f, 1).matchWinner, 1) // 12-13 sudden death
  const t = { legs: [10, 9], sets: [0, 0] }
  assert.equal(recordLeg(t, f, 0).matchWinner, 0) // 11-9
})

test('World Championship: deciding set goes to a tie-break', () => {
  const f = { legs: 3, sets: 3, setTiebreak: true }
  const s = { legs: [2, 2], sets: [2, 2] }
  assert.equal(recordLeg(s, f, 0).matchWinner, null) // 3-2 in the decider is not enough
  assert.equal(recordLeg(s, f, 0).matchWinner, 0) // 4-2
  const normal = { legs: [2, 2], sets: [1, 0] }
  assert.equal(recordLeg(normal, f, 0).setWon, true) // non-deciding set: 3-2 wins it
})

test('double-in: nothing scores until a double lands', () => {
  const rng = seededRng(4)
  for (let i = 0; i < 300; i++) {
    const v = playVisit(501, sigmaForAverage(70), rng, { needIn: true })
    if (!v.opened) assert.equal(v.scored, 0)
    if (v.opened) {
      const first = v.darts.findIndex((d) => d.mult === 2)
      assert.ok(first >= 0)
      assert.equal(v.scored, v.darts.slice(first).reduce((s, d) => s + d.value, 0))
    }
  }
})

test('pairs rotate team-mates each visit', () => {
  let m = createMatch({ format: { legs: 2, sets: 0, pairs: true }, startingPlayer: 0 })
  assert.equal(pairsThrower(m, 0), 0)
  m = applyVisit(m, { scored: 60, dartsThrown: 3 })
  m = applyVisit(m, { scored: 60, dartsThrown: 3 })
  assert.equal(pairsThrower(m, 0), 1)
})

test('the fast simulator agrees with the dart engine', () => {
  assert.ok(legWinProbability(80, 80) > 0.5) // throw advantage
  const rng = seededRng(8)
  let fast = 0
  let full = 0
  for (let i = 0; i < 400; i++) {
    if (fastMatch(88, 80, { legs: 6, sets: 0 }, rng).winner === 0) fast++
    if (i < 150 && simulateMatch(88, 80, { legs: 6, sets: 0 }, rng).winner === 0) full++
  }
  assert.ok(Math.abs(fast / 400 - full / 150) < 0.15, `fast ${fast / 400} full ${full / 150}`)
})
