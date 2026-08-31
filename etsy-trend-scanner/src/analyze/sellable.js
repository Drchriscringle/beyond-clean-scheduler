/**
 * Sellability screening.
 *
 * Open-ended discovery has one hard problem: on any given day most of what
 * trends is unsellable. Sports fixtures, breaking news, weather, obituaries and
 * stock moves dominate every trending feed, and none of them is a product. A
 * discovery scanner without a screen is a news reader.
 *
 * Two stages, cheap first:
 *
 *   1. shape screen   pattern-matches the term and its news headlines against
 *                     the recognisable forms of unsellable news. Free, and it
 *                     removes most of the noise before anything is fetched.
 *   2. commerce probe the real test: ask autocomplete what people type after
 *                     the term plus the modifiers of the formats you actually
 *                     sell — "<term> printable", "<term> svg" for a digital
 *                     shop. If people are shopping for it in your format, those
 *                     complete richly. If it is a hurricane, they do not; and if
 *                     it only completes as ceramics, it is commercial but not
 *                     relevant to you, which is a different rejection.
 *
 * The screen deliberately does NOT reject people, shows, films or characters.
 * Fandom drives an enormous share of Etsy demand, and cutting proper nouns
 * would throw away the most valuable half of the harvest. It flags them
 * instead — see `intellectualPropertyRisk`, because selling merchandise of
 * someone else's protected work is the fastest route to a takedown, and a tool
 * that surfaced those trends without saying so would be setting its user up.
 */

import { normaliseTerm } from '../keywords.js'

/**
 * Shapes that are never a product. Matched against the term and its headlines.
 * Each entry is deliberately narrow — over-rejecting costs real opportunities.
 */
export const UNSELLABLE_PATTERNS = [
  { id: 'fixture', pattern: /\b(vs\.?|versus)\b|\bhighlights\b|\bfull match\b/ },
  { id: 'score', pattern: /\b(score|scores|scoreboard|final score|standings|fixtures|lineup|box score)\b/ },
  { id: 'league', pattern: /\b(nfl|nba|mlb|nhl|ncaa|premier league|la liga|serie a|uefa|fifa|super bowl|playoffs?)\b/ },
  { id: 'weather', pattern: /\b(weather|forecast|hurricane|tornado|typhoon|blizzard|heat wave|storm|flooding|wildfire|earthquake|tsunami)\b/ },
  { id: 'disaster', pattern: /\b(crash|shooting|explosion|evacuat\w*|outbreak|derailment|manhunt|missing person)\b/ },
  { id: 'obituary', pattern: /\b(dies|died|dead|death|obituary|cause of death|passed away|funeral)\b/ },
  { id: 'crime', pattern: /\b(arrested|indicted|charged with|verdict|sentenced|lawsuit|trial|convicted|subpoena)\b/ },
  { id: 'politics', pattern: /\b(election|ballot|primary results|senate|congress|parliament|impeach\w*|poll results|approval rating)\b/ },
  { id: 'finance', pattern: /\b(stock|shares|earnings|ipo|nasdaq|dow jones|s&p|bitcoin price|interest rate|inflation)\b/ },
  { id: 'lottery', pattern: /\b(powerball|mega millions|lottery|jackpot|winning numbers)\b/ },
  { id: 'utility', pattern: /\b(login|log in|sign in|customer service|phone number|opening hours|near me|tracking number|outage|down detector)\b/ },
  { id: 'broadcast', pattern: /\b(live stream|watch live|streaming free|where to watch|kick ?off time|start time)\b/ },
  { id: 'recall', pattern: /\b(recall|salmonella|listeria|food poisoning|contaminat\w*)\b/ },
]

/** Words whose presence in an autocomplete completion means someone is shopping. */
export const COMMERCE_WORDS = [
  'gift', 'gifts', 'shirt', 't shirt', 'tshirt', 'tee', 'hoodie', 'sweatshirt',
  'poster', 'print', 'prints', 'art', 'artwork', 'wall art', 'decor', 'decoration',
  'mug', 'sticker', 'stickers', 'decal', 'necklace', 'earrings', 'bracelet', 'pin',
  'tote', 'bag', 'blanket', 'pillow', 'ornament', 'keychain', 'costume', 'cosplay',
  'merch', 'merchandise', 'svg', 'png', 'printable', 'template', 'pattern',
  'birthday', 'party', 'invitation', 'cake topper', 'wallpaper', 'tattoo', 'diy',
]

