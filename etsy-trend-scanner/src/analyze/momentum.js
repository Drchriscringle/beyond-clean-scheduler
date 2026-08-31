/**
 * Momentum maths.
 *
 * The distinction this whole tool turns on:
 *
 *   TRENDING       high level, still climbing. You can sell into it today, but
 *                  so can everyone else.
 *   STARTING TO    low or middling level, steep positive slope, few sellers.
 *   TREND          This is where a new listing can still reach page one.
 *
 * Level and slope are therefore scored separately and never averaged into one
 * number before the classifier sees both.
 */

export function mean(values) {
  const nums = values.filter(Number.isFinite)
  if (nums.length === 0) return null
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

/** Logistic squash to 0..100, centred on 0. `k` controls sensitivity. */
export function squash(x, k = 3) {
  if (!Number.isFinite(x)) return 50
  return 100 / (1 + Math.exp(-k * x))
}

/** Least-squares slope of `values` against their index. */
export function linearSlope(values) {
  const nums = values.filter(Number.isFinite)
  const n = nums.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = nums.reduce((sum, v) => sum + v, 0) / n
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (nums[i] - yMean)
    denominator += (i - xMean) ** 2
  }
  return denominator === 0 ? 0 : numerator / denominator
}

export function pctChange(recent, baseline) {
  if (!Number.isFinite(recent) || !Number.isFinite(baseline)) return null
  if (baseline === 0) return recent === 0 ? 0 : 1
  return (recent - baseline) / Math.abs(baseline)
}

/**
 * Momentum of a Google Trends interest series (weekly points, oldest first).
 *
 * `recentWeeks` is compared against the `baselineWeeks` immediately before it,
 * rather than against the whole year, so a term that spiked last autumn does
 * not look flat today.
 */
export function seriesMomentum(series, { recentWeeks = 4, baselineWeeks = 12 } = {}) {
  const values = (series ?? []).map((row) => (typeof row === 'number' ? row : row?.value))
  const clean = values.filter(Number.isFinite)
  if (clean.length < 4) {
    return { level: null, growth: null, slope: null, score: null, confidence: 'none', points: clean.length }
  }

  const recent = clean.slice(-recentWeeks)
  const baseline = clean.slice(-(recentWeeks + baselineWeeks), -recentWeeks)
  const recentMean = mean(recent)
  const baselineMean = baseline.length ? mean(baseline) : mean(clean)
  const growth = pctChange(recentMean, baselineMean)

  const window = clean.slice(-Math.min(clean.length, recentWeeks + baselineWeeks))
  const slope = linearSlope(window)
  const windowMean = mean(window) || 1
  // Slope expressed as fractional change across the window, so it is
  // comparable between a term sitting at 5 and one sitting at 90.
  const slopeFraction = (slope * window.length) / Math.max(windowMean, 1)

  const score = clamp(0.65 * squash(growth ?? 0, 3) + 0.35 * squash(slopeFraction, 2.5))

  return {
    level: Math.round(recentMean),
    peak: Math.max(...clean),
    growth,
    slope,
    slopeFraction,
    score: Math.round(score),
    confidence: clean.length >= 30 ? 'high' : clean.length >= 12 ? 'medium' : 'low',
    points: clean.length,
  }
}

/**
 * Extra momentum credit from Google's rising-query list for the term. A
 * breakout query (>5000% growth) attached to your niche is the earliest usable
 * signal there is.
 */
export function risingBoost(rising = []) {
  if (!rising.length) return { score: 0, breakouts: 0, top: [] }
  const breakouts = rising.filter((row) => row.breakout).length
  const best = Math.max(...rising.map((row) => (row.breakout ? 5000 : row.value || 0)))
  const score = clamp(Math.min(100, breakouts * 22 + Math.min(60, Math.log10(Math.max(best, 1)) * 20)))
  return {
    score: Math.round(score),
    breakouts,
    top: rising.slice(0, 5).map((row) => ({ query: row.query, growth: row.formatted })),
  }
}

/**
 * Supply-side momentum from our own stored snapshots: how fast the number of
 * competing Etsy listings is growing.
 *
 * High demand growth with flat supply growth is the opportunity. High supply
 * growth means the other sellers already found it.
 */
export function supplyMomentum(historyRows, { windowDays = 28 } = {}) {
  const points = (historyRows ?? [])
    .map((row) => ({ date: row.date, total: row?.etsy?.totalListings }))
    .filter((row) => Number.isFinite(row.total))
  if (points.length < 2) {
    return { growth: null, perDay: null, score: null, days: points.length ? 0 : null }
  }

  const last = points[points.length - 1]
  const cutoff = new Date(last.date).getTime() - windowDays * 24 * 3600 * 1000
  const earlier = points.find((row) => new Date(row.date).getTime() >= cutoff) ?? points[0]
  const days = Math.max(
    1,
    Math.round((new Date(last.date) - new Date(earlier.date)) / (24 * 3600 * 1000)),
  )
  const growth = pctChange(last.total, earlier.total)

  return {
    growth,
    perDay: growth === null ? null : growth / days,
    days,
    from: earlier.total,
    to: last.total,
    // Higher score = more crowding pressure = worse. Centred on ~6% listing
    // growth per 28 days, which is roughly Etsy-wide background churn, so a
    // niche only reads as crowding when it outpaces the marketplace.
    score: growth === null ? null : Math.round(clamp(squash((growth - 0.06) * 12, 1))),
  }
}

/**
 * Fallback saturation estimate when there is no snapshot history yet: the
 * share of the newest 100 listings created in the past week. Roughly 2% is
 * normal churn; 15%+ means a gold rush is already under way.
 */
export function entryRateScore(sellerEntryRate) {
  if (!Number.isFinite(sellerEntryRate)) return null
  return Math.round(clamp(squash((sellerEntryRate - 0.05) * 12, 2)))
}
