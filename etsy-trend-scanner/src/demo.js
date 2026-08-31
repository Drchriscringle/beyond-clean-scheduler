/**
 * Sample data generator.
 *
 * Two purposes: it lets someone see exactly what the daily report looks like
 * before signing up for an Etsy API key, and it gives the tests a realistic,
 * deterministic fixture covering every classification the scorer can emit.
 *
 * The numbers are synthetic. `demo` writes to its own data directory so it can
 * never contaminate real snapshots.
 */

import { join } from 'node:path'
import { SnapshotStore } from './store.js'
import { addDays, toISODate } from './seasonal.js'

/** Deterministic PRNG so the sample report is stable across runs. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Archetypes, one per outcome the report can produce, so the sample exercises
 * the whole classifier rather than just the happy path.
 */
const ARCHETYPES = [
  {
    term: 'whimsigothic',
    category: 'home-decor',
    // Flat all year, then a sharp recent climb off a small base: the shape the
    // "starting to trend" branch exists to catch.
    curve: (i) => (i < 40 ? 8 + i * 0.2 : 16 + (i - 40) ** 1.9),
    listings: { start: 2400, dailyGrowth: 0.0016 },
    price: [14, 24, 38],
    digitalShare: 0.55,
    personalisableShare: 0.2,
    rising: [
      { query: 'whimsigothic wall art', value: 5000, breakout: true, formatted: 'Breakout' },
      { query: 'whimsigothic mirror', value: 900, formatted: '+900%' },
      { query: 'whimsigothic bedroom', value: 420, formatted: '+420%' },
    ],
    tags: ['whimsigothic', 'wavy mirror', '70s decor', 'squiggle art', 'maximalist'],
  },
  {
    term: 'crochet plushie',
    category: 'craft-supplies',
    curve: (i) => 45 + 40 * Math.sin(i / 7) * 0.3 + i * 0.9,
    listings: { start: 61000, dailyGrowth: 0.004 },
    price: [12, 19, 32],
    digitalShare: 0.7,
    personalisableShare: 0.1,
    rising: [{ query: 'crochet plushie pattern', value: 260, formatted: '+260%' }],
    tags: ['crochet pattern', 'amigurumi', 'plushie pattern', 'pdf pattern', 'beginner crochet'],
  },
  {
    term: 'halloween decor',
    category: 'home-decor',
    curve: (i) => 20 + Math.max(0, (i - 30) * 2.4),
    listings: { start: 148000, dailyGrowth: 0.006 },
    price: [16, 28, 46],
    digitalShare: 0.25,
    personalisableShare: 0.35,
    rising: [{ query: 'vintage halloween decor', value: 180, formatted: '+180%' }],
    tags: ['halloween decor', 'spooky decor', 'fall decor', 'ghost decor', 'vintage halloween'],
  },
  {
    term: 'personalised name necklace',
    category: 'jewellery',
    curve: (i) => 62 + 6 * Math.sin(i / 5),
    listings: { start: 214000, dailyGrowth: 0.0012 },
    price: [22, 34, 58],
    digitalShare: 0.02,
    personalisableShare: 0.92,
    rising: [],
    tags: ['name necklace', 'custom necklace', 'gift for her', 'personalised gift', 'dainty jewelry'],
  },
  {
    term: 'tumbler wrap png',
    category: 'craft-supplies',
    // Peaked hard last year and has been sliding since: the fading case.
    curve: (i) => Math.max(4, 95 - i * 1.5),
    listings: { start: 96000, dailyGrowth: 0.009 },
    price: [3, 5, 9],
    digitalShare: 0.98,
    personalisableShare: 0.05,
    rising: [],
    tags: ['tumbler wrap', 'sublimation png', '20oz tumbler', 'seamless design', 'digital download'],
  },
  {
    term: 'sourdough gift',
    category: 'home-decor',
    curve: (i) => 30 + i * 0.5 + (i > 44 ? (i - 44) * 4 : 0),
    listings: { start: 8900, dailyGrowth: 0.003 },
    price: [18, 29, 45],
    digitalShare: 0.3,
    personalisableShare: 0.45,
    rising: [
      { query: 'sourdough starter gift', value: 5000, breakout: true, formatted: 'Breakout' },
      { query: 'bread lover gift', value: 310, formatted: '+310%' },
    ],
    tags: ['sourdough gift', 'baker gift', 'bread lover', 'kitchen decor', 'foodie gift'],
  },
  {
    term: 'christmas gift',
    category: 'seasonal',
    curve: (i) => 12 + Math.max(0, (i - 42) * 3),
    listings: { start: 1_240_000, dailyGrowth: 0.005 },
    price: [15, 26, 44],
    digitalShare: 0.3,
    personalisableShare: 0.6,
    rising: [{ query: 'personalised christmas gift', value: 220, formatted: '+220%' }],
    tags: ['christmas gift', 'stocking filler', 'secret santa', 'xmas gift', 'holiday decor'],
  },
  {
    term: 'teacher gift',
    category: 'seasonal',
    curve: (i) => 25 + 25 * Math.max(0, Math.sin((i - 20) / 9)),
    listings: { start: 74000, dailyGrowth: 0.002 },
    price: [11, 18, 30],
    digitalShare: 0.6,
    personalisableShare: 0.7,
    rising: [{ query: 'teacher appreciation gift', value: 150, formatted: '+150%' }],
    tags: ['teacher gift', 'thank you teacher', 'teacher appreciation', 'end of year', 'classroom'],
  },
]