/**
 * Autocomplete modifiers, per sellable format, best discriminators first.
 *
 * These are what decide whether a trend is *relevant to you*. A trend can be
 * thoroughly commercial and still be no use to a digital shop: people buy
 * plenty of trending things that only exist as physical objects. Probing with
 * the modifiers of the format you actually sell is what separates the two.
 */
export const FORMAT_PROBES = {
  'digital-download': ['printable', 'svg', 'template', 'digital download', 'clipart', 'png'],
  'print-on-demand': ['shirt', 'poster', 'sticker', 'mug'],
  'handmade-physical': ['handmade', 'gift', 'decor', 'necklace'],
}

/**
 * Words in a completion that place it in a format. A completion mentioning
 * "svg" or "instant download" is someone shopping for a file; "handmade" or
 * "ceramic" is someone shopping for an object.
 */
export const FORMAT_WORDS = {
  'digital-download': [
    'printable', 'printables', 'svg', 'png', 'pdf', 'template', 'templates', 'digital',
    'download', 'downloads', 'clipart', 'clip art', 'cricut', 'silhouette', 'sublimation',
    'procreate', 'canva', 'notion', 'pattern', 'patterns', 'editable', 'instant', 'bundle',
    'font', 'vector', 'wallpaper', 'planner', 'worksheet', 'crochet', 'knitting', 'cross stitch',
  ],
  'print-on-demand': [
    'shirt', 't shirt', 'tshirt', 'tee', 'hoodie', 'sweatshirt', 'poster', 'print', 'prints',
    'sticker', 'stickers', 'mug', 'tote', 'pillow', 'canvas', 'framed',
  ],
  'handmade-physical': [
    'handmade', 'ceramic', 'clay', 'wood', 'wooden', 'knitted', 'crocheted', 'embroidered',
    'candle', 'soap', 'necklace', 'earrings', 'bracelet', 'ring', 'jewelry', 'jewellery',
    'ornament', 'keychain', 'bouquet',
  ],
}

/** General probe set, for callers that do not care which format they sell in. */
export const COMMERCE_PROBES = ['gift', 'shirt', 'poster', 'decor']

