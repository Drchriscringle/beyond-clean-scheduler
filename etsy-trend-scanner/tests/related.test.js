import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  addsSomething,
  describeRelated,
  longTailCandidates,
  mergeRelated,
} from '../src/analyze/related.js'
import { SuggestClient, parseSuggestions } from '../src/sources/suggest.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const fixture = (name) => readFileSync(join(fixtures, name), 'utf8')

test('parseSuggestions reads both response shapes Google serves', () => {
  assert.deepEqual(parseSuggestions(fixture('suggest-firefox.txt')), [
    'whimsigothic decor',
    'whimsigothic bedroom',
    'whimsigothic wall art',
  ])
  assert.deepEqual(parseSuggestions(fixture('suggest-chrome.txt')), [
    'soy candle gift',
    'soy candle wholesale',
  ])
  assert.deepEqual(parseSuggestions('["term"]'), [], 'a response with no completions is empty')
})

test('SuggestClient probes variants and keeps the best rank for each phrase', async () => {
  const calls = []
  const client = new SuggestClient({
    limits: { suggestRequestDelayMs: 0, maxRetries: 0, suggestVariantsPerKeyword: 2 },
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url).split('&q=')[1]))
      // The bare term ranks "wall art" third; the trailing-space probe ranks it
      // second and turns up a phrase the first probe never saw.
      const body = calls.length === 1 ? 'suggest-firefox.txt' : 'suggest-firefox-2.txt'
      return { ok: true, text: async () => fixture(body) }
    },
  })

  const result = await client.collect('whimsigothic')
  assert.deepEqual(calls, ['whimsigothic', 'whimsigothic '], 'the trailing space reaches the long tail')
  assert.equal(result.ok, true)

  const byQuery = Object.fromEntries(result.suggestions.map((row) => [row.query, row]))
  assert.equal(byQuery['whimsigothic wall art'].rank, 1, 'the better rank across probes wins')
  assert.ok(byQuery['whimsigothic squiggle mirror'], 'phrases only the second probe saw are kept')
  assert.equal(new Set(result.suggestions.map((r) => r.query)).size, result.suggestions.length)
  // Ordered best-rank first.
  assert.ok(result.suggestions[0].rank <= result.suggestions.at(-1).rank)
})

