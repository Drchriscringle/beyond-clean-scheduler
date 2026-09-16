/**
 * Deciding whether a story is about something you are watching.
 *
 * The failure mode a news reel dies of is noise: watch a company called "Apex"
 * and half the reel becomes apex predators. So matching is on whole words and
 * whole phrases, a target can carry exclusions, and a target can insist a story
 * also mentions something else before it counts.
 */

/** Folds accents and punctuation away so "Nestlé" matches "Nestle". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Whole-word (or whole-phrase) containment, so "apex" never matches "apexes". */
export function mentions(haystack, needle) {
  const text = fold(haystack)
  const term = fold(needle)
  if (!text || !term) return false
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text)
}

/**
 * Scores one story against one target.
 *
 * A mention in the headline is worth far more than one buried in the summary:
 * a story *about* your competitor beats a story that lists them among twenty
 * others. Returns null when the story does not match at all.
 */
export function scoreItem(item, target, { now = Date.now() } = {}) {
  const names = [target.name, ...(target.aliases ?? [])].filter(Boolean)
  const title = item.title ?? ''
  const summary = item.summary ?? ''

  for (const term of target.exclude ?? []) {
    if (mentions(title, term) || mentions(summary, term)) return null
  }

  const inTitle = names.filter((name) => mentions(title, name))
  const inSummary = names.filter((name) => mentions(summary, name))
  if (inTitle.length === 0 && inSummary.length === 0) return null

  // A target may demand a second subject before a story counts — "Acme" only
  // when the story also mentions "acquisition", say.
  const required = target.mustInclude ?? []
  if (required.length > 0) {
    const satisfied = required.some((term) => mentions(title, term) || mentions(summary, term))
    if (!satisfied) return null
  }

  let score = inTitle.length > 0 ? 1 : 0.45
  if (inTitle.length > 0 && inSummary.length > 0) score += 0.1
  score += Math.min(0.2, (target.weight ?? 0) / 10)

  return {
    score: Math.min(1.5, score) * recencyFactor(item.publishedAt, now),
    matched: [...new Set([...inTitle, ...inSummary])],
    where: inTitle.length > 0 ? 'headline' : 'summary',
  }
}

/**
 * Older stories sink. Nothing is dropped for age here — that is the reel's
 * window to decide — but a week-old story should not outrank this morning's.
 */
export function recencyFactor(publishedAt, now = Date.now()) {
  if (!publishedAt) return 0.6
  const ageHours = (now - Date.parse(publishedAt)) / 3_600_000
  if (!Number.isFinite(ageHours)) return 0.6
  if (ageHours < 0) return 1 // a feed with an optimistic clock
  if (ageHours <= 6) return 1
  if (ageHours <= 24) return 0.9
  if (ageHours <= 72) return 0.75
  if (ageHours <= 168) return 0.55
  return 0.35
}

/**
 * Strips the tracking and syndication cruft off a URL so the same story from
 * two places compares equal.
 */
export function canonicalUrl(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref|cmp|ito|fbclid|gclid|at_|s_)/i.test(key)) parsed.searchParams.delete(key)
    }
    parsed.hash = ''
    parsed.hostname = parsed.hostname.replace(/^(www|amp)\./, '')
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return parsed.toString()
  } catch {
    return url
  }
}

/** Headlines rewritten by an aggregator still need to collapse together. */
export function titleKey(title) {
  // The publisher suffix is stripped before folding, because folding turns the
  // separating dash into a space and there would be nothing left to find.
  const withoutPublisher = String(title ?? '').replace(/\s[-–|]\s[^-–|]{2,40}$/, '')
  return fold(withoutPublisher)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 12)
    .join(' ')
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'from', 'this', 'has', 'have', 'was', 'were',
  'its', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'his', 'they', 'their',
  'says', 'said', 'after', 'over', 'into', 'new',
])

/**
 * Collapses the same story arriving from several feeds.
 *
 * Keeps the earliest-published copy, but carries every source across so the
 * reel can say "reported by three outlets" — which is itself a signal.
 */
export function dedupe(items) {
  const byKey = new Map()
  for (const item of items) {
    const key = canonicalUrl(item.url) ?? titleKey(item.title)
    const titleAlias = titleKey(item.title)
    const existingKey = byKey.has(key) ? key : [...byKey.keys()].find((candidate) => candidate === titleAlias)
    const slot = existingKey ?? key

    const existing = byKey.get(slot)
    if (!existing) {
      byKey.set(slot, { ...item, sources: uniqueSources([], item) })
      if (titleAlias && titleAlias !== slot) byKey.set(titleAlias, byKey.get(slot))
      continue
    }

    existing.sources = uniqueSources(existing.sources, item)
    existing.score = Math.max(existing.score ?? 0, item.score ?? 0)
    existing.targets = mergeTargets(existing.targets, item.targets)
    if (item.publishedAt && (!existing.publishedAt || item.publishedAt < existing.publishedAt)) {
      existing.publishedAt = item.publishedAt
    }
  }
  return [...new Set(byKey.values())]
}

function uniqueSources(sources, item) {
  const name = item.sourceName ?? 'Unknown'
  return sources.includes(name) ? sources : [...sources, name]
}

/**
 * Merges two lists of matched targets.
 *
 * Targets arrive as objects, and two copies of the same story carry equal but
 * distinct ones — so they are keyed by id rather than by identity, which a Set
 * would use, and which would list every target twice.
 */
function mergeTargets(existing = [], incoming = []) {
  const merged = new Map()
  for (const target of [...existing, ...incoming]) {
    const key = target?.id ?? target
    if (!merged.has(key)) merged.set(key, target)
  }
  return [...merged.values()]
}
