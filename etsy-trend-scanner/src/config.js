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
    // Formats you can make, best first. Remove anything you will not do.
    formats: ['digital-download', 'print-on-demand', 'handmade-physical'],
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
