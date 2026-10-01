import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aimPoint, scoreAt } from '../src/engine/board.js'
import { checkoutRoute, chooseTarget, minDartsToFinish } from '../src/engine/checkout.js'
import { playVisit, sigmaForAverage } from '../src/engine/bot.js'
import { applyVisit, createMatch, interpretEnteredScore } from '../src/engine/match.js'
import { simulateMatch } from '../src/engine/sim.js'
import { seededRng } from '../src/engine/rng.js'

test('board geometry scores the right segments', () => {
  assert.equal(scoreAt(0, 0).label, 'DB')
  assert.equal(scoreAt(0, 10).label, 'SB')
  assert.equal(scoreAt(...aimPoint('T20')).label, 'T20')
  assert.equal(scoreAt(...aimPoint('D16')).label, 'D16')
  assert.equal(scoreAt(...aimPoint('S5')).label, 'S5')
  assert.equal(scoreAt(0, 200).label, 'MISS')
})

test('checkout routes follow standard pro choices', () => {
  assert.deepEqual(checkoutRoute(170), ['T20', 'T20', 'DB'])
  assert.deepEqual(checkoutRoute(100), ['T20', 'D20'])
  assert.deepEqual(checkoutRoute(40), ['D20'])
  assert.deepEqual(checkoutRoute(50), ['DB'])
  assert.equal(checkoutRoute(159), null)
  assert.equal(checkoutRoute(100, 1), null)
  assert.equal(minDartsToFinish(120), 3)
  assert.equal(minDartsToFinish(32), 1)
})

test('the thrower never sets up a bust and scores big when far out', () => {
  assert.equal(chooseTarget(501, 3), 'T20')
  for (let rem = 2; rem <= 170; rem++) {
    for (let d = 1; d <= 3; d++) {
      const t = chooseTarget(rem, d)
      assert.ok(t, `no target for ${rem}`)
    }
  }
})

test('a visit busts on going below 2 and only finishes on a double', () => {
  const rng = seededRng(7)
  for (let i = 0; i < 500; i++) {
    const rem = 2 + Math.floor(rng() * 60)
    const v = playVisit(rem, 20, rng)
    if (v.checkout) assert.equal(v.darts.at(-1).mult, 2)
    if (v.bust) assert.equal(v.scored, 0)
    assert.ok(v.remaining === 0 || v.remaining >= 2)
  }
})

test('calibrated opponents throw close to their target average', () => {
  const rng = seededRng(3)
  for (const target of [45, 70, 95]) {
    const sigma = sigmaForAverage(target)
    let darts = 0
    let points = 0
    for (let leg = 0; leg < 250; leg++) {
      let rem = 501
      while (rem > 0) {
        const v = playVisit(rem, sigma, rng)
        darts += v.darts.length
        points += v.scored
        rem -= v.scored
      }
    }
    const avg = (points * 3) / darts
    assert.ok(Math.abs(avg - target) < 5, `target ${target} got ${avg.toFixed(1)}`)
  }
})

test('typed scores: busts, impossible scores and checkouts', () => {
  assert.ok(interpretEnteredScore(501, 179).error)
  assert.ok(interpretEnteredScore(501, 181).error)
  assert.equal(interpretEnteredScore(40, 41).bust, true)
  assert.equal(interpretEnteredScore(40, 39).bust, true)
  assert.equal(interpretEnteredScore(40, 40, 1).checkout, true)
  assert.ok(interpretEnteredScore(159, 159, 3).error)
  assert.ok(interpretEnteredScore(120, 120, 2).error)
  assert.equal(interpretEnteredScore(100, 60).scored, 60)
})

test('legs and sets are won and the throw alternates', () => {
  let s = createMatch({ format: { legs: 2, sets: 2 }, startingPlayer: 0 })
  const checkout = (score) => ({ scored: score, checkout: true, dartsThrown: 3 })
  const winLeg = (p) => {
    if (s.turn !== p) s = applyVisit(s, { scored: 0, dartsThrown: 3 })
    s = applyVisit(s, { scored: 180, dartsThrown: 3 })
    s = applyVisit(s, { scored: 0, dartsThrown: 3 })
    s = applyVisit(s, { scored: 180, dartsThrown: 3 })
    s = applyVisit(s, { scored: 0, dartsThrown: 3 })
    s = applyVisit(s, checkout(141))
  }
  winLeg(0)
  assert.deepEqual(s.legs, [1, 0])
  assert.equal(s.turn, 1)
  winLeg(0)
  assert.deepEqual(s.sets, [1, 0])
  assert.deepEqual(s.legs, [0, 0])
  winLeg(0)
  winLeg(0)
  assert.equal(s.winner, 0)
  assert.equal(s.stats[0].s180, 8)
  assert.equal(s.stats[0].highCheckout, 141)
})

test('the stronger player usually wins a simulated match', () => {
  const rng = seededRng(11)
  let wins = 0
  for (let i = 0; i < 200; i++) if (simulateMatch(95, 75, { legs: 6, sets: 0 }, rng).winner === 0) wins++
  assert.ok(wins > 170, `won ${wins}/200`)
})
