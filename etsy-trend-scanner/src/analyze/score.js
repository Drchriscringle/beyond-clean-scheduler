/**
 * Composite scoring and classification.
 *
 * One caveat is baked into the design and worth stating plainly: Google Trends
 * values are normalised *per query* (0-100 against that term's own 12-month
 * peak), so they are not comparable between keywords. We therefore never treat
 * the raw number as volume. It is used for two things it is valid for —
 * where a term sits in its own annual range, and how that is changing.
 * Cross-keyword comparison is carried by the Etsy supply figures, which are
 * absolute counts.
 */

import {
  clamp,
  dampSaturation,
  entryRateScore,
  risingBoost,
  seriesMomentum,
  squash,
  supplyMomentum,
} from './momentum.js'
import { describeRelated, mergeRelated } from './related.js'
import { normalisedWeights } from '../config.js'
import { seasonalFit } from '../seasonal.js'

export const CLASSES = {
  EARLY: 'starting-to-trend',
  HOT: 'trending-now',
  SEASONAL: 'seasonal-window',
  STEADY: 'steady-evergreen',
  SATURATED: 'saturated',
  FADING: 'fading',
  UNKNOWN: 'insufficient-data',
}

/**
 * Competition score: fewer competing listings is better, log-scaled because the
 * difference between 500 and 5,000 listings matters far more than between
 * 50,000 and 55,000.
 *
 * Calibrated against what Etsy niches actually look like — a viable one is
 * rarely under a few thousand listings, and the useful discrimination is in
 * the 2k-200k band:
 *
 *     500 -> 90    10,000 -> 58    200,000 -> 25
 *   2,500 -> 72    50,000 -> 40  1,000,000 ->  8
 */
export function competitionScore(totalListings) {
  if (!Number.isFinite(totalListings) || totalListings < 0) return null
  const listings = Math.max(totalListings, 1)
  return Math.round(clamp(157 - 24.9 * Math.log10(listings)))
}

/** Where the term sits inside its own 12-month range, 0..100. */
export function demandPositionScore(momentum) {
  if (!momentum || !Number.isFinite(momentum.level) || !Number.isFinite(momentum.peak)) return null
  if (momentum.peak <= 0) return 0
  return Math.round(clamp((momentum.level / momentum.peak) * 100))
}

/**
 * Momentum credit for a term that is trending *today*.
 *
 * A brand-new trend has almost no 12-month interest curve to fit — the term
 * barely existed a month ago — so `seriesMomentum` reads it as thin or absent.
 * That is precisely backwards for what we are hunting, so appearing on an
 * unseeded trending feed is treated as direct evidence of momentum, and the
 * higher of the two readings wins.
 */
export function trendingMomentum(trending) {
  if (!trending) return null
  // Being on the list at all is the signal; the traffic band refines it.
  const traffic = trending.traffic
  const bump = Number.isFinite(traffic) ? clamp(Math.log10(Math.max(traffic, 1000)) * 6 - 18, 0, 25) : 0
  // Search and encyclopedia traffic are independent; agreement means more.
  const confirm = (trending.sources?.length ?? 1) > 1 ? 10 : 0
  return Math.round(clamp(70 + bump + confirm))
}

/** Median price mapped to 0..100 — higher-ticket niches carry fee overhead better. */
export function priceScore(medianPrice, { minMedianPrice = 8 } = {}) {
  if (!Number.isFinite(medianPrice)) return null
  if (medianPrice < minMedianPrice) return 0
  return Math.round(clamp(squash((medianPrice - 25) / 25, 1.4)))
}

function pick(...values) {
  for (const value of values) if (Number.isFinite(value)) return value
  return null
}

/**
 * Score one keyword.
 *
 * @param {object} input
 * @param {string} input.term
 * @param {object} input.etsy     summarised Etsy metrics for today
 * @param {object} input.trends   {series, rising, top} for today
 * @param {object} input.suggest  {suggestions} from search autocomplete
 * @param {Array}  input.related  pre-merged related searches, if the snapshot
 *                                already carries them; recomputed otherwise so
 *                                older snapshots still benefit from changes to
 *                                the merge logic
 * @param {Array}  input.history  stored snapshot rows for this term, oldest first
 */
