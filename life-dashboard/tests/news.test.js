import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { decodeEntities, parseFeed, searchFeedUrl, stripHtml, targetQuery } from '../server/news/feed.js'
import { canonicalUrl, dedupe, fold, mentions, recencyFactor, scoreItem, titleKey } from '../server/news/match.js'
import { createReel } from '../server/news/reel.js'
import { withStore } from './helpers.js'

const read = (name) => readFile(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')
const rss = await read('news-rss.xml')
const atom = await read('news-atom.xml')

const NOW = Date.parse('2026-09-13T12:00:00Z')

test('entities and markup are reduced to plain text', () => {
  assert.equal(decodeEntities('caf&#233; &amp; bar'), 'café & bar')
  assert.equal(decodeEntities('the region&#8217;s wildlife'), 'the region’s wildlife')
  assert.equal(stripHtml('<p>Hello <b>there</b></p>'), 'Hello there')
  assert.equal(stripHtml('<script>alert(1)</script>Safe'), 'Safe')
})

test('an RSS feed parses into items', () => {
  const { title, items } = parseFeed(rss, { sourceName: 'Trade Journal Daily' })
  assert.equal(title, 'Trade Journal Daily')
  assert.equal(items.length, 4)
  assert.equal(items[0].title, 'Acme Group wins £40m facilities contract')
  assert.equal(items[0].publishedAt, '2026-09-12T09:14:00.000Z')
  assert.equal(items[0].author, 'A Reporter')
  assert.match(items[0].summary, /five-year contract/)
})

test('CDATA-wrapped values are unwrapped', () => {
  const { items } = parseFeed(rss)
  assert.equal(items[1].title, 'Beta Services names new chief executive')
  assert.equal(items[1].summary, 'Jane Okafor joins from a rival, the company said.')
})

test('an Atom feed parses, taking links from attributes', () => {
  const { title, items } = parseFeed(atom)
  assert.equal(title, 'Regulator Notices')
  assert.equal(items.length, 2)
  assert.equal(items[1].url, 'https://regulator.example.gov/consultation-2026')
  assert.equal(items[1].publishedAt, '2026-09-13T06:00:00.000Z')
})

test('a feed that is not XML at all yields nothing rather than throwing', () => {
  assert.deepEqual(parseFeed('<html><body>404</body></html>').items, [])
  assert.deepEqual(parseFeed('').items, [])
})

test('folding makes accents and punctuation irrelevant', () => {
  assert.equal(fold('Nestlé'), 'nestle')
  assert.equal(fold('  ACME  Group! '), 'acme group')
})

test('matching is on whole words, so Apex does not catch apexes', () => {
  assert.equal(mentions('Apex predators return', 'apex'), true)
  assert.equal(mentions('Apexes and other things', 'apex'), false)
  assert.equal(mentions('Acme Group wins contract', 'Acme Group'), true)
  assert.equal(mentions('Acme Grouping wins', 'Acme Group'), false)
})

test('a headline mention outranks one in the summary', () => {
  const item = { title: 'Acme Group wins contract', summary: 'Beta Services lost out.', publishedAt: '2026-09-13T09:00:00Z' }
  const acme = scoreItem(item, { id: '1', name: 'Acme Group' }, { now: NOW })
  const beta = scoreItem(item, { id: '2', name: 'Beta Services' }, { now: NOW })
  assert.equal(acme.where, 'headline')
  assert.equal(beta.where, 'summary')
  assert.ok(acme.score > beta.score)
})

test('a target that matches nothing scores nothing', () => {
  const item = { title: 'Weather forecast', summary: 'Rain.', publishedAt: '2026-09-13T09:00:00Z' }
  assert.equal(scoreItem(item, { id: '1', name: 'Acme Group' }, { now: NOW }), null)
})

test('an exclusion kills a match outright', () => {
  const item = { title: 'Apex predators return to the valley', summary: 'Wildlife.', publishedAt: '2026-09-13T09:00:00Z' }
  assert.ok(scoreItem(item, { id: '1', name: 'Apex' }, { now: NOW }))
  assert.equal(scoreItem(item, { id: '1', name: 'Apex', exclude: ['predators'] }, { now: NOW }), null)
})

test('a required second subject narrows a noisy name', () => {
  const target = { id: '1', name: 'Acme', mustInclude: ['contract', 'acquisition'] }
  assert.ok(scoreItem({ title: 'Acme wins contract', summary: '', publishedAt: '2026-09-13T09:00:00Z' }, target, { now: NOW }))
  assert.equal(scoreItem({ title: 'Acme sponsors fun run', summary: '', publishedAt: '2026-09-13T09:00:00Z' }, target, { now: NOW }), null)
})

test('an alias matches as well as the name', () => {
  const target = { id: '1', name: 'Acme Group', aliases: ['Acme Holdings'] }
  const result = scoreItem({ title: 'Acme Holdings restructures', summary: '', publishedAt: '2026-09-13T09:00:00Z' }, target, { now: NOW })
  assert.deepEqual(result.matched, ['Acme Holdings'])
})

test('older stories sink', () => {
  assert.ok(recencyFactor('2026-09-13T10:00:00Z', NOW) > recencyFactor('2026-09-11T10:00:00Z', NOW))
  assert.ok(recencyFactor('2026-09-11T10:00:00Z', NOW) > recencyFactor('2026-08-01T10:00:00Z', NOW))
  assert.equal(recencyFactor(null, NOW), 0.6)
})

test('tracking parameters do not make two links look different', () => {
  assert.equal(
    canonicalUrl('https://www.example.com/story/?utm_source=rss&utm_medium=feed#top'),
    canonicalUrl('https://example.com/story'),
  )
})

test('a syndicated headline collapses onto the original', () => {
  assert.equal(
    titleKey('Acme Group wins £40m facilities contract - Trade Journal'),
    titleKey('Acme Group wins £40m facilities contract'),
  )
})

test('the same story from two feeds becomes one item crediting both', () => {
  const items = dedupe([
    { title: 'Acme wins contract', url: 'https://example.com/a?utm_source=x', sourceName: 'Trade Journal', publishedAt: '2026-09-12T09:14:00Z', score: 1, targets: ['t1'] },
    { title: 'Acme wins contract', url: 'https://www.example.com/a/', sourceName: 'Regulator Notices', publishedAt: '2026-09-12T09:20:00Z', score: 0.8, targets: ['t2'] },
  ])
  assert.equal(items.length, 1)
  assert.deepEqual(items[0].sources, ['Trade Journal', 'Regulator Notices'])
  assert.equal(items[0].publishedAt, '2026-09-12T09:14:00Z', 'the earliest copy dates the story')
  assert.deepEqual(items[0].targets, ['t1', 't2'])
})

test('genuinely different stories are not merged', () => {
  const items = dedupe([
    { title: 'Acme wins contract', url: 'https://example.com/a', sourceName: 'A' },
    { title: 'Beta names chief executive', url: 'https://example.com/b', sourceName: 'A' },
  ])
  assert.equal(items.length, 2)
})

test('a query quotes multi-word names and applies exclusions', () => {
  assert.equal(targetQuery({ name: 'Acme Group' }), '"Acme Group"')
  assert.equal(
    targetQuery({ name: 'Apex', aliases: ['Apex Ltd'], exclude: ['predators'] }),
    '(Apex OR "Apex Ltd") -predators',
  )
})

test('a search feed is a real, well-formed URL', () => {
  const url = new URL(searchFeedUrl('"Acme Group"', { language: 'en-GB', country: 'GB' }))
  assert.equal(url.hostname, 'news.google.com')
  assert.equal(url.searchParams.get('q'), '"Acme Group"')
  assert.equal(url.searchParams.get('ceid'), 'GB:en')
})

/** Serves the two fixtures to whichever URL asks. */
function stubNews({ failOn = null } = {}) {
  const calls = []
  return async (url) => {
    calls.push(url)
    if (failOn && url.includes(failOn)) throw new Error('feed is down')
    const body = url.includes('regulator') ? atom : rss
    return { ok: true, status: 200, headers: new Headers(), text: async () => body }
  }
}

test('the reel matches stories to the watchlist', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'acme', name: 'Acme Group', kind: 'company' })
  await store.add('targets', { id: 'jane', name: 'Jane Okafor', kind: 'person' })
  const reel = createReel({ store, fetchImpl: stubNews(), now: () => NOW })

  const { items, targets } = await reel.build({ today: '2026-09-13', days: 7 })
  assert.ok(items.length > 0)
  assert.equal(items[0].title, 'Acme Group wins £40m facilities contract')
  assert.equal(targets.find((target) => target.id === 'acme').count, 1)
  assert.equal(targets.find((target) => target.id === 'jane').count, 1)
})

