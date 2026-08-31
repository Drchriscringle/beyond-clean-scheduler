/**
 * Tag mining.
 *
 * Two jobs:
 *  1. Spot tags that are *newly* common among the listings in a niche. A tag
 *     that jumped from absent to widespread in a fortnight is other sellers
 *     reacting to something, which is a usable early signal.
 *  2. Produce a ready-to-paste tag set for a recommendation. Etsy allows 13
 *     tags of at most 20 characters each, so the output is trimmed to fit
 *     rather than left as a wish list.
 */

export const MAX_TAGS = 13
export const MAX_TAG_LENGTH = 20

export function cleanTag(raw) {
  const tag = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!tag || tag.length > MAX_TAG_LENGTH) return null
  return tag
}

/** Truncate on a word boundary so a long phrase still yields a legal tag. */
export function fitTag(raw) {
  const tag = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!tag) return null
  if (tag.length <= MAX_TAG_LENGTH) return tag
  const words = tag.split(' ')
  let out = ''
  for (const word of words) {
    const next = out ? `${out} ${word}` : word
    if (next.length > MAX_TAG_LENGTH) break
    out = next
  }
  return out || null
}

function shareMap(topTags) {
  const total = (topTags ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0)
  const map = new Map()
  if (!total) return map
  for (const row of topTags ?? []) {
    const tag = cleanTag(row.tag)
    if (tag) map.set(tag, (row.count ?? 0) / total)
  }
  return map
}

/**
 * Tags whose share of a niche's listings grew most since the earliest snapshot
 * we have. Tags that did not exist before are surfaced first.
 */
export function emergingTags(currentTopTags, priorTopTags, { limit = 8 } = {}) {
  const current = shareMap(currentTopTags)
  const prior = shareMap(priorTopTags)
  if (current.size === 0) return []

  const rows = []
  for (const [tag, share] of current) {
    const before = prior.get(tag) ?? 0
    const delta = share - before
    if (delta <= 0) continue
    rows.push({ tag, share, priorShare: before, delta, isNew: before === 0 })
  }

  return rows
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.delta - a.delta)
    .slice(0, limit)
}

/**
 * Build a 13-tag set for a recommendation, in priority order:
 * the niche itself, the product form, breakout related queries, the tags
 * already working in that niche, then seasonal framing.
 */
export function suggestTags({
  term,
  form,
  topTags = [],
  risingQueries = [],
  seasonalTheme = null,
  personalisable = false,
} = {}) {
  const out = []
  const seen = new Set()

  const push = (candidate) => {
    const tag = fitTag(candidate)
    if (!tag || seen.has(tag) || out.length >= MAX_TAGS) return
    seen.add(tag)
    out.push(tag)
  }

  push(term)
  if (form) push(`${term} ${form}`.trim())
  if (form) push(form)

  for (const row of risingQueries.slice(0, 4)) push(row.query ?? row)
  if (seasonalTheme) push(seasonalTheme)
  if (personalisable) {
    push(`personalised ${term}`)
    push('custom gift')
  }

  for (const row of topTags) {
    if (out.length >= MAX_TAGS) break
    push(row.tag ?? row)
  }

  return out
}

const FORMAT_QUALIFIER = {
  'digital-download': 'Instant Download',
  'print-on-demand': 'Ships Free',
  'handmade-physical': 'Handmade',
}

/** Etsy titles: front-load the searched phrase, then qualifiers. */
export function suggestTitle({ term, form, format, seasonalTheme, personalisable }) {
  const head = [term, form].filter(Boolean).join(' ')
  const qualifiers = [
    personalisable ? 'Personalised' : null,
    seasonalTheme ? titleCase(seasonalTheme) : null,
    FORMAT_QUALIFIER[format] ?? null,
  ].filter(Boolean)
  const tail = qualifiers.slice(0, 2).join(' | ')
  return tail ? `${titleCase(head)} | ${tail}` : titleCase(head)
}

function titleCase(value) {
  return String(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
