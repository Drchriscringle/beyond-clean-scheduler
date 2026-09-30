import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seededRng } from '../src/engine/rng.js'

// Minimal localStorage for node.
const store = {}
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } }
const { knockoutOpponent, loadPub, recordPubResult, REGULARS, startKnockout } = await import('../src/pub.js')

const win = { userWon: true, score: [2, 1] }
const lose = { userWon: false, score: [0, 2] }

test('the regulars ladder unlocks one opponent at a time', () => {
  assert.equal(loadPub().ladder, 0)
  recordPubResult({ kind: 'ladder', id: REGULARS[1].id }, win) // not yet unlocked: no progress
  assert.equal(loadPub().ladder, 0)
  recordPubResult({ kind: 'ladder', id: REGULARS[0].id }, lose)
  assert.equal(loadPub().ladder, 0)
  recordPubResult({ kind: 'ladder', id: REGULARS[0].id }, win)
  assert.equal(loadPub().ladder, 1)
  assert.equal(loadPub().wins, 2)
})

test('winning three matches wins the pub knockout; losing plays the night out', () => {
  let p = startKnockout('regular', seededRng(1))
  for (let i = 0; i < 3; i++) {
    const opp = knockoutOpponent(p.knockout)
    assert.ok(opp)
    p = recordPubResult({ kind: 'knockout', id: opp }, win, seededRng(i))
  }
  assert.equal(p.knockout.champion, 'you')
  assert.equal(p.knockoutTitles, 1)

  p = startKnockout('tough', seededRng(2))
  p = recordPubResult({ kind: 'knockout', id: knockoutOpponent(p.knockout) }, lose, seededRng(3))
  assert.equal(p.knockout.out, true)
  assert.ok(p.knockout.champion && p.knockout.champion !== 'you')
})
