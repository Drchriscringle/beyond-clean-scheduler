/**
 * Reading RSS and Atom.
 *
 * Feeds are the last widely supported way to watch a subject without an API
 * key, a scraper or a paid data provider, and almost every newsroom, regulator,
 * blog and search engine still publishes one. The two formats disagree about
 * nearly every tag name, so both are handled and normalised to one item shape.
 *
 * This is a deliberately narrow reader, not a general XML parser: it pulls
 * known tags out of known containers. Feed XML is untrusted input, so nothing
 * here interprets markup — everything ends up as text.
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', pound: '£', euro: '€',
}

export function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits) => safeCodePoint(Number(digits)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
}

function safeCodePoint(code) {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
}

/** Strips tags and collapses whitespace — feed summaries arrive full of HTML. */
export function stripHtml(text) {
  return decodeEntities(
    String(text)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function unwrapCdata(text) {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text)
  return match ? match[1] : text
}

/** The text content of the first `<tag>` inside a block. */
function tagText(block, ...names) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
    const match = pattern.exec(block)
    if (match) {
      const value = stripHtml(unwrapCdata(match[1]))
      if (value) return value
    }
    // Self-closing with the value in an attribute, e.g. Atom's <link href="">.
    const selfClosing = new RegExp(`<${name}(\\s[^>]*)?/>`, 'i').exec(block)
    if (selfClosing) return ''
  }
  return null
}

/** Atom links live in attributes, and a feed may carry several. */
function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((match) => match[1])
  const parsed = links.map((attributes) => ({
    href: /href\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? null,
    rel: /rel\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? 'alternate',
    type: /type\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? null,
  }))
  const alternate = parsed.find((link) => link.rel === 'alternate' && link.href)
  return (alternate ?? parsed.find((link) => link.href))?.href ?? null
}

function parseDate(value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

/**
 * Parses an RSS 2.0 or Atom document into a common item shape.
 *
 * Items with neither a title nor a link are dropped: there is nothing to show
 * and nothing to click.
 */
export function parseFeed(xml, { sourceName = null, sourceUrl = null } = {}) {
  const text = String(xml)
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text)

  const feedTitle = tagText(text.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)[0] ?? '', 'title')
  const blocks = isAtom
    ? [...text.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)]
    : [...text.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]

  const items = []
  for (const [, block] of blocks) {
    const title = tagText(block, 'title')
    const link = isAtom ? atomLink(block) : tagText(block, 'link', 'guid')
    if (!title && !link) continue

    const published = parseDate(
      rawTag(block, 'pubDate') ?? rawTag(block, 'published') ?? rawTag(block, 'updated') ?? rawTag(block, 'dc:date'),
    )

    items.push({
      title: title ?? '(untitled)',
      url: link ? decodeEntities(link).trim() : null,
      summary: tagText(block, 'description', 'summary', 'content:encoded', 'content') ?? '',
      publishedAt: published,
      author: tagText(block, 'dc:creator', 'author', 'name'),
      sourceName: sourceName ?? feedTitle ?? null,
      sourceUrl,
    })
  }

  return { title: feedTitle, items }
}

/** The raw (undecoded) contents of a tag, for values parsed further. */
function rawTag(block, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block)
  return match ? unwrapCdata(match[1]).trim() : null
}

/**
 * A Google News search feed for a phrase.
 *
 * This is what makes a watchlist work the moment you type a name in, with no
 * per-target configuration: any company or person becomes a feed. Quoted so
 * that "Acme Group" does not match every page containing "group".
 */
export function searchFeedUrl(query, { language = 'en-GB', country = 'GB' } = {}) {
  const url = new URL('https://news.google.com/rss/search')
  url.searchParams.set('q', query)
  url.searchParams.set('hl', language)
  url.searchParams.set('gl', country)
  url.searchParams.set('ceid', `${country}:${language.split('-')[0]}`)
  return url.toString()
}

/**
 * Builds the search phrase for a target: the name and any aliases, quoted and
 * OR-ed, with exclusions applied at the source so noise never arrives.
 */
export function targetQuery(target) {
  const names = [target.name, ...(target.aliases ?? [])]
    .map((name) => String(name).trim())
    .filter(Boolean)
    .map((name) => (name.includes(' ') ? `"${name}"` : name))
  const excluded = (target.exclude ?? [])
    .map((term) => String(term).trim())
    .filter(Boolean)
    .map((term) => `-${term.includes(' ') ? `"${term}"` : term}`)
  return [names.length > 1 ? `(${names.join(' OR ')})` : names[0], ...excluded].filter(Boolean).join(' ')
}
