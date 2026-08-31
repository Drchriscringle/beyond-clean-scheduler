/**
 * Scan orchestration: collect today's numbers for the keyword universe and
 * write one snapshot file.
 *
 * Design rule throughout: no single source is allowed to fail the scan. If
 * Etsy's key is missing we still record demand; if Google Trends rate-limits
 * we still record supply. A partial snapshot is far more useful than none,
 * because tomorrow's momentum calculation needs today's row to exist.
 */

import { EtsyClient, collectEtsyMetrics } from './sources/etsy.js'
import { TrendsClient } from './sources/googleTrends.js'
import { activeSeasonalThemes, toISODate } from './seasonal.js'
import { buildKeywordUniverse, isUsableTerm, normaliseTerm } from './keywords.js'
import { SnapshotStore } from './store.js'

/** Rising queries worth adding to the watch list: breakouts and big movers. */
export function harvestDiscoveries(term, trends, { minValue = 150 } = {}) {
  const out = []
  for (const row of trends?.rising ?? []) {
    if (!row.breakout && (row.value ?? 0) < minValue) continue
    const candidate = normaliseTerm(row.query)
    if (!isUsableTerm(candidate)) continue
    out.push({ term: candidate, category: 'discovered', parent: term })
  }
  return out
}

export async function runScan({
  config,
  today = new Date(),
  logger = console.error,
  etsyClient,
  trendsClient,
  useEtsy = true,
  useTrends = true,
  limit,
  only = [],
} = {}) {
  const date = toISODate(today)
  const store = new SnapshotStore(config.dataDir)

  const etsy =
    useEtsy && config.etsyApiKey
      ? (etsyClient ??
        new EtsyClient({ apiKey: config.etsyApiKey, limits: config.limits, logger }))
      : null
  const trends =
    useTrends
      ? (trendsClient ??
        new TrendsClient({
          geo: config.geo,
          language: config.language,
          limits: config.limits,
          logger,
        }))
      : null

  const universe = only.length
    ? only.map((term) => ({ term: normaliseTerm(term), category: 'manual', origin: 'manual' }))
    : buildKeywordUniverse({
        discovered: [...store.readDiscovered(), ...activeSeasonalThemes(today)],
        max: limit ?? config.limits.maxKeywordsPerScan,
      })

  const keywords = {}
  const notes = []
  const discoveries = []
  let etsyFailures = 0
  let trendsFailures = 0

  if (!etsy && useEtsy) {
    notes.push(
      'ETSY_API_KEY is not set, so competition and price data are missing. Scores fall back to search demand and the seasonal calendar only.',
    )
  }

  for (const [index, entry] of universe.entries()) {
    logger(`[${index + 1}/${universe.length}] ${entry.term}`)

    const [etsyResult, trendsResult] = await Promise.all([
      etsy ? collectEtsyMetrics(etsy, entry.term, { now: today }) : Promise.resolve(null),
      trends ? trends.collect(entry.term) : Promise.resolve(null),
    ])

    if (etsyResult && !etsyResult.ok) etsyFailures += 1
    if (trendsResult && !trendsResult.ok) trendsFailures += 1
    if (trendsResult?.ok) discoveries.push(...harvestDiscoveries(entry.term, trendsResult))

    keywords[entry.term] = {
      category: entry.category,
      origin: entry.origin,
      etsy: etsyResult ?? undefined,
      trends: trendsResult?.ok
        ? { series: trendsResult.series, rising: trendsResult.rising, top: trendsResult.top }
        : trendsResult
          ? { ok: false, error: trendsResult.error }
          : undefined,
    }
  }

  if (trends && trendsFailures === universe.length && universe.length > 0) {
    notes.push(
      'Every Google Trends request failed — usually rate limiting. Demand momentum is unavailable in this run; try again in an hour.',
    )
  } else if (trendsFailures > 0) {
    notes.push(`${trendsFailures} of ${universe.length} keywords returned no Google Trends data.`)
  }
  if (etsy && etsyFailures > 0) {
    notes.push(`${etsyFailures} of ${universe.length} keywords failed on the Etsy API.`)
  }

  const snapshot = {
    date,
    generatedAt: new Date().toISOString(),
    geo: config.geo,
    sources: {
      etsy: Boolean(etsy),
      googleTrends: Boolean(trends),
    },
    notes,
    keywords,
  }

  const path = store.save(snapshot)
  if (discoveries.length) store.mergeDiscovered(discoveries, { today: date })

  return { snapshot, path, store, discoveries, notes }
}
