/**
 * Turn scored keywords into decisions.
 *
 * A ranked keyword list is not an answer to "what should I list next" — the
 * answer has to name a product, a price, a deadline and the reason. That is
 * what this module produces.
 */

import { formsForProfile } from '../keywords.js'
import { suggestTags, suggestTitle } from '../analyze/tags.js'
import { CLASSES, competitionScore } from '../analyze/score.js'
import { addDays, toISODate } from '../seasonal.js'

const ACTION_BY_CLASS = {
  [CLASSES.EARLY]: {
    action: 'List this week',
    priority: 1,
    rationale: 'Climbing fast and still thin on competition — this is the window where a new listing can rank.',
  },
  [CLASSES.SEASONAL]: {
    action: 'List before the deadline',
    priority: 2,
    rationale: 'Occasion demand is coming and the listing needs time on the shelf to rank for it.',
  },
  [CLASSES.HOT]: {
    action: 'List now, differentiate hard',
    priority: 3,
    rationale: 'Demand is at its peak but so is competition — only worth it with a distinct angle.',
  },
  [CLASSES.STEADY]: {
    action: 'Optional filler',
    priority: 4,
    rationale: 'Reliable but flat. Fine for catalogue depth, not a growth bet.',
  },
  [CLASSES.SATURATED]: {
    action: 'Skip',
    priority: 8,
    rationale: 'Sellers are entering faster than buyers are arriving.',
  },
  [CLASSES.FADING]: {
    action: 'Skip',
    priority: 9,
    rationale: 'Interest is falling; anything listed now arrives after the peak.',
  },
  [CLASSES.UNKNOWN]: {
    action: 'Needs more data',
    priority: 7,
    rationale: 'Not enough signal collected yet to call it either way.',
  },
}

/**
 * Choose the product form to recommend.
 *
 * Preference order is the seller's own, but a niche that is overwhelmingly
 * digital on Etsy is a poor place to debut a handmade physical item (and vice
 * versa), so the niche's own mix gets a veto.
 */
export function chooseForm(scored, profile) {
  const forms = formsForProfile(profile)
  if (forms.length === 0) return null

  const digitalShare = scored.detail?.digitalShare
  const preferDigital = Number.isFinite(digitalShare) && digitalShare >= 0.6
  const preferPhysical = Number.isFinite(digitalShare) && digitalShare <= 0.15
  const term = String(scored.term ?? '').toLowerCase()
  const tagText = (scored.detail?.topTags ?? [])
    .slice(0, 10)
    .map((row) => row.tag)
    .join(' ')
  // The completions the discovery probe found are literally what people type
  // when shopping for this — the best available evidence of which product form
  // they actually want, and better than guessing from the niche name alone.
  const trending = scored.trending ?? scored.detail?.trending
  const probeText = (trending?.formatExamples ?? []).join(' ').toLowerCase()

  function rank(form) {
    // Start from the seller's own preference order.
    let penalty = forms.indexOf(form)
    // A keyword that names the product outranks everything else.
    if (form.affinity?.test(term)) penalty -= 30
    else if (probeText && form.affinity?.test(probeText)) penalty -= 20
    else if (form.affinity?.test(tagText)) penalty -= 12
    // What the niche's existing listings actually are.
    if (preferDigital && form.format !== 'digital-download') penalty += 10
    if (preferPhysical && form.format === 'digital-download') penalty += 10
    // A tight seasonal deadline rewards whatever is quickest to produce.
    if (Number.isFinite(scored.detail?.season?.daysToListBy) && scored.detail.season.daysToListBy < 14) {
      penalty += form.effortDays
    }
    return penalty
  }

  return [...forms].sort((a, b) => rank(a) - rank(b) || a.effortDays - b.effortDays)[0]
}

/**
 * Price suggestion: sit just under the market median for a first listing in a
 * crowded niche, and at the upper-middle when competition is thin. Falls back
 * to the form's typical band when Etsy price data is missing.
 */
export function suggestPrice(scored, form) {
  const { medianPrice, priceBand } = scored.detail ?? {}
  const [p25, p75] = priceBand ?? []
  if (Number.isFinite(medianPrice)) {
    const thin = (scored.parts?.competitionGap ?? 0) >= 60
    const low = Number.isFinite(p25) ? p25 : medianPrice * 0.8
    const high = Number.isFinite(p75) ? p75 : medianPrice * 1.25
    const target = thin ? (medianPrice + high) / 2 : (low + medianPrice) / 2
    return {
      target: round99(target),
      marketMedian: medianPrice,
      band: [low, high],
      source: 'etsy',
    }
  }
  if (form?.priceBand) {
    const [low, high] = form.priceBand
    return { target: round99((low + high) / 2), marketMedian: null, band: [low, high], source: 'form-default' }
  }
  return null
}