function weeklySeries(archetype, today, rng) {
  const points = []
  for (let i = 0; i < 52; i += 1) {
    const raw = archetype.curve(i) + (rng() - 0.5) * 4
    points.push({
      date: toISODate(addDays(today, -(51 - i) * 7)),
      value: Math.max(0, Math.min(100, Math.round(raw))),
    })
  }
  // Google Trends normalises each series to its own peak.
  const peak = Math.max(...points.map((p) => p.value), 1)
  return points.map((p) => ({ ...p, value: Math.round((p.value / peak) * 100) }))
}

function etsyRow(archetype, dayOffset, rng) {
  const [p25, median, p75] = archetype.price
  const total = Math.round(
    archetype.listings.start * (1 + archetype.listings.dailyGrowth) ** (30 - dayOffset),
  )
  const entry = Math.min(0.4, archetype.listings.dailyGrowth * 22 + rng() * 0.01)
  return {
    ok: true,
    totalListings: total,
    sampleSize: 100,
    newListings7d: Math.round(entry * 100),
    newListings30d: Math.round(Math.min(100, entry * 380)),
    sellerEntryRate: entry,
    medianPrice: median,
    p25Price: p25,
    p75Price: p75,
    digitalShare: archetype.digitalShare,
    personalisableShare: archetype.personalisableShare,
    topTags: archetype.tags.map((tag, index) => ({
      tag,
      // The last tag only shows up in recent snapshots, so the emerging-tag
      // detector has something real to find.
      count: index === archetype.tags.length - 1 && dayOffset > 14 ? 0 : 40 - index * 6,
    })).filter((row) => row.count > 0),
  }
}

/**
 * Write 31 days of sample snapshots into a separate demo data directory and
 * return a config pointing at it.
 */
export function writeDemoData({ config, today = new Date(), days = 31 } = {}) {
  const demoConfig = {
    ...config,
    dataDir: join(config.dataDir, 'demo'),
    reportDir: join(config.reportDir, 'demo'),
  }
  const store = new SnapshotStore(demoConfig.dataDir)
  const rng = mulberry32(20260101)

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = addDays(today, -dayOffset)
    const keywords = {}
    for (const archetype of ARCHETYPES) {
      keywords[archetype.term] = {
        category: archetype.category,
        origin: 'seed',
        etsy: etsyRow(archetype, dayOffset, rng),
        // Only the newest snapshot needs the full curve; older days keep the
        // file small, mirroring how a real scan trims aged detail.
        trends:
          dayOffset === 0
            ? {
                series: weeklySeries(archetype, date, rng),
                rising: archetype.rising,
                top: archetype.rising,
              }
            : { series: [], rising: [] },
      }
    }
    store.save({
      date: toISODate(date),
      generatedAt: new Date(date).toISOString(),
      geo: demoConfig.geo,
      sources: { etsy: true, googleTrends: true },
      notes: ['Sample data — generated by `etsy-trends demo`, not collected from live APIs.'],
      keywords,
    })
  }

  return demoConfig
}

export { ARCHETYPES }
