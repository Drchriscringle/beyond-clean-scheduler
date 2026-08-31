/**
 * Near-duplicate clustering for the trend harvest.
 *
 * Trending feeds routinely surface one trend under several names — "Wicked",
 * "Wicked movie", "wicked film soundtrack" — and the two feeds disagree about
 * naming by construction: Wikipedia gives you article titles, Google gives you
 * search phrases. Exact-match de-duplication catches none of that.
 *
 * Left alone, every variant costs four autocomplete probes, an Etsy lookup and
 * a row in the report, so the same trend appears three times while the probe
 * budget that should have reached further down the list is spent restating it.
 *
 * Clustering is greedy against cluster leaders rather than transitive, which
 * matters: "gift" is close to "christmas gift" and to "teacher gift", but
 * those two are not close to each other, and a transitive merge would collapse
 * unrelated niches into one.
 */

import { normaliseTerm } from '../keywords.js'

/**
 * Words that describe the *format* of a thing rather than the thing itself.
 * Stripping them is what lets "Wicked" and "Wicked movie" meet.
 */
const DESCRIPTOR_WORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'in', 'on', 'for', 'to',
  'movie', 'film', 'show', 'series', 'season', 'episode', 'trailer',
  'cast', 'review', 'reviews', 'news', 'update', 'updates', 'official',
])

/**
 * Single words too generic to justify a merge on their own. "gift" appears in
 * half the harvest and says nothing about whether two terms are the same trend.
 */
const WEAK_TOKENS = new Set([
  'gift', 'gifts', 'decor', 'art', 'print', 'prints', 'design', 'designs',
  'idea', 'ideas', 'day', 'party', 'set', 'card', 'cards', 'style',
])

export function tokenise(term) {
  return new Set(
    normaliseTerm(term)
      .split(' ')
      .filter((word) => word && !DESCRIPTOR_WORDS.has(word) && !/^\d{4}$/.test(word)),
  )
}

function intersection(a, b) {
  const out = new Set()
  for (const value of a) if (b.has(value)) out.add(value)
  return out
}

/**
 * How alike two terms are, by token set.
 *
 * `containment` is the more useful of the two here: a trend and its
 * elaboration ("wicked" inside "wicked soundtrack") share every token of the
 * shorter term, but their Jaccard similarity is only 0.5.
 */
export function similarity(termA, termB) {
  const a = tokenise(termA)
  const b = tokenise(termB)
  if (a.size === 0 || b.size === 0) return { jaccard: 0, contained: false, shared: new Set() }

  const shared = intersection(a, b)
  const union = new Set([...a, ...b])
  const smaller = a.size <= b.size ? a : b

  return {
    jaccard: shared.size / union.size,
    contained: shared.size === smaller.size,
    shared,
    smallerSize: smaller.size,
  }
}

/**
 * Are these the same trend?
 *
 * Containment alone is not enough when the shared part is one weak word:
 * "gift" is contained in "christmas gift", but merging on that basis would
 * eventually pull every gifting niche into one cluster.
 */
export function sameTrend(termA, termB, { jaccardThreshold = 0.6 } = {}) {
  const { jaccard, contained, shared, smallerSize } = similarity(termA, termB)
  if (shared.size === 0) return false

  if (contained) {
    if (smallerSize >= 2) return true
    // A single shared token has to carry real meaning on its own.
    const [only] = shared
    return !WEAK_TOKENS.has(only)
  }
  return jaccard >= jaccardThreshold
}

/**
 * Which variant should give the cluster its name.
 *
 * Search traffic and encyclopedia pageviews are different units and must not be
 * compared as one number — a Wikipedia article routinely outnumbers the search
 * phrase for the same subject without being the more useful name.
 *
 * A searched phrase wins outright, because that is the wording buyers type and
 * therefore what belongs in a listing title and tags; Wikipedia gives you the
 * cultural subject, Google gives you the words for it. Only when nothing was
 * searched does the article title lead, and then by views.
 */
function leadRank(row) {
  const searched = Number.isFinite(row.traffic) && row.traffic > 0
  return { searched: searched ? 1 : 0, magnitude: searched ? row.traffic : (row.views ?? 0) }
}

/**
 * Collapse a harvest into one candidate per trend.
 *
 * Weaker variants are kept as aliases so the report can show what else the
 * trend is being called, and so their evidence is not simply discarded.
 */
export function clusterCandidates(candidates = [], { jaccardThreshold = 0.6 } = {}) {
  const ordered = [...candidates].sort((a, b) => {
    const left = leadRank(a)
    const right = leadRank(b)
    return right.searched - left.searched || right.magnitude - left.magnitude
  })

  const clusters = []
  for (const candidate of ordered) {
    const leader = clusters.find((cluster) =>
      sameTrend(cluster.term, candidate.term, { jaccardThreshold }),
    )

    if (!leader) {
      clusters.push({
        ...candidate,
        sources: [...(candidate.sources ?? [candidate.source])],
        headlines: [...(candidate.headlines ?? [])],
        aliases: [],
      })
      continue
    }

    // Merge into the leader without inflating its numbers: two feeds naming the
    // same trend is confirmation, not twice the traffic.
    leader.aliases.push(candidate.term)
    leader.traffic = Math.max(leader.traffic ?? 0, candidate.traffic ?? 0) || null
    leader.views = Math.max(leader.views ?? 0, candidate.views ?? 0) || null
    for (const source of candidate.sources ?? [candidate.source]) {
      if (source && !leader.sources.includes(source)) leader.sources.push(source)
    }
    for (const headline of candidate.headlines ?? []) {
      if (!leader.headlines.includes(headline)) leader.headlines.push(headline)
    }
  }

  return clusters
}
