import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  TrendingClient,
  decodeXmlText,
  extractBlocks,
  extractTag,
  normaliseWikiTitle,
  parseApproxTraffic,
  parseTrendingRss,
  wikipediaSpikes,
} from '../src/sources/trending.js'
import {
  commercialProbe,
  intellectualPropertyRisk,
  screenByShape,
  screenCandidates,
  scoreCompletions,
} from '../src/analyze/sellable.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const fixture = (name) => readFileSync(join(fixtures, name), 'utf8')

/* ---------------------------------------------------------------- *
 * XML reading
 * ---------------------------------------------------------------- */

test('decodeXmlText handles entities and CDATA', () => {
  assert.equal(decodeXmlText('Caf&#233; &amp; croissants'), 'Café & croissants')
  assert.equal(decodeXmlText('<![CDATA[raw & text]]>'), 'raw & text')
  assert.equal(decodeXmlText('  padded  '), 'padded')
  assert.equal(decodeXmlText(null), '')
})

test('extractBlocks and extractTag read namespaced tags with attributes', () => {
  const xml = '<item><a href="x">one</a></item><item><a>two</a></item>'
  assert.deepEqual(extractBlocks(xml, 'item'), ['<a href="x">one</a>', '<a>two</a>'])
  assert.equal(extractTag(xml, 'a'), 'one')
  assert.equal(extractTag('<ht:approx_traffic>5,000+</ht:approx_traffic>', 'ht:approx_traffic'), '5,000+')
  assert.equal(extractTag('<b>x</b>', 'missing'), null)
})

test('parseApproxTraffic strips the formatting Google applies', () => {
  assert.equal(parseApproxTraffic('500,000+'), 500000)
  assert.equal(parseApproxTraffic('2,000+'), 2000)
  assert.equal(parseApproxTraffic(null), null)
  assert.equal(parseApproxTraffic('n/a'), null)
})

test('parseTrendingRss pulls terms, traffic and the headlines behind them', () => {
  const rows = parseTrendingRss(fixture('trending-rss.xml'))
  assert.equal(rows.length, 3)

  const [first, fixtureRow, accented] = rows
  assert.equal(first.term, 'whimsigothic')
  assert.equal(first.traffic, 20000)
  assert.equal(first.source, 'google-trending')
  assert.deepEqual(first.headlines, [
    'The whimsigothic revival is everywhere',
    'How to get the look',
  ])

  // The headline is what makes this one screenable — the bare term is ambiguous.
  assert.match(fixtureRow.headlines[0], /final score/)

  assert.equal(accented.term, 'Café & croissants', 'entities are decoded')
  assert.equal(accented.traffic, 1000)
})

test('parseTrendingRss returns nothing rather than throwing on junk', () => {
  assert.deepEqual(parseTrendingRss(''), [])
  assert.deepEqual(parseTrendingRss('<rss><channel></channel></rss>'), [])
})

/* ---------------------------------------------------------------- *
 * Wikipedia spikes
 * ---------------------------------------------------------------- */

test('normaliseWikiTitle drops underscores and disambiguators', () => {
  assert.equal(normaliseWikiTitle('Wicked_(film)'), 'Wicked')
  assert.equal(normaliseWikiTitle('Ada_Lovelace'), 'Ada Lovelace')
  assert.equal(normaliseWikiTitle(''), '')
})

test('wikipediaSpikes finds climbers and ignores perennials and meta pages', () => {
  const today = JSON.parse(fixture('wiki-top-today.json')).items[0].articles
  const baseline = JSON.parse(fixture('wiki-top-baseline.json')).items[0].articles

  const spikes = wikipediaSpikes(today, baseline)
  const terms = spikes.map((row) => row.term)

  assert.ok(!terms.includes('Main Page'), 'housekeeping pages are never a trend')
  assert.ok(!terms.some((term) => term.startsWith('Special')), 'namespaces are excluded')
  assert.ok(!terms.includes('Cleopatra'), 'a perennial that fell in rank is not a spike')

  // Absent last week, second this week: the strongest possible signal.
  assert.equal(spikes[0].term, 'Wicked')
  assert.equal(spikes[0].isNew, true)

  // Present last week but climbing: a real but smaller move.
  const cottagecore = spikes.find((row) => row.term === 'Cottagecore')
  assert.equal(cottagecore.isNew, false)
  assert.equal(cottagecore.priorRank, 9)
  assert.equal(cottagecore.climb, 5)
})

test('wikipediaSpikes copes with a missing baseline', () => {
  const today = [{ article: 'Wicked_(film)', views: 100, rank: 1 }]
  const spikes = wikipediaSpikes(today, [])
  assert.equal(spikes.length, 1)
  assert.equal(spikes[0].isNew, true)
})

/* ---------------------------------------------------------------- *
 * TrendingClient
 * ---------------------------------------------------------------- */