function wordsToRegExp(words) {
  return new RegExp(
    `\\b(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  )
}

const COMMERCE_RE = wordsToRegExp(COMMERCE_WORDS)

const FORMAT_RE = Object.fromEntries(
  Object.entries(FORMAT_WORDS).map(([format, words]) => [format, wordsToRegExp(words)]),
)

/**
 * Probe modifiers for the formats this shop actually sells, de-duplicated.
 *
 * Interleaved across formats rather than concatenated, so a shop selling two
 * formats tests both instead of spending its whole budget on the first.
 */
export function probesForFormats(formats = [], { max = 4 } = {}) {
  const lists = formats.map((format) => FORMAT_PROBES[format]).filter(Boolean)
  if (lists.length === 0) return COMMERCE_PROBES.slice(0, max)

  const seen = new Set()
  const out = []
  const deepest = Math.max(...lists.map((list) => list.length))
  for (let depth = 0; depth < deepest && out.length < max; depth += 1) {
    for (const list of lists) {
      if (out.length >= max) break
      const probe = list[depth]
      if (!probe || seen.has(probe)) continue
      seen.add(probe)
      out.push(probe)
    }
  }
  return out
}

/**
 * Stage one. Free, and it removes most of a day's harvest.
 *
 * Headlines carry most of the signal: the bare term "Cardinals" is ambiguous,
 * but its headline tells you whether it is a bird, a ball club or a conclave.
 */
export function screenByShape(candidate) {
  const term = normaliseTerm(candidate.term ?? candidate)
  const headlines = (candidate.headlines ?? []).join(' ').toLowerCase()
  const haystack = `${term} ${headlines}`

  for (const { id, pattern } of UNSELLABLE_PATTERNS) {
    if (pattern.test(haystack)) {
      return { passed: false, reason: id }
    }
  }
  if (!term || term.length < 3) return { passed: false, reason: 'too-short' }
  return { passed: true, reason: null }
}

/**
 * Does this look like someone else's intellectual property?
 *
 * A heuristic, and deliberately a cautious one — it flags rather than rejects.
 * "sourdough" is yours to sell; a film title, a band or a character is not, and
 * the difference decides whether a listing survives its first week.
 */
export function intellectualPropertyRisk(candidate) {
  const raw = String(candidate.term ?? candidate)
  const words = raw.split(/\s+/).filter(Boolean)
  const capitalised = words.filter((word) => /^[A-Z]/.test(word)).length

  // Wikipedia article titles are overwhelmingly named entities.
  if (candidate.source === 'wikipedia' || candidate.sources?.includes('wikipedia')) {
    return { risk: 'high', reason: 'named entity from an encyclopedia article' }
  }
  if (words.length > 0 && capitalised === words.length && words.length <= 5) {
    return { risk: 'high', reason: 'reads as a proper name, brand or title' }
  }
  if (capitalised >= 2) {
    return { risk: 'medium', reason: 'contains capitalised names' }
  }
  return { risk: 'low', reason: null }
}

/**
 * Score autocomplete completions for commercial intent.
 *
 * The completions must actually be about the term — Google will complete
 * almost anything, so a bare count of results proves nothing. What counts is
 * completions that mention the term *and* a word people only use when buying.
 */
export function scoreCompletions(term, completions = []) {
  const needle = normaliseTerm(term)
  const matched = []
  for (const raw of completions) {
    const completion = normaliseTerm(typeof raw === 'string' ? raw : raw?.query)
    if (!completion || !completion.includes(needle)) continue
    if (!COMMERCE_RE.test(completion)) continue
    matched.push(completion)
  }
  return matched
}

/**
 * Split matching completions by the format they imply.
 *
 * A completion can land in more than one format — "trending poster print" is
 * both a print-on-demand product and something you could sell as a printable —
 * and that ambiguity is real, so it is preserved rather than resolved here.
 */
export function classifyCompletions(term, completions = []) {
  const matched = scoreCompletions(term, completions)
  const byFormat = Object.fromEntries(Object.keys(FORMAT_WORDS).map((format) => [format, []]))
  for (const completion of matched) {
    for (const [format, pattern] of Object.entries(FORMAT_RE)) {
      if (pattern.test(completion)) byFormat[format].push(completion)
    }
  }
  return { matched, byFormat }
}

/**
 * Stage two: probe autocomplete for commercial intent.
 *
 * Returns 0-100. Roughly: 0 means nobody shops for this, 60+ means there is an
 * established merchandise market, and the middle is where a new trend sits
 * before sellers have caught up — which is exactly what we are hunting.
 */
export async function commercialProbe(
  suggestClient,
  term,
  { formats = [], probes, maxProbes = 4, logger = () => {} } = {},
) {
  const modifiers = probes ?? probesForFormats(formats, { max: maxProbes })
  const hits = []
  const byFormat = Object.fromEntries(Object.keys(FORMAT_WORDS).map((format) => [format, 0]))
  const examples = Object.fromEntries(Object.keys(FORMAT_WORDS).map((format) => [format, []]))
  let probed = 0
  let failures = 0

  for (const modifier of modifiers) {
    try {
      const completions = await suggestClient.fetchVariant(`${term} ${modifier}`)
      probed += 1
      const classified = classifyCompletions(term, completions)
      if (classified.matched.length) {
        hits.push({ modifier, matched: classified.matched.slice(0, 4) })
      }
      for (const [format, rows] of Object.entries(classified.byFormat)) {
        if (!rows.length) continue
        byFormat[format] += 1
        for (const row of rows.slice(0, 3)) {
          if (examples[format].length < 4) examples[format].push(row)
        }
      }
    } catch (err) {
      failures += 1
      logger(`sellable: probe "${term} ${modifier}" failed — ${err.message}`)
    }
  }

  if (probed === 0) {
    return { score: null, formatScores: {}, hits: [], examples, probed, failures, modifiers }
  }

  // Breadth (how many product categories complete at all) matters more than
  // depth in any one, because breadth is what separates a real merch market
  // from a single coincidental phrase.
  const breadth = hits.length / probed
  const depth = Math.min(1, hits.reduce((sum, hit) => sum + hit.matched.length, 0) / (probed * 3))
  const score = Math.round(100 * (0.7 * breadth + 0.3 * depth))

  const formatScores = Object.fromEntries(
    Object.entries(byFormat).map(([format, count]) => [format, Math.round((count / probed) * 100)]),
  )

  return { score, formatScores, hits, examples, probed, failures, modifiers }
}

/**
 * How relevant a screened trend is to the formats this shop sells.
 *
 * Returns the best-scoring sellable format and its score, so a digital-only
 * shop can drop a trend that only completes as ceramics or jewellery however
 * commercial it otherwise looks.
 */
export function formatRelevance(commerce, formats = []) {
  const scores = commerce?.formatScores ?? {}
  if (!formats.length || Object.keys(scores).length === 0) {
    return { format: null, score: commerce?.score ?? null, relevant: true }
  }
  let best = null
  for (const format of formats) {
    const score = scores[format]
    if (!Number.isFinite(score)) continue
    if (!best || score > best.score) best = { format, score }
  }
  if (!best) return { format: null, score: null, relevant: true }
  return { ...best, relevant: true }
}

/**
 * Full screen over a day's harvest.
 *
 * Shape screen first on everything (free), then the autocomplete probe on the
 * survivors up to `maxProbes`, highest-traffic first — so the request budget is
 * spent on the trends most likely to be worth something.
 */
export async function screenCandidates(
  candidates,
  suggestClient,
  {
    maxProbes = 25,
    minCommercialScore = 30,
    formats = [],
    minFormatScore = 30,
    logger = () => {},
  } = {},
) {
  const shaped = candidates.map((candidate) => ({
    ...candidate,
    shape: screenByShape(candidate),
    ip: intellectualPropertyRisk(candidate),
  }))

  const rejected = shaped.filter((row) => !row.shape.passed)
  const survivors = shaped
    .filter((row) => row.shape.passed)
    .sort((a, b) => (b.traffic ?? b.views ?? 0) - (a.traffic ?? a.views ?? 0))

  const probeable = survivors.slice(0, maxProbes)
  const unprobed = survivors.slice(maxProbes)

  const probed = []
  for (const [index, row] of probeable.entries()) {
    logger(`[screen ${index + 1}/${probeable.length}] ${row.term}`)
    const commerce = suggestClient
      ? await commercialProbe(suggestClient, row.term, { formats, logger })
      : { score: null, formatScores: {}, hits: [], probed: 0, failures: 0 }

    const relevance = formatRelevance(commerce, formats)
    // With no autocomplete available the shape screen is all we have, so a
    // candidate is carried forward rather than silently dropped.
    const sellable = commerce.score === null ? true : commerce.score >= minCommercialScore
    // Relevance is a separate question from sellability: plenty of trends are
    // thoroughly commercial and still no use to a shop that only sells files.
    const relevant =
      commerce.score === null || !formats.length
        ? true
        : Number.isFinite(relevance.score) && relevance.score >= minFormatScore

    probed.push({ ...row, commerce, relevance, sellable, relevant })
  }

  return {
    qualified: probed
      .filter((row) => row.sellable && row.relevant)
      .sort((a, b) => (b.relevance.score ?? b.commerce.score ?? 0) - (a.relevance.score ?? a.commerce.score ?? 0)),
    unsellable: probed.filter((row) => !row.sellable),
    // Sellable, but not in a format this shop can make.
    wrongFormat: probed.filter((row) => row.sellable && !row.relevant),
    rejected,
    unprobed,
  }
}
