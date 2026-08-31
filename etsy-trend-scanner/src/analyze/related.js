/**
 * "People also search for" — merging the related-search layers.
 *
 * Four independent views of what sits next to a keyword in people's heads:
 *
 *   trendsTop     Google's own related queries. Real, ranked demand.
 *   trendsRising  the same feed, filtered to what is growing fast.
 *   autocomplete  the exact phrasing people type, including the long tail.
 *   etsyTags      tags co-occurring on the niche's live listings — the
 *                 marketplace's own view of what these buyers search.
 *
 * The first three are buyer-side, the last is seller-side. A phrase confirmed
 * by more than one of them is far more trustworthy than one from any single
 * feed, so cross-confirmation is scored explicitly and surfaced in the report:
 * a phrase buyers type that sellers have *not* yet tagged is exactly the gap a
 * new listing can walk into.
 */

import { isUsableTerm, normaliseTerm } from '../keywords.js'

export const SOURCE_WEIGHTS = {
  trendsTop: 3,
  trendsRising: 3,
  autocomplete: 2,
  etsyTags: 1.5,
}

export const SOURCE_LABELS = {
  trendsTop: 'Google related',
  trendsRising: 'Google rising',
  autocomplete: 'autocomplete',
  etsyTags: 'Etsy tags',
}

/**
 * A related phrase has to say something the parent term did not. "cottagecore"
 * as a suggestion for "cottagecore" is noise; so is a phrase that only drops
 * words from the parent.
 */
export function addsSomething(parent, candidate) {
  const parentWords = new Set(normaliseTerm(parent).split(' ').filter(Boolean))
  const candidateWords = normaliseTerm(candidate).split(' ').filter(Boolean)
  if (candidateWords.length === 0) return false
  return candidateWords.some((word) => !parentWords.has(word))
}

function add(map, query, source, strength, extra = {}) {
  const term = normaliseTerm(query)
  if (!term) return
  const row = map.get(term) ?? { query: term, sources: {}, score: 0 }
  // Keep the strongest reading if a source offers the same phrase twice.
  row.sources[source] = Math.max(row.sources[source] ?? 0, strength)
  Object.assign(row, extra)
  map.set(term, row)
}

/**
 * Merge every related-search layer for one keyword into a single ranked list.
 *
 * @returns {Array<{query, sources: string[], score, crossConfirmed, growth, inEtsyTags}>}
 */
export function mergeRelated({
  term,
  trendsTop = [],
  trendsRising = [],
  suggestions = [],
  topTags = [],
  limit = 12,
} = {}) {
  const map = new Map()

  for (const row of trendsTop) {
    // Google reports these 0-100 against the strongest related query.
    add(map, row.query, 'trendsTop', Math.max(0.2, (row.value ?? 50) / 100))
  }

  for (const row of trendsRising) {
    add(map, row.query, 'trendsRising', row.breakout ? 1 : 0.6, {
      growth: row.formatted || (row.value ? `+${row.value}%` : null),
      breakout: Boolean(row.breakout),
    })
  }

  suggestions.forEach((row, index) => {
    const query = typeof row === 'string' ? row : row.query
    const rank = typeof row === 'string' ? index : (row.rank ?? index)
    // Rank 0 is what most people type; by rank 10 it is a rarity.
    add(map, query, 'autocomplete', Math.max(0.15, 1 - rank / 10))
  })

  const tagTotal = topTags.reduce((sum, row) => sum + (row.count ?? 0), 0)
  for (const row of topTags) {
    if (!tagTotal) break
    add(map, row.tag, 'etsyTags', Math.max(0.15, (row.count ?? 0) / tagTotal), { inEtsyTags: true })
  }

  const rows = []
  for (const row of map.values()) {
    if (!isUsableTerm(row.query)) continue
    if (!addsSomething(term, row.query)) continue

    const sources = Object.keys(row.sources)
    const base = sources.reduce(
      (sum, source) => sum + SOURCE_WEIGHTS[source] * row.sources[source],
      0,
    )
    // Agreement between independent feeds is worth more than depth in one.
    const score = base * (1 + 0.35 * (sources.length - 1))

    rows.push({
      query: row.query,
      sources,
      score: Number(score.toFixed(2)),
      crossConfirmed: sources.length > 1,
      breakout: Boolean(row.breakout),
      growth: row.growth ?? null,
      inEtsyTags: Boolean(row.inEtsyTags),
    })
  }

  return rows
    .sort((a, b) => Number(b.crossConfirmed) - Number(a.crossConfirmed) || b.score - a.score)
    .slice(0, limit)
}

/**
 * Phrases worth spending an Etsy lookup on.
 *
 * The pick is deliberately biased toward phrases buyers use that sellers have
 * not tagged: those are the ones most likely to come back with a low listing
 * count, which is the whole point of chasing the long tail.
 */
export function longTailCandidates(relatedByTerm, { limit = 20, exclude = new Set() } = {}) {
  const pool = new Map()

  for (const [parent, rows] of Object.entries(relatedByTerm)) {
    for (const row of rows) {
      if (exclude.has(row.query) || pool.has(row.query)) continue
      // A single-word phrase is never long tail, and a phrase seen by only one
      // feed is usually noise.
      if (!row.query.includes(' ')) continue
      if (!row.crossConfirmed && !row.breakout) continue

      pool.set(row.query, {
        query: row.query,
        parent,
        sources: row.sources,
        breakout: row.breakout,
        growth: row.growth,
        // Buyers say it, sellers have not tagged it: the gap we are hunting.
        untagged: !row.inEtsyTags,
        score: row.score * (row.inEtsyTags ? 1 : 1.25),
      })
    }
  }

  return [...pool.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

/** One-line summary of a related list, for report evidence. */
export function describeRelated(rows, { limit = 4 } = {}) {
  if (!rows?.length) return null
  const listed = rows.slice(0, limit).map((row) => {
    const note = row.breakout ? ' (breakout)' : row.growth ? ` ${row.growth}` : ''
    return `"${row.query}"${note}`
  })
  return `People also search for: ${listed.join(', ')}`
}
