// Pure business formulas. No React, no Supabase — unit tested in tests/calc.test.js.

/** Etsy Revenue = sales * price (calculated, never trusted from storage). */
export function productRevenue(product) {
  const sales = Number(product?.etsy_sales_30d) || 0
  const price = Number(product?.price) || 0
  return round2(sales * price)
}

/** Conversion rate % = sales / views * 100 (null when there are no views). */
export function productConversion(product) {
  const views = Number(product?.etsy_views_30d) || 0
  const sales = Number(product?.etsy_sales_30d) || 0
  if (views <= 0) return null
  return round2((sales / views) * 100)
}

/** Pinterest CTR % = clicks / impressions * 100 (null when impressions = 0). */
export function pinCtr(pin) {
  const impressions = Number(pin?.impressions_7d) || 0
  const clicks = Number(pin?.clicks_7d) || 0
  if (impressions <= 0) return null
  return round2((clicks / impressions) * 100)
}

/** A live pin with a measurable CTR below the threshold needs a redesign. */
export function pinNeedsRedesign(pin, threshold = 15) {
  const ctr = pinCtr(pin)
  return ctr !== null && ctr < threshold
}

/** Instagram engagement = likes + saves + comments. */
export function postEngagement(post) {
  return (Number(post?.likes) || 0) + (Number(post?.saves) || 0) + (Number(post?.comments) || 0)
}

/** Content pipeline fully ready = all six steps done (mirrors the generated column). */
export function pipelineFullyReady(row) {
  return Boolean(
    row?.idea_complete &&
      row?.template_built &&
      row?.images_done &&
      row?.etsy_copy_written &&
      row?.pinterest_copy_written &&
      row?.instagram_post_written,
  )
}

export function sum(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0)
}

/** Daily average = total / number of days (0 when there are no days). */
export function dailyAverage(total, days) {
  if (!days || days <= 0) return 0
  return total / days
}

/**
 * Trend % = (current - previous) / previous * 100.
 * Returns null when there is no previous value to compare against
 * (a jump from 0 is "new", not infinity).
 */
export function trendPercent(current, previous) {
  const prev = Number(previous) || 0
  const cur = Number(current) || 0
  if (prev === 0) return cur === 0 ? 0 : null
  return round2(((cur - prev) / prev) * 100)
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * Colour urgency for a due/scheduled date relative to today.
 * overdue (dark red) < today (red) < this week (yellow) < later (green).
 * `weekEnd` is the ISO date of the Sunday closing the current Mon–Sun week.
 */
export function urgencyFor(dateISO, todayISO, weekEndISO) {
  if (!dateISO) return 'none'
  if (dateISO < todayISO) return 'overdue'
  if (dateISO === todayISO) return 'today'
  if (dateISO <= weekEndISO) return 'week'
  return 'later'
}

/** Which pipeline step blocks the most unfinished products. */
export function pipelineBottleneck(rows, steps) {
  let best = null
  for (const step of steps) {
    const count = rows.filter((r) => !r?.[step.key]).length
    if (count > 0 && (!best || count > best.count)) best = { key: step.key, label: step.label, count }
  }
  return best
}

/** Human-readable "what's needed next" list for a pipeline row. */
export function pipelineNextSteps(row, steps) {
  return steps.filter((s) => !row?.[s.key]).map((s) => s.label)
}