test('stories older than the window are left out', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'acme', name: 'Acme Group', kind: 'company' })
  const reel = createReel({ store, fetchImpl: stubNews(), now: () => NOW })

  const { items } = await reel.build({ today: '2026-09-13', days: 7 })
  assert.equal(items.some((item) => item.title.includes('last year')), false)
})

test('one story matching two targets is credited to both, once', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'acme', name: 'Acme Group', kind: 'company' })
  await store.add('targets', { id: 'beta', name: 'Beta Services', kind: 'company' })
  const reel = createReel({ store, fetchImpl: stubNews(), now: () => NOW })

  const { items } = await reel.build({ today: '2026-09-13', days: 7 })
  const contract = items.find((item) => item.title.startsWith('Acme Group wins'))
  assert.deepEqual(contract.targets.map((target) => target.id).sort(), ['acme', 'beta'])
  assert.equal(items.filter((item) => item.title.startsWith('Acme Group wins')).length, 1)
})

test('a subscribed feed is matched against the whole watchlist', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'std', name: 'cleaning standards', kind: 'topic' })
  await store.add('newsSources', { id: 'reg', name: 'Regulator', url: 'https://regulator.example.gov/feed.atom' })
  const reel = createReel({ store, fetchImpl: stubNews(), now: () => NOW })

  const { items } = await reel.build({ today: '2026-09-13', days: 7, search: false })
  assert.equal(items[0].title, 'Consultation opened on cleaning standards')
})

