/**
 * The keyword universe the scanner watches.
 *
 * Two layers:
 *  - SEED_NICHES  : themes/aesthetics/occasions buyers search for. These are
 *                   what we measure demand and momentum on.
 *  - PRODUCT_FORMS: the things you can actually list. A recommendation is a
 *                   (niche x form) pair, so "cottagecore" becomes a concrete
 *                   "cottagecore recipe card printable" you can go make.
 *
 * Discovered keywords (Google Trends rising queries, Etsy tag mining) are
 * merged into the seed list at scan time and persisted in
 * data/discovered-keywords.json, so the universe grows on its own.
 */

export const CATEGORIES = [
  'home-decor',
  'apparel',
  'jewellery',
  'paper-and-party',
  'digital-art',
  'planners-and-organisation',
  'craft-supplies',
  'pet',
  'wedding',
  'kids-and-baby',
  'bath-and-beauty',
]

export const SEED_NICHES = [
  // Aesthetics — the strongest driver of Etsy demand swings.
  { term: 'cottagecore', category: 'home-decor' },
  { term: 'dark academia', category: 'home-decor' },
  { term: 'coastal grandmother', category: 'home-decor' },
  { term: 'danish pastel', category: 'home-decor' },
  { term: 'mid century modern', category: 'home-decor' },
  { term: 'maximalist decor', category: 'home-decor' },
  { term: 'japandi', category: 'home-decor' },
  { term: 'whimsigothic', category: 'home-decor' },
  { term: 'grandmillennial', category: 'home-decor' },
  { term: 'brutalist decor', category: 'home-decor' },
  { term: 'y2k aesthetic', category: 'apparel' },
  { term: 'coquette aesthetic', category: 'apparel' },
  { term: 'blokecore', category: 'apparel' },
  { term: 'balletcore', category: 'apparel' },
  { term: 'gorpcore', category: 'apparel' },
  { term: 'western boho', category: 'apparel' },

  // Evergreen sellers — low momentum, but they anchor the competition model.
  { term: 'personalised name necklace', category: 'jewellery' },
  { term: 'birth flower jewellery', category: 'jewellery' },
  { term: 'permanent jewellery', category: 'jewellery' },
  { term: 'stacking rings', category: 'jewellery' },
  { term: 'custom pet portrait', category: 'pet' },
  { term: 'pet memorial gift', category: 'pet' },
  { term: 'dog bandana', category: 'pet' },
  { term: 'wedding welcome sign', category: 'wedding' },
  { term: 'bridesmaid proposal box', category: 'wedding' },
  { term: 'wedding seating chart template', category: 'wedding' },
  { term: 'save the date template', category: 'wedding' },
  { term: 'baby milestone blanket', category: 'kids-and-baby' },
  { term: 'personalised baby gift', category: 'kids-and-baby' },
  { term: 'montessori toy', category: 'kids-and-baby' },
  { term: 'busy book', category: 'kids-and-baby' },

  // Digital — fastest to list, so momentum matters most here.
  { term: 'digital planner', category: 'planners-and-organisation' },
  { term: 'notion template', category: 'planners-and-organisation' },
  { term: 'budget planner printable', category: 'planners-and-organisation' },
  { term: 'meal planner printable', category: 'planners-and-organisation' },
  { term: 'wall art printable', category: 'digital-art' },
  { term: 'digital paper pack', category: 'digital-art' },
  { term: 'clipart bundle', category: 'digital-art' },
  { term: 'procreate brushes', category: 'digital-art' },
  { term: 'svg cut file', category: 'craft-supplies' },
  { term: 'embroidery design file', category: 'craft-supplies' },
  { term: 'crochet pattern pdf', category: 'craft-supplies' },
  { term: 'knitting pattern pdf', category: 'craft-supplies' },
  { term: 'sublimation design', category: 'craft-supplies' },
  { term: 'tumbler wrap png', category: 'craft-supplies' },

  // Paper, party and gifting — heavily seasonal, big lead-time payoff.
  { term: 'birthday party printable', category: 'paper-and-party' },
  { term: 'baby shower games', category: 'paper-and-party' },
  { term: 'greeting card set', category: 'paper-and-party' },
  { term: 'sticker sheet', category: 'paper-and-party' },
  { term: 'gift tags printable', category: 'paper-and-party' },
  { term: 'advent calendar', category: 'paper-and-party' },

  // Home and lifestyle physical goods.
  { term: 'soy candle', category: 'home-decor' },
  { term: 'ceramic mug handmade', category: 'home-decor' },
  { term: 'macrame wall hanging', category: 'home-decor' },
  { term: 'tufted rug', category: 'home-decor' },
  { term: 'linen apron', category: 'home-decor' },
  { term: 'wax melts', category: 'bath-and-beauty' },
  { term: 'sugar scrub', category: 'bath-and-beauty' },
  { term: 'beard oil', category: 'bath-and-beauty' },
  { term: 'shower steamers', category: 'bath-and-beauty' },

  // Fandom and internet culture — the fastest-moving bucket, and the one
  // where being two weeks early is worth more than being good.
  { term: 'cat lover gift', category: 'pet' },
  { term: 'book lover gift', category: 'paper-and-party' },
  { term: 'crochet plushie', category: 'craft-supplies' },
  { term: 'funny mug', category: 'home-decor' },
  { term: 'enamel pin', category: 'jewellery' },
  { term: 'tarot deck', category: 'digital-art' },
  { term: 'houseplant gift', category: 'home-decor' },
  { term: 'sourdough gift', category: 'home-decor' },
  { term: 'pickleball gift', category: 'apparel' },
  { term: 'running gift', category: 'apparel' },
  { term: 'teacher appreciation gift', category: 'paper-and-party' },
  { term: 'nurse gift', category: 'apparel' },
]