function round99(value) {
  if (!Number.isFinite(value)) return null
  const floored = Math.max(1, Math.floor(value))
  return Number((floored + 0.99).toFixed(2))
}

/** When this needs to be live, and therefore when work has to start. */
export function deadlineFor(scored, form, { today = new Date(), profile = {} } = {}) {
  const season = scored.detail?.season
  const buildDays = (profile.leadTimeDays ?? 7) + (form?.effortDays ?? 2)
  if (season?.listByDate && !season.missed) {
    return {
      liveBy: season.listByDate,
      startBy: toISODate(addDays(new Date(season.listByDate), -buildDays)),
      reason: `${season.event} peak on ${season.peakDate}`,
    }
  }
  if (scored.classification === CLASSES.EARLY) {
    // Early trends are a race. Two weeks is roughly how long a thin niche stays thin.
    return {
      liveBy: toISODate(addDays(today, 14)),
      startBy: toISODate(addDays(today, Math.max(1, 14 - buildDays))),
      reason: 'trend window — competition typically fills in within a fortnight',
    }
  }
  return null
}

/**
 * Trend discovery surfaces films, shows, characters, bands and people, because
 * that is a large share of what actually trends — and a large share of what
 * sells on Etsy. It is also the fastest way to a takedown notice, a suspended
 * shop, or worse.
 *
 * The tool will not decide this for you, because the line is genuinely
 * situational: a generic craft term is yours to sell, a protected title is not,
 * and there is real space in between (parody, commentary, public-domain works,
 * and pieces merely inspired by a style). What it will not do is hand you a
 * name-shaped trend without saying which side of that line it is likely on.
 */
export function ipWarningFor(scored) {
  const risk = scored.trending?.ipRisk ?? scored.detail?.trending?.ipRisk
  if (!risk || risk === 'low') return null
  const reason = scored.trending?.ipReason ?? scored.detail?.trending?.ipReason
  return {
    risk,
    reason,
    text:
      risk === 'high'
        ? 'Likely someone else\'s trademark or copyright — it reads as a name, title or brand. ' +
          'Selling merchandise of a protected work without a licence gets listings removed and shops suspended. ' +
          'Sell the style, the aesthetic or the generic subject around it, not the named thing itself.'
        : 'Contains capitalised names, so check for a trademark before listing. ' +
          'If it names a real product, work or person, sell the surrounding theme rather than the name.',
  }
}

/**
 * Is this niche actually sellable in a format this shop makes?
 *
 * Two independent readings, and either can disqualify:
 *
 *   the discovery probe   what people type when they shop for this — a term
 *                         that only completes as ceramics is not a digital
 *                         opportunity however commercial it looks.
 *   Etsy's own listings   what is actually selling there. A niche whose live
 *                         listings are overwhelmingly physical is telling you
 *                         buyers there want an object, not a file.
 *
 * The Etsy reading needs a decent sample before it means anything: a brand-new
 * trend with eleven listings says nothing about format either way, and
 * rejecting it on that basis would throw away the freshest finds.
 */
export function formatMismatch(scored, profile = {}) {
  const formats = profile.formats ?? []
  if (formats.length === 0) return null

  const wantsDigital = formats.includes('digital-download')
  const wantsPhysical = formats.some((format) => format !== 'digital-download')

  const trending = scored.trending ?? scored.detail?.trending
  if (trending && Number.isFinite(trending.formatScore) && trending.formatScore === 0) {
    return {
      reason: `people shopping for this are not looking for ${formats.join(' or ')}`,
      source: 'search',
    }
  }

  const share = scored.detail?.digitalShare
  const sample = scored.detail?.sampleSize ?? 0
  if (!Number.isFinite(share) || sample < 25) return null

  if (wantsDigital && !wantsPhysical && share < 0.15) {
    return {
      reason: `only ${Math.round(share * 100)}% of listings here are digital — this niche sells objects`,
      source: 'etsy',
    }
  }
  if (wantsPhysical && !wantsDigital && share > 0.9) {
    return {
      reason: `${Math.round(share * 100)}% of listings here are digital files`,
      source: 'etsy',
    }
  }
  return null
}