test('a dead feed is reported without emptying the reel', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'acme', name: 'Acme Group', kind: 'company' })
  await store.add('newsSources', { id: 'dead', name: 'Dead', url: 'https://dead.example.com/feed' })
  const reel = createReel({ store, fetchImpl: stubNews({ failOn: 'dead.example' }), now: () => NOW })

  const { items, problems } = await reel.build({ today: '2026-09-13', days: 7 })
  assert.ok(items.length > 0)
  assert.equal(problems.length, 1)
  assert.match(problems[0].error, /down/)
})

test('a dismissed story stays gone', async (t) => {
  const store = await withStore(t)
  await store.add('targets', { id: 'acme', name: 'Acme Group', kind: 'company' })
  const reel = createReel({ store, fetchImpl: stubNews(), now: () => NOW })

  const before = await reel.build({ today: '2026-09-13', days: 7 })
  await store.add('dismissals', { kind: 'news', key: before.items[0].url })
  const after = await reel.build({ today: '2026-09-13', days: 7 })

  assert.equal(after.items.length, before.items.length - 1)
})

test('an empty watchlist does no fetching at all', async (t) => {
  const store = await withStore(t)
  const fetchImpl = stubNews()
  let calls = 0
  const counting = async (...args) => { calls += 1; return fetchImpl(...args) }
  const reel = createReel({ store, fetchImpl: counting, now: () => NOW })

  const { items } = await reel.build({ today: '2026-09-13' })
  assert.deepEqual(items, [])
  assert.equal(calls, 0)
})
