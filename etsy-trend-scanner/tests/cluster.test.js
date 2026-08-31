import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clusterCandidates, sameTrend, similarity, tokenise } from '../src/analyze/cluster.js'

test('tokenise drops format words and years, keeping the subject', () => {
  assert.deepEqual([...tokenise('Wicked movie')], ['wicked'])
  assert.deepEqual([...tokenise('the Wicked film trailer 2026')], ['wicked'])
  assert.deepEqual([...tokenise('soy candle')].sort(), ['candle', 'soy'])
  assert.deepEqual([...tokenise('')], [])
})

test('similarity reports containment separately from overlap', () => {
  // A trend and its elaboration share every token of the shorter term, but
  // their Jaccard similarity is only 0.5 — containment is the useful signal.
  const nested = similarity('wicked', 'wicked soundtrack')
  assert.equal(nested.contained, true)
  assert.equal(nested.jaccard, 0.5)

  const unrelated = similarity('soy candle', 'wicked')
  assert.equal(unrelated.contained, false)
  assert.equal(unrelated.jaccard, 0)
})

test('sameTrend merges variants of one trend', () => {
  assert.ok(sameTrend('Wicked', 'Wicked movie'))
  assert.ok(sameTrend('wicked', 'wicked film soundtrack'))
  assert.ok(sameTrend('halloween decor', 'vintage halloween decor'))
  assert.ok(sameTrend('whimsigothic', 'whimsigothic bedroom'))
})

test('sameTrend keeps genuinely different niches apart', () => {
  assert.ok(!sameTrend('soy candle', 'beeswax candle'), 'different materials, different niches')
  assert.ok(!sameTrend('christmas gift', 'teacher gift'), 'sharing "gift" means nothing')
  assert.ok(!sameTrend('christmas gift', 'christmas decor'))
  assert.ok(!sameTrend('cottagecore', 'whimsigothic'))
})

test('a single weak shared token is never enough to merge', () => {
  // "gift" is contained in both, but merging on that basis would eventually
  // pull every gifting niche into one cluster.
  assert.ok(!sameTrend('gift', 'christmas gift'))
  assert.ok(!sameTrend('decor', 'halloween decor'))
  // A distinctive single token still counts.
  assert.ok(sameTrend('whimsigothic', 'whimsigothic'))
  assert.ok(sameTrend('labubu', 'labubu keychain'))
})

test('clustering collapses a renamed trend and keeps the strongest name', () => {
  const clusters = clusterCandidates([
    { term: 'Wicked movie', source: 'google-trending', traffic: 200_000, headlines: ['Wicked tops the box office'] },
    { term: 'Wicked', source: 'wikipedia', views: 400_000, headlines: [] },
    { term: 'wicked film soundtrack', source: 'google-trending', traffic: 50_000, headlines: [] },
    { term: 'soy candle', source: 'google-trending', traffic: 9_000, headlines: [] },
  ])

  assert.equal(clusters.length, 2, 'three names for one trend become one candidate')

  const wicked = clusters.find((row) => row.term.toLowerCase().startsWith('wicked'))
  // The searched phrase leads even though the Wikipedia article has more
  // pageviews — those are different units, and the searched wording is what
  // belongs in a listing title.
  assert.equal(wicked.term, 'Wicked movie')
  assert.deepEqual(wicked.aliases.sort(), ['Wicked', 'wicked film soundtrack'])

  // Two feeds naming the same trend is confirmation, not twice the traffic.
  assert.equal(wicked.traffic, 200_000)
  assert.deepEqual(wicked.sources.sort(), ['google-trending', 'wikipedia'])
  assert.ok(wicked.headlines.includes('Wicked tops the box office'))

  assert.ok(clusters.some((row) => row.term === 'soy candle'))
})

test('an article title leads only when nothing was searched', () => {
  const [cluster] = clusterCandidates([
    { term: 'Hollowcrown', source: 'wikipedia', views: 300_000 },
    { term: 'Hollowcrown series', source: 'wikipedia', views: 90_000 },
  ])
  assert.equal(cluster.term, 'Hollowcrown')
  assert.deepEqual(cluster.aliases, ['Hollowcrown series'])
})

test('clustering is greedy against leaders, not transitive', () => {
  // "gift" would bridge these two if merging chained through intermediates.
  const clusters = clusterCandidates([
    { term: 'christmas gift', traffic: 100 },
    { term: 'gift', traffic: 90 },
    { term: 'teacher gift', traffic: 80 },
  ])
  const terms = clusters.map((row) => row.term).sort()
  assert.deepEqual(terms, ['christmas gift', 'gift', 'teacher gift'])
})

test('clustering leaves a harvest with nothing in common untouched', () => {
  const input = [
    { term: 'cottagecore', traffic: 5 },
    { term: 'sourdough starter', traffic: 4 },
    { term: 'pickleball paddle', traffic: 3 },
  ]
  assert.equal(clusterCandidates(input).length, 3)
  assert.deepEqual(clusterCandidates([]), [])
})

test('clustering merges headlines and sources without duplicating them', () => {
  const [cluster] = clusterCandidates([
    { term: 'labubu', sources: ['google-trending'], traffic: 100, headlines: ['Labubu sells out'] },
    {
      term: 'labubu keychain',
      sources: ['google-trending', 'wikipedia'],
      traffic: 50,
      headlines: ['Labubu sells out', 'Where to buy'],
    },
  ])
  assert.deepEqual(cluster.sources, ['google-trending', 'wikipedia'])
  assert.deepEqual(cluster.headlines, ['Labubu sells out', 'Where to buy'])
})