export function scoreKeyword({
  term,
  category = 'uncategorised',
  etsy = {},
  trends = {},
  suggest = {},
  related,
  trending = null,
  history = [],
  config = {},
  today = new Date(),
  effortDays = 2,
} = {}) {
  const weights = normalisedWeights(config.weights ?? {})
  const profile = config.profile ?? {}

  const momentum = seriesMomentum(trends.series ?? [])
  const rising = risingBoost(trends.rising ?? [])
  const relatedRows =
    related ??
    mergeRelated({
      term,
      trendsTop: trends.top ?? [],
      trendsRising: trends.rising ?? [],
      suggestions: suggest.suggestions ?? [],
      topTags: etsy.topTags ?? [],
      limit: config.relatedPerKeyword ?? 12,
    })
  const supply = supplyMomentum(history)
  const season = seasonalFit({ term, today, profile, effortDays })

  const demand = demandPositionScore(momentum)
  const competitionGap = competitionScore(etsy.totalListings)
  const saturation = dampSaturation(
    pick(supply.score, entryRateScore(etsy.sellerEntryRate)),
    etsy.totalListings,
  )
  const price = priceScore(etsy.medianPrice, profile)

  // Rising queries are a demand signal in their own right, so they can carry
  // momentum on their own when the interest curve is too sparse to fit.
  const seriesScore =
    momentum.score === null
      ? rising.score || null
      : Math.round(clamp(momentum.score * 0.75 + rising.score * 0.25))
  const trendingScore = trendingMomentum(trending)
  const momentumScore =
    trendingScore === null ? seriesScore : Math.max(seriesScore ?? 0, trendingScore)

  const parts = {
    demand,
    momentum: momentumScore,
    competitionGap,
    // Saturation is a risk, so it enters the sum inverted.
    saturationRisk: saturation === null ? null : 100 - saturation,
    seasonalFit: season.score,
  }

  // Renormalise over the components we actually have, so a missing signal
  // dilutes confidence rather than silently scoring zero.
  let weighted = 0
  let weightUsed = 0
  const missing = []
  for (const [key, value] of Object.entries(parts)) {
    const weight = weights[key] ?? 0
    if (value === null || value === undefined) {
      // A term with no upcoming occasion is the normal case, not a gap in the
      // data, so it is never reported as a missing signal.
      if (weight > 0 && key !== 'seasonalFit') missing.push(key)
      continue
    }
    weighted += value * weight
    weightUsed += weight
  }

  const opportunity = weightUsed > 0 ? Math.round(weighted / weightUsed) : null

  const confidence =
    weightUsed >= 0.8 && momentum.confidence === 'high'
      ? 'high'
      : weightUsed >= 0.5
        ? 'medium'
        : 'low'

  return {
    term,
    category,
    opportunity,
    confidence,
    classification: classify({ parts, momentum, rising, season, supply, etsy }),
    trending,
    parts,
    missing,
    evidence: buildEvidence({
      momentum,
      rising,
      supply,
      season,
      etsy,
      parts,
      related: relatedRows,
      trending,
    }),
    related: relatedRows,
    detail: {
      momentum,
      rising,
      supply,
      season,
      price,
      totalListings: etsy.totalListings ?? null,
      medianPrice: etsy.medianPrice ?? null,
      priceBand: [etsy.p25Price ?? null, etsy.p75Price ?? null],
      digitalShare: etsy.digitalShare ?? null,
      personalisableShare: etsy.personalisableShare ?? null,
      topTags: etsy.topTags ?? [],
      related: relatedRows,
      trending,
      historyDays: history.length,
    },
  }
}

export function classify({ parts, momentum, rising, season, supply, etsy }) {
  const m = parts.momentum
  const demand = parts.demand
  const saturationRisk = parts.saturationRisk === null ? null : 100 - parts.saturationRisk
  const competition = parts.competitionGap

  if (m === null && demand === null && !Number.isFinite(etsy?.totalListings)) return CLASSES.UNKNOWN

  if (saturationRisk !== null && saturationRisk >= 72 && (m ?? 0) < 75) return CLASSES.SATURATED

  // Early = climbing hard, still small, sellers not yet piling in.
  const stillSmall = competition === null ? false : competition >= 55
  const climbing = (m ?? 0) >= 62 || rising.breakouts > 0
  const notCrowded = saturationRisk === null || saturationRisk < 62
  if (climbing && stillSmall && notCrowded && (demand === null || demand < 88)) return CLASSES.EARLY

  // Seasonal is checked before "trending now" on purpose: when a niche is both,
  // the deadline is the more actionable framing to hand the seller.
  if ((season?.score ?? 0) >= 55 && !season.missed) return CLASSES.SEASONAL

  if ((m ?? 0) >= 58 && (demand ?? 0) >= 70) return CLASSES.HOT

  if ((m ?? 50) <= 38 && (demand ?? 50) <= 55) return CLASSES.FADING

  if (supply?.growth !== null && momentum?.growth !== null) {
    // Supply outrunning demand is the classic late signal.
    if (supply.growth > 0.15 && momentum.growth < 0.05) return CLASSES.SATURATED
  }

  return CLASSES.STEADY
}