test('SuggestClient reports failure instead of throwing, and partial success', async () => {
  const dead = new SuggestClient({
    limits: { suggestRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async () => {
      throw new Error('network down')
    },
  })
  const failed = await dead.collect('anything')
  assert.equal(failed.ok, false)
  assert.match(failed.error, /network down/)
  assert.deepEqual(failed.suggestions, [])

  let call = 0
  const flaky = new SuggestClient({
    limits: { suggestRequestDelayMs: 0, maxRetries: 0, suggestVariantsPerKeyword: 2 },
    fetchImpl: async () => {
      call += 1
      if (call === 2) throw new Error('rate limited')
      return { ok: true, text: async () => fixture('suggest-firefox.txt') }
    },
  })
  const partial = await flaky.collect('whimsigothic')
  assert.equal(partial.ok, true)
  assert.equal(partial.partial, true)
})

test('addsSomething rejects phrases that only repeat the parent', () => {
  assert.ok(addsSomething('cottagecore', 'cottagecore mug'))
  assert.ok(!addsSomething('cottagecore', 'cottagecore'))
  assert.ok(!addsSomething('soy candle', 'candle soy'), 'a reordering adds nothing')
  assert.ok(addsSomething('soy candle', 'soy candle gift'))
})

test('mergeRelated combines every feed and marks cross-confirmation', () => {
  const rows = mergeRelated({
    term: 'whimsigothic',
    trendsTop: [{ query: 'whimsigothic decor', value: 100 }],
    trendsRising: [
      { query: 'whimsigothic wall art', value: 5000, breakout: true, formatted: 'Breakout' },
    ],
    suggestions: [
      { query: 'whimsigothic wall art', rank: 0 },
      { query: 'whimsigothic rug', rank: 4 },
    ],
    topTags: [
      { tag: 'whimsigothic decor', count: 30 },
      { tag: 'wavy mirror', count: 12 },
    ],
  })

  const byQuery = Object.fromEntries(rows.map((row) => [row.query, row]))

  // Seen by Google's rising feed and autocomplete.
  assert.deepEqual(byQuery['whimsigothic wall art'].sources.sort(), ['autocomplete', 'trendsRising'])
  assert.equal(byQuery['whimsigothic wall art'].crossConfirmed, true)
  assert.equal(byQuery['whimsigothic wall art'].breakout, true)
  assert.equal(byQuery['whimsigothic wall art'].inEtsyTags, false)

  // Seen by Google and already tagged by sellers.
  assert.equal(byQuery['whimsigothic decor'].inEtsyTags, true)
  assert.equal(byQuery['whimsigothic decor'].crossConfirmed, true)

  // Autocomplete only.
  assert.equal(byQuery['whimsigothic rug'].crossConfirmed, false)

  // The parent term never appears as its own related search.
  assert.ok(!rows.some((row) => row.query === 'whimsigothic'))
  // Cross-confirmed rows sort ahead of single-source ones.
  assert.ok(rows.findIndex((r) => r.crossConfirmed) < rows.findIndex((r) => !r.crossConfirmed))
})

test('mergeRelated survives every feed being empty', () => {
  assert.deepEqual(mergeRelated({ term: 'soy candle' }), [])
})

test('mergeRelated honours its limit', () => {
  const suggestions = Array.from({ length: 30 }, (_, i) => ({ query: `soy candle v${i}`, rank: i }))
  assert.equal(mergeRelated({ term: 'soy candle', suggestions, limit: 5 }).length, 5)
})

test('longTailCandidates favours multi-word phrases sellers have not tagged', () => {
  const related = {
    whimsigothic: [
      {
        query: 'whimsigothic wall art',
        sources: ['trendsRising', 'autocomplete'],
        crossConfirmed: true,
        breakout: true,
        inEtsyTags: false,
        score: 8,
      },
      {
        query: 'whimsigothic decor',
        sources: ['trendsTop', 'etsyTags'],
        crossConfirmed: true,
        inEtsyTags: true,
        score: 8,
      },
      // Single source: not worth an API call.
      { query: 'whimsigothic rug', sources: ['autocomplete'], crossConfirmed: false, score: 9 },
      // Single word: by definition not long tail.
      { query: 'mirrors', sources: ['trendsTop', 'autocomplete'], crossConfirmed: true, score: 9 },
    ],
  }

  const picks = longTailCandidates(related, { limit: 10 })
  assert.deepEqual(
    picks.map((row) => row.query),
    ['whimsigothic wall art', 'whimsigothic decor'],
  )
  assert.equal(picks[0].untagged, true)
  assert.equal(picks[0].parent, 'whimsigothic')
  assert.ok(picks[0].score > picks[1].score, 'the untagged phrase is worth more')
})

test('longTailCandidates skips terms already in the keyword universe', () => {
  const related = {
    whimsigothic: [
      {
        query: 'soy candle',
        sources: ['trendsTop', 'autocomplete'],
        crossConfirmed: true,
        score: 5,
      },
    ],
  }
  assert.deepEqual(longTailCandidates(related, { exclude: new Set(['soy candle']) }), [])
})

test('longTailCandidates de-duplicates a phrase suggested by two parents', () => {
  const shared = {
    query: 'personalised christmas gift',
    sources: ['trendsTop', 'autocomplete'],
    crossConfirmed: true,
    score: 5,
  }
  const picks = longTailCandidates({ 'christmas gift': [shared], 'stocking filler': [shared] })
  assert.equal(picks.length, 1)
})

test('describeRelated annotates growth and breakouts', () => {
  assert.equal(describeRelated([]), null)
  const line = describeRelated([
    { query: 'a', breakout: true },
    { query: 'b', growth: '+220%' },
    { query: 'c' },
  ])
  assert.equal(line, 'People also search for: "a" (breakout), "b" +220%, "c"')
})
