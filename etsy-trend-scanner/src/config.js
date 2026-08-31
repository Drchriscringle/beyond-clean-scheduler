import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Minimal .env reader. We deliberately avoid a dotenv dependency: this project
 * ships with zero runtime dependencies so it can run from a bare Node install
 * or a CI runner with no `npm install` step.
 */
export function loadEnvFile(path = join(projectRoot, '.env')) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

export const DEFAULT_CONFIG = {
  // Marketplace geography. Etsy demand is dominated by the US market; change
  // to your primary buyer country if that is not you.
  geo: 'US',
  currency: 'USD',
  language: 'en-US',

  // How the seller actually works. The report only recommends product forms
  // this shop can realistically produce, and weights them by preference.
  profile: {
    // Formats you can make, best first. Digital-only by default: files have no
    // stock, no shipping and no lead time, which is what lets you act on a
    // trend inside its window. Add 'print-on-demand' or 'handmade-physical'
    // here if you sell those too — everything downstream follows this list.
    formats: ['digital-download'],
    // Days between deciding to list and the listing being live and shippable.
    leadTimeDays: 7,
    // Listings need time to accumulate rank before a seasonal peak.
    rankRampDays: 21,
    // Ignore niches whose median price is below this: not worth the fees.
    minMedianPrice: 8,
  },

  // Scoring weights. These sum to 1.0 after normalisation; tune to taste.
  weights: {
    demand: 0.2, // absolute search interest right now
    momentum: 0.3, // is interest accelerating
    competitionGap: 0.25, // demand relative to how many sellers already there
    saturationRisk: 0.15, // penalty for sellers piling in faster than buyers
    seasonalFit: 0.1, // are we inside the listing window for an event
  },

  // Collection limits, kept modest to stay well inside Etsy's rate limits
  // (10 requests/second, 10,000/day for a standard app key).
  limits: {
    etsyListingsPerKeyword: 100,
    etsyRequestDelayMs: 250,
    trendsRequestDelayMs: 1500,
    maxKeywordsPerScan: 60,
    requestTimeoutMs: 20000,
    maxRetries: 3,
    // Autocomplete probes per keyword: 1 is the bare term, 2 adds the trailing
    // space that reaches the long tail. Raise for more breadth per keyword.
    suggestVariantsPerKeyword: 2,
    suggestRequestDelayMs: 300,
    // After the main pass, this many "people also search for" phrases get an
    // Etsy competition lookup of their own, so the long tail arrives with a
    // listing count attached rather than as a bare suggestion.
    relatedProbesPerScan: 20,
    trendingRequestDelayMs: 500,
  },

  // How many related searches to keep per keyword.
  relatedPerKeyword: 12,

  // Open-ended trend discovery. This is the primary way niches enter the scan:
  // the trending feeds are unseeded, so the tool finds what is actually moving
  // rather than only what someone thought to watch for.
  discovery: {
    enabled: true,
    // Trending terms harvested per run, before any screening.
    maxCandidates: 60,
    // Survivors of the free shape screen that get an autocomplete commerce
    // probe. Highest-traffic first, so the budget goes where it matters.
    maxCommercialProbes: 25,
    // Qualified trends that get the full Etsy + Trends treatment.
    maxQualified: 15,
    // Commercial-intent score a trend must clear to count as sellable at all.
    minCommercialScore: 30,
    // Formats the discovery probe tests for. Defaults to the seller profile
    // above, so a digital shop is asked "<term> printable" and "<term> svg"
    // rather than "<term> mug".
    formats: null,
    // A trend must score at least this in one of those formats to be relevant.
    // Sellable-but-wrong-format is a separate rejection from unsellable, and
    // both are reported.
    minFormatScore: 30,
  },

  // The seed niches are now an optional watchlist, not the universe. Turn this
  // on to keep a fixed set of terms in every scan alongside whatever discovery
  // turns up — useful for tracking niches you already sell in, and for giving
  // the supply-history series some stable members.
  watchlist: {
    enabled: false,
    maxKeywords: 12,
  },

  // How many days of stored snapshots the report reads.
  historyDays: 90,

  // How many recommendations the daily report lists.
  reportSize: 12,
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function mergeConfig(base, override) {
  if (!isPlainObject(override)) return base
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeConfig(base[key], value) : value
  }
  return out
}

/**
 * Resolve configuration from (lowest to highest precedence):
 * defaults -> config.json -> .env file -> process environment -> CLI overrides.
 */
export function loadConfig({ configPath, env = process.env, overrides = {} } = {}) {
  const path = configPath ?? join(projectRoot, 'config.json')
  let fileConfig = {}
  if (existsSync(path)) {
    try {
      fileConfig = JSON.parse(readFileSync(path, 'utf8'))
    } catch (err) {
      throw new Error(`Could not parse ${path}: ${err.message}`)
    }
  }

  const fileEnv = loadEnvFile()
  const merged = mergeConfig(mergeConfig(DEFAULT_CONFIG, fileConfig), overrides)

  merged.etsyApiKey = env.ETSY_API_KEY || fileEnv.ETSY_API_KEY || ''
  merged.geo = env.ETSY_TRENDS_GEO || fileEnv.ETSY_TRENDS_GEO || merged.geo
  merged.dataDir = env.ETSY_TRENDS_DATA_DIR || fileEnv.ETSY_TRENDS_DATA_DIR || join(projectRoot, 'data')
  merged.reportDir = env.ETSY_TRENDS_REPORT_DIR || fileEnv.ETSY_TRENDS_REPORT_DIR || join(projectRoot, 'reports')
  return merged
}

export function normalisedWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.abs(value), 0)
  if (total === 0) return weights
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total]))
}