function formatPct(value) {
  if (!Number.isFinite(value)) return null
  const pct = Math.round(value * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

export function buildEvidence({
  momentum,
  rising,
  supply,
  season,
  etsy,
  parts,
  related = [],
  trending = null,
}) {
  const lines = []

  // Why this term is in the report at all comes first.
  if (trending) {
    const feeds = (trending.sources ?? [])
      .map((source) => (source === 'google-trending' ? 'Google trending searches' : 'Wikipedia pageview spike'))
      .join(' and ')
    const volume = Number.isFinite(trending.traffic)
      ? ` on ${trending.traffic.toLocaleString('en-US')}+ searches`
      : ''
    lines.push(`Trending today${volume}${feeds ? ` — picked up by ${feeds}` : ''}`)
    if (trending.headlines?.length) {
      lines.push(`What is driving it: "${trending.headlines[0]}"`)
    }
    if (Number.isFinite(trending.commerceScore)) {
      const forms = (trending.commerceHits ?? []).join(', ')
      lines.push(
        `Commercial intent ${trending.commerceScore}/100` +
          (forms ? ` — people are searching for ${forms} around this` : ''),
      )
    }
  }

  if (Number.isFinite(momentum?.growth)) {
    lines.push(
      `Search interest ${formatPct(momentum.growth)} over the last 4 weeks vs the prior 12` +
        (momentum.confidence === 'low' ? ' (short series, treat as indicative)' : ''),
    )
  }
  if (Number.isFinite(parts.demand)) {
    lines.push(`Sitting at ${parts.demand}% of its own 12-month search peak`)
  }
  // The merged related list already folds in the rising queries, so the raw
  // rising feed is only reported when the merge produced nothing.
  const relatedLine = describeRelated(related)
  if (relatedLine) {
    const confirmed = related.filter((row) => row.crossConfirmed).length
    lines.push(
      confirmed > 0
        ? `${relatedLine} — ${confirmed} of these confirmed by more than one search feed`
        : relatedLine,
    )
  } else if (rising?.top?.length) {
    const listed = rising.top
      .slice(0, 3)
      .map((row) => `"${row.query}" ${row.growth}`.trim())
      .join(', ')
    lines.push(
      rising.breakouts > 0
        ? `${rising.breakouts} breakout related ${rising.breakouts === 1 ? 'search' : 'searches'} on Google — ${listed}`
        : `Rising related searches: ${listed}`,
    )
  }

  if (Number.isFinite(etsy?.totalListings)) {
    lines.push(`${etsy.totalListings.toLocaleString('en-US')} active Etsy listings competing`)
  }
  if (Number.isFinite(supply?.growth)) {
    lines.push(
      `Competing listings ${formatPct(supply.growth)} in ${supply.days} days ` +
        `(${supply.from?.toLocaleString('en-US')} to ${supply.to?.toLocaleString('en-US')})`,
    )
  } else if (Number.isFinite(etsy?.sellerEntryRate)) {
    lines.push(
      `${Math.round(etsy.sellerEntryRate * 100)}% of the newest 100 listings went up in the last 7 days`,
    )
  }
  if (Number.isFinite(etsy?.medianPrice)) {
    const band =
      Number.isFinite(etsy.p25Price) && Number.isFinite(etsy.p75Price)
        ? ` (typical range $${etsy.p25Price.toFixed(2)}-$${etsy.p75Price.toFixed(2)})`
        : ''
    lines.push(`Median asking price $${etsy.medianPrice.toFixed(2)}${band}`)
  }
  if (season?.event && season.score > 0) {
    lines.push(
      season.missed
        ? `${season.event} listing window closed on ${season.listByDate} — too late to rank for it`
        : `${season.event}: list by ${season.listByDate} (${season.daysToListBy} days) to rank for the ${season.peakDate} peak`,
    )
  }

  return lines
}

export function scoreAll(rows, { config, today } = {}) {
  return rows
    .map((row) => scoreKeyword({ ...row, config, today }))
    .sort((a, b) => (b.opportunity ?? -1) - (a.opportunity ?? -1))
}
