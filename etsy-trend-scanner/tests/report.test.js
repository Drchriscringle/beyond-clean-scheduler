import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DEFAULT_CONFIG } from '../src/config.js'
import { writeDemoData } from '../src/demo.js'
import { buildReport } from '../src/report/build.js'
import {
  buildLongTail,
  buildRecommendation,
  formatMismatch,
  ipWarningFor,
  chooseForm,
  deadlineFor,
  suggestPrice,
} from '../src/report/recommend.js'
import { renderMarkdown } from '../src/report/markdown.js'
import { escapeHtml, renderHtml } from '../src/report/html.js'
import { CLASSES } from '../src/analyze/score.js'

const TODAY = new Date('2026-08-31T00:00:00Z')

function withTempConfig(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'etsy-trends-report-'))
  try {
    return fn({
      ...DEFAULT_CONFIG,
      etsyApiKey: '',
      dataDir: join(dir, 'data'),
      reportDir: join(dir, 'reports'),
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('chooseForm follows the keyword when it names a product', () => {
  // A shop that makes everything: the keyword decides.
  const profile = { ...DEFAULT_CONFIG.profile, formats: ['digital-download', 'print-on-demand', 'handmade-physical'] }
  const necklace = chooseForm(
    { term: 'personalised name necklace', detail: { digitalShare: 0.02, topTags: [] } },
    profile,
  )
  assert.equal(necklace.form, 'jewellery piece')

  const candle = chooseForm({ term: 'soy candle', detail: { digitalShare: 0.05, topTags: [] } }, profile)
  assert.equal(candle.form, 'handmade candle')
})

test('the default profile is digital-only, so every recommendation is a file', () => {
  assert.deepEqual(DEFAULT_CONFIG.profile.formats, ['digital-download'])
  // Even for a niche that screams physical product.
  const form = chooseForm(
    { term: 'personalised name necklace', detail: { digitalShare: 0.02, topTags: [] } },
    DEFAULT_CONFIG.profile,
  )
  assert.equal(form.format, 'digital-download')
})

test('chooseForm never proposes a format the shop cannot make', () => {
  const digitalOnly = { ...DEFAULT_CONFIG.profile, formats: ['digital-download'] }
  const form = chooseForm(
    { term: 'personalised name necklace', detail: { digitalShare: 0.02, topTags: [] } },
    digitalOnly,
  )
  assert.equal(form.format, 'digital-download')
  assert.equal(chooseForm({ term: 'x', detail: {} }, { formats: [] }), null)
})

test('chooseForm defers to what the niche is actually selling', () => {
  const profile = DEFAULT_CONFIG.profile
  // No product word in the term, but the niche is overwhelmingly digital.
  const form = chooseForm({ term: 'dark academia', detail: { digitalShare: 0.9, topTags: [] } }, profile)
  assert.equal(form.format, 'digital-download')
})

test('chooseForm follows what people actually search for over the niche name', () => {
  const digital = { ...DEFAULT_CONFIG.profile }
  // Nothing in "sourdough gift" names a product, so without the probe this
  // falls to the default digital form. The probe says people want tags.
  const withoutProbe = chooseForm(
    { term: 'sourdough gift', detail: { digitalShare: 0.5, topTags: [] } },
    digital,
  )
  const withProbe = chooseForm(
    {
      term: 'sourdough gift',
      detail: { digitalShare: 0.5, topTags: [] },
      trending: { formatExamples: ['sourdough gift printable tags'] },
    },
    digital,
  )

  assert.notEqual(withProbe.form, withoutProbe.form)
  assert.equal(withProbe.form, 'Canva editable template')
})

test('formatMismatch filters niches this shop cannot make', () => {
  const digitalOnly = { formats: ['digital-download'] }

  // Etsy says this niche sells objects, on a big enough sample to believe.
  const physical = formatMismatch(
    { detail: { digitalShare: 0.02, sampleSize: 100 } },
    digitalOnly,
  )
  assert.ok(physical)
  assert.match(physical.reason, /2% of listings here are digital/)
  assert.equal(physical.source, 'etsy')

  // Search intent says nobody wants this as a file.
  const searchSide = formatMismatch(
    { trending: { formatScore: 0 }, detail: {} },
    digitalOnly,
  )
  assert.equal(searchSide.source, 'search')

  // A genuinely digital niche passes.
  assert.equal(formatMismatch({ detail: { digitalShare: 0.8, sampleSize: 100 } }, digitalOnly), null)

  // A thin sample proves nothing either way — a brand-new trend must not be
  // rejected for having eleven listings.
  assert.equal(formatMismatch({ detail: { digitalShare: 0, sampleSize: 11 } }, digitalOnly), null)

  // No configured formats means no filtering.
  assert.equal(formatMismatch({ detail: { digitalShare: 0, sampleSize: 100 } }, { formats: [] }), null)
})

test('filtered niches are set aside and reported, not silently dropped', () => {
  withTempConfig((config) => {
    const demoConfig = writeDemoData({ config, today: TODAY })
    const result = buildReport({ config: demoConfig, today: TODAY })

    // The demo includes a jewellery niche, which a digital-only shop cannot make.
    const filtered = result.model.filtered.map((row) => row.term)
    assert.ok(filtered.includes('personalised name necklace'), filtered.join(', '))

    // It is absent from every recommendation section...
    const shown = result.model.sections.flatMap((section) => section.rows.map((row) => row.term))
    assert.ok(!shown.includes('personalised name necklace'))

    // ...but the reader is told why.
    assert.match(result.markdown, /Filtered out — wrong format for this shop/)
    assert.match(result.html, /Filtered out — wrong format for this shop/)
    assert.match(result.markdown, /listings here are digital/)
  })
})

test('suggestPrice aims high in a thin niche and low in a crowded one', () => {
  const detail = { medianPrice: 24, priceBand: [14, 38] }
  const thin = suggestPrice({ detail, parts: { competitionGap: 75 } }, null)
  const crowded = suggestPrice({ detail, parts: { competitionGap: 20 } }, null)
  assert.ok(thin.target > crowded.target)
  assert.ok(thin.target > 24 && crowded.target < 24)
  assert.match(String(thin.target), /\.99$/)
})

test('suggestPrice falls back to the product form when Etsy data is missing', () => {
  const price = suggestPrice({ detail: {}, parts: {} }, { priceBand: [10, 30] })
  assert.equal(price.source, 'form-default')
  assert.equal(price.target, 20.99, 'midpoint of the band, charm-priced')
  assert.equal(suggestPrice({ detail: {}, parts: {} }, null), null)
})

test('deadlineFor leaves work time before the list-by date', () => {
  const deadline = deadlineFor(
    {
      classification: CLASSES.SEASONAL,
      detail: { season: { listByDate: '2026-09-30', peakDate: '2026-11-14', event: 'Q4', missed: false } },
    },
    { effortDays: 3 },
    { today: TODAY, profile: { leadTimeDays: 7 } },
  )
  assert.equal(deadline.liveBy, '2026-09-30')
  assert.equal(deadline.startBy, '2026-09-20', '10 days of build and lead time')
})

test('deadlineFor gives an early trend a two-week race, and evergreens none', () => {
  const early = deadlineFor({ classification: CLASSES.EARLY, detail: {} }, { effortDays: 2 }, { today: TODAY })
  assert.equal(early.liveBy, '2026-09-14')
  assert.equal(deadlineFor({ classification: CLASSES.STEADY, detail: {} }, {}, { today: TODAY }), null)
})

test('a missed seasonal window produces no deadline to chase', () => {
  const deadline = deadlineFor(
    {
      classification: CLASSES.SEASONAL,
      detail: { season: { listByDate: '2026-08-01', peakDate: '2026-09-14', missed: true } },
    },
    { effortDays: 2 },
    { today: TODAY },
  )
  assert.equal(deadline, null)
})

test('a recommendation names a product, a price, tags and a title', () => {
  const rec = buildRecommendation(
    {
      term: 'whimsigothic',
      classification: CLASSES.EARLY,
      opportunity: 80,
      confidence: 'high',
      parts: { competitionGap: 72 },
      detail: {
        digitalShare: 0.55,
        personalisableShare: 0.1,
        medianPrice: 24,
        priceBand: [14, 38],
        topTags: [{ tag: 'wavy mirror' }],
        rising: { top: [{ query: 'whimsigothic mirror' }] },
      },
      evidence: [],
    },
    { config: DEFAULT_CONFIG, today: TODAY },
  )

  assert.equal(rec.action, 'List this week')
  assert.ok(rec.product.form)
  assert.ok(rec.price.target > 0)
  assert.ok(rec.tags.includes('whimsigothic'))
  assert.match(rec.title, /Whimsigothic/)
  assert.ok(rec.deadline.startBy < rec.deadline.liveBy)
})

test('buildLongTail ranks thin, untagged phrases first', () => {
  const rows = buildLongTail([
    { query: 'crowded phrase', parent: 'a', sources: ['trendsTop', 'autocomplete'], score: 5,
      untagged: false, etsy: { totalListings: 180_000 } },
    { query: 'thin untagged phrase', parent: 'a', sources: ['trendsTop', 'autocomplete'], score: 5,
      untagged: true, etsy: { totalListings: 320 } },
  ])

  assert.equal(rows[0].query, 'thin untagged phrase')
  assert.equal(rows[0].listings, 320)
  assert.ok(rows[0].roomToRank > rows[1].roomToRank)
})

test('buildLongTail keeps phrases that never got an Etsy lookup', () => {
  const rows = buildLongTail([
    { query: 'unpriced phrase', parent: 'a', sources: ['trendsTop'], score: 4, etsy: null },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].listings, null)
  assert.equal(rows[0].roomToRank, null)
})

test('a recommendation draws its tags from phrases people actually search', () => {
  const rec = buildRecommendation(
    {
      term: 'whimsigothic',
      classification: CLASSES.EARLY,
      opportunity: 80,
      confidence: 'high',
      parts: {},
      related: [
        { query: 'whimsigothic wall art', sources: ['trendsRising', 'autocomplete'], crossConfirmed: true },
        { query: 'whimsigothic rug', sources: ['autocomplete'], crossConfirmed: false },
      ],
      detail: { digitalShare: 0.5, topTags: [{ tag: 'filler tag' }] },
      evidence: [],
    },
    { config: DEFAULT_CONFIG, today: TODAY },
  )

  // The cross-confirmed phrase outranks both the single-source one and the
  // tag mined from competitors' listings.
  assert.ok(rec.tags.includes('whimsigothic wall'), rec.tags.join(', '))
  assert.ok(rec.tags.indexOf('whimsigothic wall') < rec.tags.indexOf('filler tag'))
})

test('a name-shaped trend carries a trademark warning; a generic one does not', () => {
  assert.equal(ipWarningFor({ trending: { ipRisk: 'low' } }), null)
  assert.equal(ipWarningFor({ trending: null }), null)

  const high = ipWarningFor({ trending: { ipRisk: 'high', ipReason: 'named entity' } })
  assert.equal(high.risk, 'high')
  assert.match(high.text, /trademark or copyright/)
  assert.match(high.text, /Sell the style/)

  const medium = ipWarningFor({ detail: { trending: { ipRisk: 'medium' } } })
  assert.match(medium.text, /check for a trademark/)
})

test('the full pipeline turns stored snapshots into a written report', () => {
  withTempConfig((config) => {
    const demoConfig = writeDemoData({ config, today: TODAY })
    const result = buildReport({ config: demoConfig, today: TODAY })

    assert.equal(result.model.date, '2026-08-31')
    assert.ok(result.model.recommendations.length >= 8)

    // The sample data is built to exercise every branch of the classifier.
    const classes = new Set(result.model.recommendations.map((row) => row.classification))
    for (const expected of [CLASSES.EARLY, CLASSES.SEASONAL, CLASSES.SATURATED]) {
      assert.ok(classes.has(expected), `expected the sample to produce ${expected}`)
    }

    // Every section's rows are disjoint — nothing is recommended and warned against.
    const seen = new Set()
    for (const section of result.model.sections) {
      for (const row of section.rows) {
        assert.ok(!seen.has(row.term), `${row.term} appears in two sections`)
        seen.add(row.term)
      }
    }

    const markdown = readFileSync(result.paths.markdown, 'utf8')
    assert.match(markdown, /^# Etsy listing plan — 2026-08-31/)
    assert.match(markdown, /Today's call/)
    assert.equal(readFileSync(result.paths.latestMarkdown, 'utf8'), markdown)

    const html = readFileSync(result.paths.html, 'utf8')
    assert.match(html, /<!doctype html>/)
    assert.match(html, /prefers-color-scheme/)

    // Related searches reach both renderings.
    assert.ok(result.model.longTail.length > 0, 'the sample produces long-tail phrases')
    assert.match(markdown, /People also search for:/)
    assert.match(markdown, /## Long-tail phrases worth claiming/)
    assert.match(html, /People also search for/)
    assert.match(html, /Long-tail phrases worth claiming/)

    // Discovery provenance and the trademark warning both reach the reader.
    assert.match(markdown, /Why this is here/)
    assert.match(markdown, /Trademark risk/)
    assert.match(html, /Why this is here/)
    assert.match(html, /Trademark risk/)
    assert.match(html, /What discovery saw today/)
  })
})

test('a report with no related data renders without the long-tail section', () => {
  const model = {
    date: '2026-08-31',
    generatedAt: '2026-08-31T00:00:00.000Z',
    geo: 'US',
    totalScanned: 0,
    sections: [],
    recommendations: [],
    longTail: [],
  }
  assert.ok(!renderMarkdown(model).includes('Long-tail phrases'))
  assert.ok(!renderHtml(model).includes('Long-tail phrases'))
})

test('reporting before any scan fails with an instruction, not a stack trace', () => {
  withTempConfig((config) => {
    assert.throws(() => buildReport({ config, today: TODAY }), /Run `npm run scan` first/)
  })
})

test('the report says so plainly when nothing is worth listing', () => {
  const empty = {
    date: '2026-08-31',
    generatedAt: '2026-08-31T00:00:00.000Z',
    geo: 'US',
    totalScanned: 0,
    sections: [],
    recommendations: [],
  }
  assert.match(renderMarkdown(empty), /Nothing is clearly worth listing today/)
  assert.match(renderHtml(empty), /Nothing cleared the bar today/)
})

test('rendered output escapes untrusted keyword text', () => {
  assert.equal(escapeHtml('<script>&"\''), '&lt;script&gt;&amp;&quot;&#39;')

  // Keywords come from Google's rising-query feed, so they are not ours to trust.
  const model = {
    date: '2026-08-31',
    generatedAt: '2026-08-31T00:00:00.000Z',
    geo: 'US',
    totalScanned: 1,
    sections: [
      {
        id: 'list-next',
        heading: 'List these next',
        blurb: '',
        rows: [
          {
            term: '<img src=x onerror=alert(1)>',
            action: 'List this week',
            classification: CLASSES.EARLY,
            opportunity: 80,
            confidence: 'high',
            rationale: 'x',
            parts: {},
            tags: ['<b>'],
            evidence: ['<i>'],
          },
        ],
      },
    ],
    recommendations: [],
  }

  const html = renderHtml(model)
  assert.ok(!html.includes('<img src=x'), 'raw markup must not reach the page')
  assert.match(html, /&lt;img src=x/)
})