/**
 * Product forms. `format` matches the seller profile in config so we never
 * recommend a physical product to a digital-only shop.
 *
 * `effortDays` is a rough build estimate used to check a seasonal deadline is
 * still reachable. `priceBand` is the typical Etsy asking range in USD, used
 * as a fallback when live Etsy price data is unavailable.
 *
 * `affinity` is what stops the recommender proposing "printable wall art" for
 * a necklace niche: when a keyword names the product it wants, that form wins
 * regardless of the seller's default ordering.
 */
export const PRODUCT_FORMS = [
  {
    form: 'printable wall art set',
    format: 'digital-download',
    effortDays: 1,
    priceBand: [6, 18],
    affinity: /\b(wall art|print|poster|decor|aesthetic|core|academia|art)\b/,
  },
  {
    form: 'printable planner insert',
    format: 'digital-download',
    effortDays: 1,
    priceBand: [5, 15],
    affinity: /\b(planner|budget|meal|habit|tracker|organis|organiz|checklist)\w*/,
  },
  {
    form: 'digital clipart bundle',
    format: 'digital-download',
    effortDays: 2,
    priceBand: [8, 25],
    affinity: /\b(clipart|clip art|png|graphic|illustration|paper pack|sublimation)\b/,
  },
  {
    form: 'SVG cut file bundle',
    format: 'digital-download',
    effortDays: 2,
    priceBand: [4, 16],
    affinity: /\b(svg|cut file|cricut|silhouette|vinyl|tumbler|wrap)\b/,
  },
  {
    form: 'Canva editable template',
    format: 'digital-download',
    effortDays: 2,
    priceBand: [10, 30],
    affinity: /\b(template|invitation|invite|save the date|seating|menu|signage)\b/,
  },
  {
    form: 'PDF pattern',
    format: 'digital-download',
    effortDays: 3,
    priceBand: [5, 12],
    affinity: /\b(pattern|crochet|knit|amigurumi|plushie|sewing|quilt|embroidery)\b/,
  },
  {
    form: 'Notion / digital planner',
    format: 'digital-download',
    effortDays: 3,
    priceBand: [12, 40],
    affinity: /\b(notion|digital planner|goal|productivity|student)\b/,
  },
  {
    form: 'sticker sheet',
    format: 'print-on-demand',
    effortDays: 2,
    priceBand: [5, 14],
    affinity: /\b(sticker|decal|laptop|water bottle)\b/,
  },
  {
    form: 'art print',
    format: 'print-on-demand',
    effortDays: 2,
    priceBand: [14, 45],
    affinity: /\b(art|print|poster|portrait|illustration|gallery)\b/,
  },
  {
    form: 'graphic tee',
    format: 'print-on-demand',
    effortDays: 2,
    priceBand: [22, 38],
    affinity: /\b(tee|shirt|apparel|hoodie|sweatshirt|runner|running|pickleball|nurse|teacher)\b/,
  },
  {
    form: 'tote bag',
    format: 'print-on-demand',
    effortDays: 2,
    priceBand: [18, 32],
    affinity: /\b(tote|bag|book lover|library|market|grocery)\b/,
  },
  {
    form: 'ceramic mug',
    format: 'print-on-demand',
    effortDays: 2,
    priceBand: [16, 30],
    affinity: /\b(mug|coffee|tea|cup|sourdough|baker|kitchen)\b/,
  },
  {
    form: 'greeting card',
    format: 'print-on-demand',
    effortDays: 1,
    priceBand: [4, 9],
    affinity: /\b(card|greeting|birthday|anniversary|thank you|note)\b/,
  },
  {
    form: 'handmade candle',
    format: 'handmade-physical',
    effortDays: 5,
    priceBand: [18, 42],
    affinity: /\b(candle|wax|melt|scent|soy|fragrance|home)\b/,
  },
  {
    form: 'jewellery piece',
    format: 'handmade-physical',
    effortDays: 6,
    priceBand: [22, 90],
    affinity: /\b(necklace|jewel|ring|rings|earring|bracelet|pendant|charm|pin|birth flower)\b/,
  },
  {
    form: 'embroidered item',
    format: 'handmade-physical',
    effortDays: 6,
    priceBand: [20, 60],
    affinity: /\b(embroider|stitch|crochet|knit|macrame|yarn|plushie|bandana|apron|blanket)\w*/,
  },
  {
    form: 'gift box / bundle',
    format: 'handmade-physical',
    effortDays: 5,
    priceBand: [30, 85],
    affinity: /\b(box|bundle|hamper|set|proposal|bridesmaid|scrub|steamer|beard|shower)\b/,
  },
]

