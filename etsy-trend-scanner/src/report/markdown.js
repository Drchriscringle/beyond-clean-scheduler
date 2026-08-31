/**
 * Markdown rendering of the daily report — the format meant to be read in a
 * terminal, a git diff, or pasted into a phone.
 */

const CLASS_LABEL = {
  'starting-to-trend': 'Starting to trend',
  'trending-now': 'Trending now',
  'seasonal-window': 'Seasonal window',
  'steady-evergreen': 'Steady',
  saturated: 'Saturated',
  fading: 'Fading',
  'insufficient-data': 'Not enough data',
}

const CURRENCY_SYMBOLS = { USD: '$', GBP: '\u00a3', EUR: '\u20ac', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' }

/** "a", "a and b", "a, b and c" — the join a reader expects. */
export function listPhrase(items = []) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function money(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '\u2014'
  const symbol = CURRENCY_SYMBOLS[currency]
  return symbol ? `${symbol}${value.toFixed(2)}` : `${value.toFixed(2)} ${currency}`
}

/** A related phrase with whatever the feeds said about it. */
function relatedLabel(entry) {
  if (entry.breakout) return `${entry.query} _(breakout)_`
  if (entry.growth) return `${entry.query} _(${entry.growth})_`
  return entry.query
}

function renderRow(row, index) {
  const lines = []
  const score = row.opportunity === null ? '—' : `${row.opportunity}/100`
  lines.push(`### ${index}. ${row.term}`)
  lines.push('')
  lines.push(
    `**${row.action}** · ${CLASS_LABEL[row.classification] ?? row.classification} · ` +
      `opportunity ${score} · confidence ${row.confidence}` +
      (row.backlogLabel ? ` · ${row.backlogLabel}` : ''),
  )
  lines.push('')
  lines.push(row.rationale)
  lines.push('')

  if (row.trending) {
    const feeds = (row.trending.sources ?? [])
      .map((source) => (source === 'wikipedia' ? 'Wikipedia spike' : 'Google trending'))
      .join(' + ')
    const volume = Number.isFinite(row.trending.traffic)
      ? `${row.trending.traffic.toLocaleString('en-US')}+ searches today`
      : 'trending today'
    const age = row.persistenceVerdict
      ? ` _(${row.persistenceVerdict.label}${
          row.persistence?.appearances > 1 ? `, ${row.persistence.appearances} scans` : ', day one'
        })_`
      : ''
    const aliases = row.trending.aliases?.length
      ? ` Also trending as: ${row.trending.aliases.slice(0, 3).join(', ')}.`
      : ''
    lines.push(`> **Why this is here:** ${volume}${feeds ? ` (${feeds})` : ''}${age}.` +
      (row.trending.headlines?.[0] ? ` "${row.trending.headlines[0]}"` : '') + aliases)
    lines.push('')
  }

  if (row.ipWarning) {
    lines.push(`> [!WARNING]`)
    lines.push(`> **Trademark risk (${row.ipWarning.risk}).** ${row.ipWarning.text}`)
    lines.push('')
  }

  if (row.product) {
    const price = row.price
    lines.push(
      `- **Make:** ${row.term} ${row.product.form} _(${row.product.format}, ~${row.product.effortDays}d)_`,
    )
    if (price) {
      const ccy = price.currency ?? 'USD'
      const band = price.band ? ` — market ${money(price.band[0], ccy)}–${money(price.band[1], ccy)}` : ''
      lines.push(`- **Price:** ${money(price.target, ccy)}${band}`)
    }
  }
  if (row.deadline) {
    lines.push(
      `- **Start by ${row.deadline.startBy}, live by ${row.deadline.liveBy}** — ${row.deadline.reason}`,
    )
  }
  if (row.title) lines.push(`- **Title draft:** ${row.title}`)
  if (row.tags?.length) lines.push(`- **Tags:** \`${row.tags.join('`, `')}\``)

  const related = row.related ?? []
  if (related.length) {
    lines.push(`- **People also search for:** ${related.slice(0, 6).map(relatedLabel).join(', ')}`)
    const gap = related.filter((entry) => entry.crossConfirmed && !entry.inEtsyTags).slice(0, 4)
    if (gap.length) {
      lines.push(
        `- **Not yet tagged by sellers here:** ${gap.map((entry) => entry.query).join(', ')} ` +
          '— put these in the title and tags',
      )
    }
  }

  if (row.evidence?.length) {
    lines.push('')
    lines.push('<details><summary>Evidence</summary>')
    lines.push('')
    for (const line of row.evidence) lines.push(`- ${line}`)
    if (row.missing?.length) {
      lines.push(`- _Missing signals: ${row.missing.join(', ')}_`)
    }
    lines.push('')
    lines.push('</details>')
  }
  lines.push('')
  return lines.join('\n')
}

export function renderMarkdown(model, { notes = [] } = {}) {
  const out = []
  out.push(`# Etsy listing plan — ${model.date}`)
  out.push('')

  const headline = model.sections.find((s) => s.id === 'list-next')?.rows ?? []
  const seasonal = model.sections.find((s) => s.id === 'seasonal')?.rows ?? []
  const formats = listPhrase(model.formats ?? [])
  if (headline.length || seasonal.length) {
    const top = headline[0] ?? seasonal[0]
    // Lead with what is new. A daily report that opens the same way every
    // morning is one nobody opens by the end of the week.
    const freshness = Number.isFinite(model.newCount)
      ? model.newCount === 0
        ? `**Nothing new today** — ${model.standingCount} still standing from previous days. `
        : `**${model.newCount} new since yesterday**` +
          (model.standingCount ? `, ${model.standingCount} still standing. ` : '. ')
      : ''
    out.push(
      `${freshness}**Today's call:** ${top.term}${top.product ? ` — ${top.product.form}` : ''}. ` +
        `${headline.length} rising ${headline.length === 1 ? 'niche' : 'niches'} and ` +
        `${seasonal.length} seasonal ${seasonal.length === 1 ? 'deadline' : 'deadlines'} worth acting on, ` +
        `from ${model.totalScanned} trends scanned (${model.geo}` +
        `${formats ? `, ${formats}` : ''}).`,
    )
  } else {
    out.push(
      `Nothing is clearly worth listing today — ${model.totalScanned} keywords scanned (${model.geo}) ` +
        'and none cleared the bar. That is a normal result on a quiet week.',
    )
  }
  out.push('')

  if (notes.length) {
    out.push('> [!NOTE]')
    for (const note of notes) out.push(`> ${note}`)
    out.push('')
  }

  for (const section of model.sections) {
    if (!section.rows.length) continue
    out.push(`## ${section.heading}`)
    out.push('')
    out.push(`_${section.blurb}_`)
    out.push('')
    if (section.id === 'avoid') {
      for (const row of section.rows) {
        out.push(`- **${row.term}** — ${row.rationale} ${row.evidence?.[0] ? `(${row.evidence[0]})` : ''}`.trim())
      }
      out.push('')
    } else {
      section.rows.forEach((row, i) => out.push(renderRow(row, i + 1)))
    }
  }

  if (model.filtered?.length) {
    out.push('## Filtered out — wrong format for this shop')
    out.push('')
    out.push(
      `_Trending and commercial, but not sellable as ${(model.formats ?? []).join(' or ')}. ` +
        'Change `profile.formats` in the config if you do make these._',
    )
    out.push('')
    for (const row of model.filtered.slice(0, 10)) {
      out.push(`- **${row.term}** — ${row.formatMismatch.reason}`)
    }
    out.push('')
  }

  if (model.longTail?.length) {
    out.push('## Long-tail phrases worth claiming')
    out.push('')
    out.push(
      '_Phrases people search that came back thin on Etsy. Not niches to build a shop around — ' +
        'specific wording to put in titles and tags so a new listing has something it can rank for on day one._',
    )
    out.push('')
    out.push('| Phrase | Etsy listings | Room to rank | Seen in | From |')
    out.push('|---|---:|---:|---|---|')
    for (const row of model.longTail) {
      const listings = Number.isFinite(row.listings) ? row.listings.toLocaleString('en-US') : '—'
      const room = Number.isFinite(row.roomToRank) ? `${row.roomToRank}/100` : '—'
      const flags = [row.breakout ? 'breakout' : null, row.untagged ? 'untagged by sellers' : null]
        .filter(Boolean)
        .join(', ')
      out.push(
        `| ${row.query}${flags ? ` _(${flags})_` : ''} | ${listings} | ${room} | ` +
          `${row.sources.length} ${row.sources.length === 1 ? 'source' : 'sources'} | ${row.parent} |`,
      )
    }
    out.push('')
  }

  out.push('---')
  out.push('')
  out.push(
    `Generated ${model.generatedAt} · scores are relative rankings from public search interest ` +
      'and Etsy listing supply, not sales data. Etsy publishes no public sales or view counts.',
  )
  out.push('')
  return out.join('\n')
}