test('TrendingClient merges both feeds and records cross-feed agreement', async () => {
  const client = new TrendingClient({
    limits: { trendingRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async (url) => {
      const text = String(url).includes('trending/rss')
        ? fixture('trending-rss.xml')
        : String(url).includes('/2026/08/30')
          ? fixture('wiki-top-today.json')
          : fixture('wiki-top-baseline.json')
      return { ok: true, text: async () => text }
    },
  })

  const result = await client.collect(new Date('2026-08-31T00:00:00Z'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])

  const terms = result.candidates.map((row) => row.term)
  assert.ok(terms.includes('whimsigothic'), 'search trends are included')
  assert.ok(terms.includes('Wicked'), 'pageview spikes are included')
})

test('TrendingClient survives one feed failing', async () => {
  const client = new TrendingClient({
    limits: { trendingRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async (url) => {
      if (String(url).includes('trending/rss')) throw new Error('HTTP 429')
      const text = String(url).includes('/2026/08/30')
        ? fixture('wiki-top-today.json')
        : fixture('wiki-top-baseline.json')
      return { ok: true, text: async () => text }
    },
  })

  const result = await client.collect(new Date('2026-08-31T00:00:00Z'))
  assert.equal(result.ok, true, 'one surviving feed still yields a harvest')
  assert.ok(result.candidates.length > 0)
  assert.match(result.errors.join(' '), /google trending: HTTP 429/)
})

test('TrendingClient reports total failure without throwing', async () => {
  const client = new TrendingClient({
    limits: { trendingRequestDelayMs: 0, maxRetries: 0 },
    fetchImpl: async () => {
      throw new Error('network down')
    },
  })
  const result = await client.collect(new Date('2026-08-31T00:00:00Z'))
  assert.equal(result.ok, false)
  assert.equal(result.candidates.length, 0)
  assert.equal(result.errors.length, 2)
})

/* ---------------------------------------------------------------- *
 * Sellability screening
 * ---------------------------------------------------------------- */

test('screenByShape rejects the recognisable forms of unsellable news', () => {
  const cases = [
    ['Chiefs vs Bills', 'fixture'],
    ['nfl scores today', 'score'],
    ['hurricane milton path', 'weather'],
    ['plane crash update', 'disaster'],
    ['actor dies at 80', 'obituary'],
    ['ceo arrested', 'crime'],
    ['election results live', 'politics'],
    ['tesla stock price', 'finance'],
    ['powerball winning numbers', 'lottery'],
    ['bank customer service', 'utility'],
    ['where to watch the game', 'broadcast'],
    ['lettuce recall listeria', 'recall'],
  ]
  for (const [term, reason] of cases) {
    const result = screenByShape({ term })
    assert.equal(result.passed, false, `"${term}" should be rejected`)
    assert.equal(result.reason, reason, `"${term}" reason`)
  }
})

test('screenByShape uses the headlines to disambiguate a bare term', () => {
  // "Cardinals" alone is a bird, a ball club or a conclave.
  assert.equal(screenByShape({ term: 'Cardinals' }).passed, true)
  assert.equal(
    screenByShape({ term: 'Cardinals', headlines: ['Cardinals vs Dodgers final score'] }).passed,
    false,
  )
})

test('screenByShape keeps the things that actually sell', () => {
  for (const term of ['whimsigothic', 'cottagecore', 'sourdough starter', 'Wicked', 'Labubu']) {
    assert.equal(screenByShape({ term }).passed, true, `"${term}" should survive`)
  }
})

test('intellectualPropertyRisk flags named entities without rejecting them', () => {
  assert.equal(intellectualPropertyRisk({ term: 'Wicked', source: 'wikipedia' }).risk, 'high')
  assert.equal(intellectualPropertyRisk({ term: 'Taylor Swift' }).risk, 'high')
  assert.equal(intellectualPropertyRisk({ term: 'cottagecore' }).risk, 'low')
  assert.equal(intellectualPropertyRisk({ term: 'sourdough starter gift' }).risk, 'low')
})

test('scoreCompletions only counts completions about the term with buying intent', () => {
  const matched = scoreCompletions('whimsigothic', [
    'whimsigothic wall art poster',
    'whimsigothic mug',
    'whimsigothic meaning', // about the term, but nobody is buying
    'cottagecore poster', // buying intent, wrong term
  ])
  assert.deepEqual(matched, ['whimsigothic wall art poster', 'whimsigothic mug'])
})

test('commercialProbe separates a merch market from a news story', async () => {
  const shoppable = {
    async fetchVariant(query) {
      const term = query.split(' ')[0]
      return [`${term} gift set`, `${term} poster print`, `${term} sticker pack`]
    },
  }
  const newsy = {
    async fetchVariant() {
      return ['hurricane path tracker', 'hurricane category 4']
    },
  }

  const good = await commercialProbe(shoppable, 'whimsigothic')
  const bad = await commercialProbe(newsy, 'hurricane')

  assert.ok(good.score > 60, `expected a strong commercial score, got ${good.score}`)
  assert.equal(bad.score, 0)
  assert.equal(good.probed, 4)
})

test('commercialProbe reports null rather than zero when every probe fails', async () => {
  const dead = {
    async fetchVariant() {
      throw new Error('rate limited')
    },
  }
  const result = await commercialProbe(dead, 'whimsigothic')
  assert.equal(result.score, null, 'no data is not the same as no demand')
  assert.equal(result.failures, 4)
})

test('screenCandidates spends its probe budget on the biggest trends first', async () => {
  const probed = []
  const suggest = {
    async fetchVariant(query) {
      probed.push(query)
      return [`${query} ideas`, `${query} set`]
    },
  }

  const result = await screenCandidates(
    [
      { term: 'small trend', traffic: 100 },
      { term: 'huge trend', traffic: 900000 },
      { term: 'hurricane warning', traffic: 950000 },
    ],
    suggest,
    { maxProbes: 1 },
  )

  assert.ok(
    probed.every((query) => query.startsWith('huge trend')),
    'the hurricane is screened out for free, and the budget goes to the biggest survivor',
  )
  assert.equal(result.rejected.length, 1)
  assert.equal(result.unprobed.length, 1)
})

test('screenCandidates carries candidates forward when autocomplete is unavailable', async () => {
  const result = await screenCandidates([{ term: 'whimsigothic', traffic: 500 }], null, {})
  assert.equal(result.qualified.length, 1)
  assert.equal(result.qualified[0].commerce.score, null)
})
