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

function money(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : '—'
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
      `opportunity ${score} · confidence ${row.confidence}`,
  )
  lines.push('')
  lines.push(row.rationale)
  lines.push('')

  if (row.product) {
    const price = row.price
    lines.push(
      `- **Make:** ${row.term} ${row.product.form} _(${row.product.format}, ~${row.product.effortDays}d)_`,
    )
    if (price) {
      const band = price.band ? ` — market ${money(price.band[0])}–${money(price.band[1])}` : ''
      lines.push(`- **Price:** ${money(price.target)}${band}`)
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
  if (headline.length || seasonal.length) {
    const top = headline[0] ?? seasonal[0]
    out.push(
      `**Today's call:** ${top.term}${top.product ? ` — ${top.product.form}` : ''}. ` +
        `${headline.length} rising ${headline.length === 1 ? 'niche' : 'niches'} and ` +
        `${seasonal.length} seasonal ${seasonal.length === 1 ? 'deadline' : 'deadlines'} worth acting on, ` +
        `from ${model.totalScanned} keywords scanned (${model.geo}).`,
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