export function buildRecommendation(scored, { config = {}, today = new Date() } = {}) {
  const profile = config.profile ?? {}
  const form = chooseForm(scored, profile)
  const meta = ACTION_BY_CLASS[scored.classification] ?? ACTION_BY_CLASS[CLASSES.UNKNOWN]
  const season = scored.detail?.season
  const personalisable = (scored.detail?.personalisableShare ?? 0) >= 0.4

  // Tags come from phrases people actually search, strongest first. A phrase
  // confirmed by more than one feed beats a rising query seen only by Google,
  // and both beat a tag mined from competitors' listings.
  const related = scored.related ?? scored.detail?.related ?? []
  const searchPhrases = [
    ...related.filter((row) => row.crossConfirmed),
    ...related.filter((row) => !row.crossConfirmed),
  ].map((row) => ({ query: row.query }))

  const tags = suggestTags({
    term: scored.term,
    form: form?.form,
    topTags: scored.detail?.topTags ?? [],
    risingQueries: searchPhrases.length ? searchPhrases : (scored.detail?.rising?.top ?? []),
    seasonalTheme: season?.missed ? null : season?.eventLabel,
    personalisable,
  })

  return {
    ...scored,
    action: meta.action,
    priority: meta.priority,
    rationale: meta.rationale,
    product: form
      ? { form: form.form, format: form.format, effortDays: form.effortDays }
      : null,
    title: form
      ? suggestTitle({
          term: scored.term,
          form: form.form,
          format: form.format,
          seasonalTheme: season?.missed ? null : season?.eventLabel,
          personalisable,
        })
      : null,
    price: suggestPrice(scored, form),
    deadline: deadlineFor(scored, form, { today, profile }),
    tags,
    related,
    trending: scored.trending ?? scored.detail?.trending ?? null,
    ipWarning: ipWarningFor(scored),
    formatMismatch: formatMismatch(scored, profile),
  }
}

/**
 * The long tail: "people also search for" phrases that came back from their own
 * Etsy lookup with a low listing count.
 *
 * These are not niches to build a shop around — they are the specific phrases
 * to put in a title and tags so a new listing has something it can actually
 * rank for on day one.
 */
export function buildLongTail(rows = [], { limit = 10 } = {}) {
  return rows
    .map((row) => {
      const listings = row.etsy?.totalListings ?? null
      const roomToRank = competitionScore(listings)
      return {
        ...row,
        listings,
        roomToRank,
        medianPrice: row.etsy?.medianPrice ?? null,
        // An untagged phrase with few listings is the best case: buyers say it,
        // sellers have not claimed it.
        priority:
          (roomToRank ?? 40) + (row.untagged ? 15 : 0) + (row.breakout ? 15 : 0) + row.score,
      }
    })
    .filter((row) => row.listings === null || row.listings > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
}

export const SECTIONS = [
  {
    id: 'list-next',
    heading: 'List these next',
    blurb:
      'Rising demand, competition still catchable, and makeable in a format this shop sells. ' +
      'Ordered by how soon the window closes.',
    match: (row) => [CLASSES.EARLY, CLASSES.HOT].includes(row.classification),
  },
  {
    id: 'seasonal',
    heading: 'Seasonal deadlines',
    blurb: 'Occasion demand you can still rank for, if you start by the date shown.',
    match: (row) => row.classification === CLASSES.SEASONAL && !row.detail?.season?.missed,
  },
  {
    id: 'watch',
    heading: 'Watchlist',
    blurb: 'Steady or still forming. Nothing to do today.',
    match: (row) => [CLASSES.STEADY, CLASSES.UNKNOWN].includes(row.classification),
  },
  {
    id: 'avoid',
    heading: 'Do not bother',
    blurb: 'Crowded or past peak — listing here now buys you nothing.',
    match: (row) => [CLASSES.SATURATED, CLASSES.FADING].includes(row.classification),
  },
]

/**
 * Group scored keywords into report sections, capping each so the daily read
 * stays short enough to actually act on.
 */
export function buildReportModel(
  scoredRows,
  { config = {}, today = new Date(), longTail = [], discovery = null } = {},
) {
  const size = config.reportSize ?? 12
  const all = scoredRows.map((row) => buildRecommendation(row, { config, today }))

  // Anything that cannot be made in a format this shop sells is set aside
  // rather than ranked, and reported separately so the filtering is visible.
  const recommendations = all.filter((row) => !row.formatMismatch)
  const filtered = all.filter((row) => row.formatMismatch)

  const used = new Set()
  const sections = SECTIONS.map((section) => {
    const rows = recommendations
      .filter((row) => !used.has(row.term) && section.match(row))
      .sort(byUrgencyThenScore)
      .slice(0, section.id === 'avoid' ? 5 : size)
    for (const row of rows) used.add(row.term)
    return { ...section, rows }
  })

  return {
    date: toISODate(today),
    generatedAt: new Date().toISOString(),
    geo: config.geo ?? 'US',
    totalScanned: scoredRows.length,
    formats: config.profile?.formats ?? [],
    discovery,
    sections,
    recommendations,
    filtered,
    longTail: buildLongTail(longTail),
  }
}

function byUrgencyThenScore(a, b) {
  const aDays = a.deadline ? daysUntil(a.deadline.startBy) : Infinity
  const bDays = b.deadline ? daysUntil(b.deadline.startBy) : Infinity
  if (aDays !== bDays) return aDays - bDays
  return (b.opportunity ?? -1) - (a.opportunity ?? -1)
}

function daysUntil(isoDate) {
  if (!isoDate) return Infinity
  return Math.round((new Date(isoDate) - Date.now()) / (24 * 3600 * 1000))
}
