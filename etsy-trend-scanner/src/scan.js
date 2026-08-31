/**
 * Scan orchestration: collect today's numbers and write one snapshot file.
 *
 * Three passes:
 *
 *   0. discovery — harvest what is trending from unseeded feeds, then screen it
 *      for things that can actually be sold. This is what decides the niches;
 *      nothing is supplied in advance. A seeded scan can only find trends next
 *      to a list someone wrote, so it cannot see what nobody thought to watch.
 *   1. qualification — demand, related searches, autocomplete and Etsy supply
 *      for each surviving trend (plus the optional fixed watchlist).
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
import { TrendingClient } from './sources/trending.js'
import { activeSeasonalThemes, toISODate } from './seasonal.js'
import { buildKeywordUniverse, isUsableTerm, normaliseTerm } from './keywords.js'
import { longTailCandidates, mergeRelated } from './analyze/related.js'
import { screenCandidates } from './analyze/sellable.js'
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

/**
 * Pass zero: decide what to scan by looking at what is trending, not by
 * consulting a list.
 *
 * The harvest is unseeded, so most of it is unsellable — news, sport, weather.
 * `screenCandidates` removes those, cheaply first and then with an autocomplete
 * commerce probe, and what survives becomes the day's universe.
 *
 * The fixed watchlist is off by default and merged in afterwards when enabled,
 * so turning it on adds terms rather than displacing discovered ones.
 */
export async function buildScanUniverse({
  config,
  today = new Date(),
  trendingClient,
  suggestClient,
  logger = () => {},
  useDiscovery = true,
  limit,
} = {}) {
  const settings = config.discovery ?? {}
  const watchlist = config.watchlist ?? {}
  const universe = []
  let discovery = null

  if (useDiscovery && settings.enabled !== false) {
    const trending =
      trendingClient ??
      new TrendingClient({
        geo: config.geo,
        language: config.language,
        limits: config.limits,
        logger,
      })

    logger('discovering what is trending...')
    const harvest = await trending.collect(today)
    const candidates = harvest.candidates.slice(0, settings.maxCandidates ?? 60)

    const screened = await screenCandidates(candidates, suggestClient, {
      maxProbes: settings.maxCommercialProbes ?? 25,
      minCommercialScore: settings.minCommercialScore ?? 30,
      logger,
    })

    const qualified = screened.qualified
      .filter((row) => isUsableTerm(row.term, { minSingleWordLength: 3 }))
      .slice(0, limit ?? settings.maxQualified ?? 15)

    for (const row of qualified) {
      universe.push({
        term: normaliseTerm(row.term),
        category: 'trending',
        origin: 'trending',
        trending: {
          sources: row.sources ?? [row.source],
          traffic: row.traffic ?? null,
          views: row.views ?? null,
          headlines: (row.headlines ?? []).slice(0, 3),
          commerceScore: row.commerce?.score ?? null,
          commerceHits: (row.commerce?.hits ?? []).map((hit) => hit.modifier),
          ipRisk: row.ip?.risk ?? 'low',
          ipReason: row.ip?.reason ?? null,
        },
      })
    }

    discovery = {
      harvested: harvest.candidates.length,
      screened: candidates.length,
      qualified: qualified.length,
      rejectedByShape: screened.rejected.length,
      rejectedAsUnsellable: screened.unsellable.length,
      notProbed: screened.unprobed.length,
      // Kept so the report can say *why* a day was quiet, rather than just
      // showing an empty page.
      rejectionReasons: countBy(screened.rejected.map((row) => row.shape.reason)),
      errors: harvest.errors,
      sources: harvest.errors.length === 0 ? ['google-trending', 'wikipedia'] : [],
    }
  }

  if (watchlist.enabled) {
    const seen = new Set(universe.map((row) => row.term))
    const extra = buildKeywordUniverse({
      discovered: activeSeasonalThemes(today),
      max: watchlist.maxKeywords ?? 12,
    })
    for (const row of extra) {
      if (seen.has(row.term)) continue
      universe.push({ ...row, origin: 'watchlist' })
      seen.add(row.term)
    }
  }

  // Every route to an empty universe leaves the caller something to say.
  return { universe, discovery }
}

function countBy(values) {
  const out = {}
  for (const value of values) {
    if (!value) continue
    out[value] = (out[value] ?? 0) + 1
  }
  return out
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
  trendingClient,
  useEtsy = true,
  useTrends = true,
  useSuggest = true,
  useDiscovery = true,
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

  let discovery = null
  let universe
  if (only.length) {
    universe = only.map((term) => ({ term: normaliseTerm(term), category: 'manual', origin: 'manual' }))
  } else {
    const built = await buildScanUniverse({
      config,
      today,
      trendingClient,
      suggestClient: suggest,
      logger,
      useDiscovery,
      limit,
    })
    universe = built.universe
    discovery = built.discovery
  }

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
    // Recording a trending term is how the report can later say "third day
    // running". It does not feed back into tomorrow's universe — if it is still
    // trending then, discovery will find it again on its own merits.
    if (entry.origin === 'trending') {
      discoveries.push({ term: entry.term, category: 'trending', parent: null })
    }

    keywords[entry.term] = {
      category: entry.category,
      origin: entry.origin,
      trending: entry.trending,
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
  for (const error of discovery?.errors ?? []) {
    notes.push(`Trend discovery: ${error}`)
  }
  if (discovery && discovery.qualified === 0) {
    notes.push(
      `Nothing trending today survived the sellability screen — ${discovery.harvested} terms harvested, ` +
        'all of them news, sport, weather or otherwise not a product. That is a normal result on a heavy news day.',
    )
  }

  const snapshot = {
    date,
    generatedAt: new Date().toISOString(),
    geo: config.geo,
    sources: {
      etsy: Boolean(etsy),
      googleTrends: Boolean(trends),
      autocomplete: Boolean(suggest),
      discovery: Boolean(discovery),
    },
    notes,
    discovery,
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
