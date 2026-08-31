import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  cleanTag,
  emergingTags,
  fitTag,
  suggestTags,
  suggestTitle,
} from '../src/analyze/tags.js'

test('cleanTag rejects anything Etsy would not accept', () => {
  assert.equal(cleanTag('Cottagecore Print'), 'cottagecore print')
  assert.equal(cleanTag('  spaced   out  '), 'spaced out')
  assert.equal(cleanTag('a tag that is far too long for etsy'), null)
  assert.equal(cleanTag(''), null)
})

test('fitTag truncates on a word boundary instead of rejecting', () => {
  const fitted = fitTag('whimsigothic wall art print')
  assert.ok(fitted.length <= MAX_TAG_LENGTH)
  assert.equal(fitted, 'whimsigothic wall')
  // A truncation must not leave the tag dangling on a preposition.
  assert.equal(fitTag('christmas gift for her'), 'christmas gift')
  assert.equal(fitTag('short'), 'short')
  assert.equal(fitTag(''), null)
  assert.equal(fitTag('supercalifragilisticexpialidocious'), null, 'a single over-long word cannot be fitted')
})

test('emergingTags surfaces tags that were absent before', () => {
  const before = [
    { tag: 'halloween', count: 40 },
    { tag: 'spooky', count: 20 },
  ]
  const now = [
    { tag: 'halloween', count: 40 },
    { tag: 'spooky', count: 20 },
    { tag: 'cottage halloween', count: 18 },
  ]

  const emerging = emergingTags(now, before)
  assert.equal(emerging[0].tag, 'cottage halloween')
  assert.equal(emerging[0].isNew, true)
  assert.ok(emerging[0].delta > 0)
})

test('emergingTags returns nothing when a niche has not moved', () => {
  const tags = [{ tag: 'a', count: 10 }]
  assert.deepEqual(emergingTags(tags, tags), [])
  assert.deepEqual(emergingTags([], []), [])
})

test('suggestTags respects Etsy limits and puts the niche first', () => {
  const tags = suggestTags({
    term: 'whimsigothic',
    form: 'printable wall art set',
    topTags: Array.from({ length: 25 }, (_, i) => ({ tag: `filler tag ${i}` })),
    risingQueries: [{ query: 'whimsigothic mirror' }],
    seasonalTheme: 'halloween',
    personalisable: true,
  })

  assert.equal(tags[0], 'whimsigothic')
  assert.equal(tags.length, MAX_TAGS)
  assert.equal(new Set(tags).size, tags.length, 'no duplicates')
  for (const tag of tags) assert.ok(tag.length <= MAX_TAG_LENGTH, `"${tag}" is too long`)
})

test('suggestTags copes with a niche that has no data behind it', () => {
  const tags = suggestTags({ term: 'soy candle' })
  assert.deepEqual(tags, ['soy candle'])
})

test('suggestTitle uses the qualifier that matches the format', () => {
  assert.match(
    suggestTitle({ term: 'cottagecore', form: 'printable wall art set', format: 'digital-download' }),
    /Instant Download$/,
  )
  assert.match(
    suggestTitle({ term: 'soy candle', form: 'handmade candle', format: 'handmade-physical' }),
    /Handmade$/,
  )
  assert.match(
    suggestTitle({
      term: 'name necklace',
      form: 'jewellery piece',
      format: 'handmade-physical',
      personalisable: true,
    }),
    /Personalised/,
  )
})
