/**
 * Scan orchestration: collect today's numbers for the keyword universe and
 * write one snapshot file.
 *
 * Two passes:
 *
 *   1. the keyword universe — demand, related searches, autocomplete and Etsy
 *      supply for every term we watch.
 *   2. the long tail — the strongest "people also search for" phrases thrown up
 *      by pass 1, given an Etsy competition lookup of their own so they arrive
 *      in the report with a listing count rather than as bare suggestions.
 *
 * Design rule throughout: no single source is allowed to fail the scan. If
 * Etsy's key is missing we still record demand; if Google Trends rate-limits we
 * still record supply and autocomplete. A partial snapshot is far more useful
 * than none, because tomorrow's momentum calculation needs today's row to exist.
 */

import { EtsyClient, collectEtsyMetrics } from './sources/etsy.js'
import { TrendsClient } from './sources/googleTrends.js'
import { SuggestClient } from './sources/suggest.js'
import { activeSeasonalThemes, toISODate } from './seasonal.js'
import { buildKeywordUniverse, isUsableTerm, normaliseTerm } from './keywords.js'
import { longTailCandidates, mergeRelated } from './analyze/related.js'
import { SnapshotStore } from './store.js'

/**
 * Related phrases worth adding to the watch list permanently.
 *
 * Breakouts and big movers qualify on growth alone. Everything else has to be
 * confirmed by more than one feed — a phrase both Google's related list and
 * autocomplete know about is a real search, not an artefact of one endpoint.
 */
export function harvestDiscoveries(term, { trends, related = [] } = {}, { minValue = 150 } = {}) {
  const out = new Map()

  for (const row of trends?.rising ?? []) {
    if (!row.breakout && (row.value ?? 0) < minValue) continue
    const candidate = normaliseTerm(row.query)
    if (!isUsableTerm(candidate)) continue
    out.set(candidate, { term: candidate, category: 'discovered', parent: term })
  }

  for (const row of related) {
    if (!row.crossConfirmed || out.has(row.query)) continue
    // A phrase only the marketplace uses is a tag, not a search.
    if (row.sources.length === 1 || (row.sources.length === 2 && row.inEtsyTags && !row.growth)) {
      if (!row.sources.some((source) => source.startsWith('trends'))) continue
    }
    out.set(row.query, { term: row.query, category: 'discovered', parent: term })
  }

  return [...out.values()]
}

async function collectKeyword({ entry, etsy, trends, suggest, today, relatedLimit }) {
  const [etsyResult, trendsResult, suggestResult] = await Promise.all([
    etsy ? collectEtsyMetrics(etsy, entry.term, { now: today }) : Promise.resolve(null),
    trends ? trends.collect(entry.term) : Promise.resolve(null),
    suggest ? suggest.collect(entry.term) : Promise.resolve(null),
  ])

  const related = mergeRelated({
    term: entry.term,
    trendsTop: trendsResult?.ok ? trendsResult.top : [],
    trendsRising: trendsResult?.ok ? trendsResult.rising : [],
    suggestions: suggestResult?.ok ? suggestResult.suggestions : [],
    topTags: etsyResult?.ok ? etsyResult.topTags : [],
    limit: relatedLimit,
  })

  return { etsyResult, trendsResult, suggestResult, related }
}

export async function runScan({
  config,
  today = new Date(),
  logger = console.error,
  etsyClient,
  trendsClient,
  suggestClient,
  useEtsy = true,
  useTrends = true,
  useSuggest = true,
  limit,
  only = [],
} = {}) {
  const date = toISODate(today)
  const store = new SnapshotStore(config.dataDir)

  const etsy =
    useEtsy && config.etsyApiKey
      ? (etsyClient ?? new EtsyClient({ apiKey: config.etsyApiKey, limits: config.limits, logger }))
      : null
  const trends = useTrends
    ? (trendsClient ??
      new TrendsClient({
        geo: config.geo,
        language: config.language,
        limits: config.limits,
        logger,
      }))
    : null
  const suggest = useSuggest
    ? (suggestClient ??
      new SuggestClient({
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
  const relatedByTerm = {}
  const notes = []
  const discoveries = []
  let etsyFailures = 0
  let trendsFailures = 0
  let suggestFailures = 0

  if (!etsy && useEtsy) {
    notes.push(
      'ETSY_API_KEY is not set, so competition and price data are missing. Scores fall back to search demand and the seasonal calendar only.',
    )
  }

  for (const [index, entry] of universe.entries()) {
    logger(`[${index + 1}/${universe.length}] ${entry.term}`)

    const { etsyResult, trendsResult, suggestResult, related } = await collectKeyword({
      entry,
      etsy,
      trends,
      suggest,
      today,
      relatedLimit: config.relatedPerKeyword,
    })

    if (etsyResult && !etsyResult.ok) etsyFailures += 1
    if (trendsResult && !trendsResult.ok) trendsFailures += 1
    if (suggestResult && !suggestResult.ok) suggestFailures += 1

    relatedByTerm[entry.term] = related
    discoveries.push(...harvestDiscoveries(entry.term, { trends: trendsResult, related }))

    keywords[entry.term] = {
      category: entry.category,
      origin: entry.origin,
      etsy: etsyResult ?? undefined,
      trends: trendsResult?.ok
        ? { series: trendsResult.series, rising: trendsResult.rising, top: trendsResult.top }
        : trendsResult
          ? { ok: false, error: trendsResult.error }
          : undefined,
      suggest: suggestResult?.ok
        ? { suggestions: suggestResult.suggestions }
        : suggestResult
          ? { ok: false, error: suggestResult.error }
          : undefined,
      related,
    }
  }

  const longTail = await probeLongTail({
    relatedByTerm,
    etsy,
    universe,
    today,
    limit: config.limits.relatedProbesPerScan,
    logger,
  })

  if (trends && trendsFailures === universe.length && universe.length > 0) {
    notes.push(
      'Every Google Trends request failed — usually rate limiting. Demand momentum is unavailable in this run; try again in an hour.',
    )
  } else if (trendsFailures > 0) {
    notes.push(`${trendsFailures} of ${universe.length} keywords returned no Google Trends data.`)
  }
  if (suggest && suggestFailures === universe.length && universe.length > 0) {
    notes.push('Search autocomplete returned nothing this run, so related searches are thinner than usual.')
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
      autocomplete: Boolean(suggest),
    },
    notes,
    keywords,
    longTail,
  }

  const path = store.save(snapshot)
  if (discoveries.length) store.mergeDiscovered(discoveries, { today: date })

  return { snapshot, path, store, discoveries, longTail, notes }
}

/**
 * Pass two: give the strongest related phrases their own Etsy competition
 * lookup. Terms already in the universe are skipped — they get the full
 * treatment in pass one and do not need paying for twice.
 */
export async function probeLongTail({
  relatedByTerm,
  etsy,
  universe = [],
  today = new Date(),
  limit = 20,
  logger = () => {},
} = {}) {
  const exclude = new Set(universe.map((entry) => entry.term))
  const candidates = longTailCandidates(relatedByTerm, { limit, exclude })
  if (!etsy || candidates.length === 0) {
    return candidates.map((row) => ({ ...row, etsy: null }))
  }

  const out = []
  for (const [index, candidate] of candidates.entries()) {
    logger(`[long tail ${index + 1}/${candidates.length}] ${candidate.query}`)
    const metrics = await collectEtsyMetrics(etsy, candidate.query, { now: today })
    out.push({ ...candidate, etsy: metrics.ok ? metrics : null })
  }
  return out
}
