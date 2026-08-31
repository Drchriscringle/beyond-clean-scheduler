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
 *                     "<term> gift", "<term> shirt", "<term> poster". If people
 *                     are shopping for a thing, those complete richly. If it is
 *                     a hurricane, they do not.
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

/** Modifiers probed against autocomplete, best discriminators first. */
export const COMMERCE_PROBES = ['gift', 'shirt', 'poster', 'decor']

const COMMERCE_RE = new RegExp(
  `\\b(${COMMERCE_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
)

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
 * Stage two: probe autocomplete for commercial intent.
 *
 * Returns 0-100. Roughly: 0 means nobody shops for this, 60+ means there is an
 * established merchandise market, and the middle is where a new trend sits
 * before sellers have caught up — which is exactly what we are hunting.
 */
export async function commercialProbe(
  suggestClient,
  term,
  { probes = COMMERCE_PROBES, logger = () => {} } = {},
) {
  const hits = []
  let probed = 0
  let failures = 0

  for (const modifier of probes) {
    try {
      const completions = await suggestClient.fetchVariant(`${term} ${modifier}`)
      probed += 1
      const matched = scoreCompletions(term, completions)
      if (matched.length) hits.push({ modifier, matched: matched.slice(0, 4) })
    } catch (err) {
      failures += 1
      logger(`sellable: probe "${term} ${modifier}" failed — ${err.message}`)
    }
  }

  if (probed === 0) return { score: null, hits: [], probed, failures }

  // Breadth (how many product categories complete at all) matters more than
  // depth in any one, because breadth is what separates a real merch market
  // from a single coincidental phrase.
  const breadth = hits.length / probed
  const depth = Math.min(1, hits.reduce((sum, hit) => sum + hit.matched.length, 0) / (probed * 3))
  const score = Math.round(100 * (0.7 * breadth + 0.3 * depth))

  return { score, hits, probed, failures }
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
  { maxProbes = 25, minCommercialScore = 30, logger = () => {} } = {},
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

  const qualified = []
  for (const [index, row] of probeable.entries()) {
    logger(`[screen ${index + 1}/${probeable.length}] ${row.term}`)
    const commerce = suggestClient
      ? await commercialProbe(suggestClient, row.term, { logger })
      : { score: null, hits: [], probed: 0, failures: 0 }

    qualified.push({
      ...row,
      commerce,
      // With no autocomplete available the shape screen is all we have, so a
      // candidate is carried forward rather than silently dropped.
      sellable: commerce.score === null ? true : commerce.score >= minCommercialScore,
    })
  }

  return {
    qualified: qualified
      .filter((row) => row.sellable)
      .sort((a, b) => (b.commerce.score ?? 0) - (a.commerce.score ?? 0)),
    unsellable: qualified.filter((row) => !row.sellable),
    rejected,
    unprobed,
  }
}