export function normaliseTerm(term) {
  return String(term)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Terms that are too generic or too broad to be an Etsy listing decision.
 * Rising-query feeds throw off a lot of these.
 */
const STOPWORD_TERMS = new Set([
  'etsy',
  'amazon',
  'shop',
  'store',
  'gift',
  'gifts',
  'sale',
  'near me',
  'ideas',
  'diy',
])

/**
 * `minSingleWordLength` exists because the two callers want different things.
 * In a related-search feed a short single word is noise ("mug", "art"). In the
 * trending feed it is often the whole point — a film, a band or a character
 * whose name happens to be short — so discovery passes a lower bound.
 */
export function isUsableTerm(term, { minSingleWordLength = 6 } = {}) {
  const t = normaliseTerm(term)
  if (!t) return false
  if (t.length < 3 || t.length > 60) return false
  if (STOPWORD_TERMS.has(t)) return false
  if (!t.includes(' ') && t.length < minSingleWordLength) return false
  return true
}

/**
 * Merge seed niches with terms discovered at scan time, de-duplicated and
 * capped so a runaway discovery feed cannot blow through the API budget.
 */
export function buildKeywordUniverse({ seeds = SEED_NICHES, discovered = [], max = 60 } = {}) {
  const seen = new Map()
  for (const seed of seeds) {
    const term = normaliseTerm(seed.term)
    if (!isUsableTerm(term)) continue
    seen.set(term, { term, category: seed.category ?? 'uncategorised', origin: 'seed' })
  }
  for (const entry of discovered) {
    const term = normaliseTerm(typeof entry === 'string' ? entry : entry.term)
    if (!isUsableTerm(term) || seen.has(term)) continue
    seen.set(term, {
      term,
      category: entry.category ?? 'discovered',
      origin: 'discovered',
      discoveredAt: entry.discoveredAt,
      parent: entry.parent,
    })
  }

  const all = [...seen.values()]
  if (all.length <= max) return all
  // Keep every seed, then the most recently discovered terms.
  const seedRows = all.filter((row) => row.origin === 'seed')
  const discoveredRows = all
    .filter((row) => row.origin !== 'seed')
    .sort((a, b) => String(b.discoveredAt ?? '').localeCompare(String(a.discoveredAt ?? '')))
  return [...seedRows, ...discoveredRows].slice(0, max)
}

export function formsForProfile(profile) {
  const allowed = new Set(profile?.formats ?? [])
  const ranked = PRODUCT_FORMS.filter((form) => allowed.has(form.format))
  const order = profile?.formats ?? []
  return ranked.sort(
    (a, b) => order.indexOf(a.format) - order.indexOf(b.format) || a.effortDays - b.effortDays,
  )
}
