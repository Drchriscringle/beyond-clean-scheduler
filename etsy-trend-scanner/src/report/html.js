/**
 * Self-contained HTML rendering of the daily report — no external assets, so
 * the file can be opened from disk, emailed, or served from GitHub Pages.
 */

import { SOURCE_LABELS } from '../analyze/related.js'

const CLASS_META = {
  'starting-to-trend': { label: 'Starting to trend', tone: 'early' },
  'trending-now': { label: 'Trending now', tone: 'hot' },
  'seasonal-window': { label: 'Seasonal window', tone: 'season' },
  'steady-evergreen': { label: 'Steady', tone: 'steady' },
  saturated: { label: 'Saturated', tone: 'avoid' },
  fading: { label: 'Fading', tone: 'avoid' },
  'insufficient-data': { label: 'Not enough data', tone: 'steady' },
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : '—'
}

function meter(label, value) {
  if (!Number.isFinite(value)) return ''
  return `<div class="meter"><span class="meter-label">${escapeHtml(label)}</span>
    <span class="meter-track"><span class="meter-fill" style="width:${Math.round(value)}%"></span></span>
    <span class="meter-value">${Math.round(value)}</span></div>`
}

/**
 * "People also search for" chips. Phrases sellers here have not tagged are
 * marked, because those are the ones worth claiming in a title.
 */
function renderRelated(related = []) {
  if (!related.length) return ''
  const chips = related
    .slice(0, 8)
    .map((row) => {
      const classes = ['chip']
      if (row.breakout) classes.push('chip-breakout')
      else if (row.crossConfirmed && !row.inEtsyTags) classes.push('chip-gap')
      const note = row.breakout ? ' ↑' : row.crossConfirmed && !row.inEtsyTags ? ' ○' : ''
      const title = [
        row.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' + '),
        row.growth ? `growth ${row.growth}` : null,
        row.inEtsyTags ? 'already tagged by sellers here' : 'not yet tagged by sellers here',
      ]
        .filter(Boolean)
        .join(' · ')
      return `<span class="${classes.join(' ')}" title="${escapeHtml(title)}">${escapeHtml(
        row.query,
      )}${note}</span>`
    })
    .join('')
  return `<div class="related"><span class="related-head">People also search for</span>
    <div class="chips">${chips}</div></div>`
}

function renderLongTail(rows = []) {
  if (!rows.length) return ''
  const body = rows
    .map(
      (row) => `<tr>
      <td>${escapeHtml(row.query)}${row.breakout ? ' <span class="chip chip-breakout">breakout</span>' : ''}${
        row.untagged ? ' <span class="chip chip-gap">untagged</span>' : ''
      }</td>
      <td class="num">${Number.isFinite(row.listings) ? row.listings.toLocaleString('en-US') : '—'}</td>
      <td class="num">${Number.isFinite(row.roomToRank) ? row.roomToRank : '—'}</td>
      <td class="muted">${escapeHtml(row.sources.map((s) => SOURCE_LABELS[s] ?? s).join(', '))}</td>
      <td class="muted">${escapeHtml(row.parent)}</td>
    </tr>`,
    )
    .join('')
  return `<section><h2>Long-tail phrases worth claiming</h2>
    <p class="blurb">Phrases people search that came back thin on Etsy. Not niches to build a shop
    around — specific wording for titles and tags so a new listing has something it can rank for on
    day one.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Phrase</th><th class="num">Etsy listings</th><th class="num">Room to rank</th>
      <th>Seen in</th><th>From</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div></section>`
}

/** Why this term is in the report at all — the provenance of a discovered trend. */
function renderTrendingWhy(trending) {
  if (!trending) return ''
  const feeds = (trending.sources ?? [])
    .map((source) => (source === 'wikipedia' ? 'Wikipedia spike' : 'Google trending'))
    .join(' + ')
  const volume = Number.isFinite(trending.traffic)
    ? `${trending.traffic.toLocaleString('en-US')}+ searches today`
    : 'trending today'
  const headline = trending.headlines?.[0]
  return `<p class="why"><strong>Why this is here:</strong> ${escapeHtml(volume)}${
    feeds ? ` <span class="muted">(${escapeHtml(feeds)})</span>` : ''
  }${headline ? `<br><span class="muted">“${escapeHtml(headline)}”</span>` : ''}</p>`
}

function renderIpWarning(warning) {
  if (!warning) return ''
  return `<p class="warn"><strong>Trademark risk (${escapeHtml(warning.risk)}).</strong> ${escapeHtml(
    warning.text,
  )}</p>`
}

/** What discovery saw and threw away — so a quiet day explains itself. */
function renderDiscovery(discovery) {
  if (!discovery) return ''
  const reasons = Object.entries(discovery.rejectionReasons ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${escapeHtml(reason)} ${count}`)
    .join(' · ')
  return `<section class="discovery"><h2>What discovery saw today</h2>
    <p class="blurb">Nothing here was seeded. These are the terms the unseeded trending feeds
    returned, and what survived the screen for things that can actually be sold.</p>
    <div class="stats">
      <div><strong>${discovery.harvested}</strong><span>terms trending</span></div>
      <div><strong>${discovery.rejectedByShape}</strong><span>not a product</span></div>
      <div><strong>${discovery.rejectedAsUnsellable}</strong><span>no buying intent</span></div>
      ${
        discovery.rejectedWrongFormat
          ? `<div><strong>${discovery.rejectedWrongFormat}</strong><span>wrong format</span></div>`
          : ''
      }
      <div><strong>${discovery.qualified}</strong><span>worth scanning</span></div>
    </div>
    ${reasons ? `<p class="blurb">Thrown out as: ${reasons}</p>` : ''}</section>`
}

/** What was set aside as the wrong format, so the filtering is never silent. */
function renderFiltered(filtered = [], formats = []) {
  if (!filtered.length) return ''
  return `<section><h2>Filtered out — wrong format for this shop</h2>
    <p class="blurb">Trending and commercial, but not sellable as ${escapeHtml(
      formats.join(' or '),
    )}. Change <code>profile.formats</code> in the config if you do make these.</p>
    <ul class="avoid">${filtered
      .slice(0, 10)
      .map(
        (row) =>
          `<li><strong>${escapeHtml(row.term)}</strong> — ${escapeHtml(row.formatMismatch.reason)}</li>`,
      )
      .join('')}</ul></section>`
}

function renderCard(row) {
  const meta = CLASS_META[row.classification] ?? CLASS_META['insufficient-data']
  const price = row.price
  return `<article class="card tone-${meta.tone}">
    <header class="card-head">
      <div>
        <h3>${escapeHtml(row.term)}</h3>
        <p class="action">${escapeHtml(row.action)}</p>
      </div>
      <div class="score" title="Composite opportunity score">
        <strong>${row.opportunity ?? '—'}</strong><span>/100</span>
      </div>
    </header>
    <p class="badges">
      <span class="badge">${escapeHtml(meta.label)}</span>
      <span class="badge subtle">confidence: ${escapeHtml(row.confidence)}</span>
      ${row.product ? `<span class="badge subtle">${escapeHtml(row.product.format)}</span>` : ''}
    </p>
    <p class="rationale">${escapeHtml(row.rationale)}</p>
    ${renderTrendingWhy(row.trending)}
    ${renderIpWarning(row.ipWarning)}
    ${
      row.product
        ? `<dl class="facts">
      <div><dt>Make</dt><dd>${escapeHtml(`${row.term} ${row.product.form}`)}</dd></div>
      ${price ? `<div><dt>Price</dt><dd>${money(price.target)} <span class="muted">market ${money(price.band?.[0])}–${money(price.band?.[1])}</span></dd></div>` : ''}
      ${row.deadline ? `<div><dt>Start by</dt><dd>${escapeHtml(row.deadline.startBy)} <span class="muted">live ${escapeHtml(row.deadline.liveBy)}</span></dd></div>` : ''}
      ${row.title ? `<div><dt>Title</dt><dd class="mono">${escapeHtml(row.title)}</dd></div>` : ''}
    </dl>`
        : ''
    }
    ${row.tags?.length ? `<p class="tags">${row.tags.map((t) => `<code>${escapeHtml(t)}</code>`).join('')}</p>` : ''}
    ${renderRelated(row.related)}
    <div class="meters">
      ${meter('Demand', row.parts?.demand)}
      ${meter('Momentum', row.parts?.momentum)}
      ${meter('Room to rank', row.parts?.competitionGap)}
      ${meter('Headroom vs sellers', row.parts?.saturationRisk)}
      ${meter('Seasonal fit', row.parts?.seasonalFit)}
    </div>
    ${
      row.evidence?.length
        ? `<details><summary>Evidence</summary><ul>${row.evidence
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('')}</ul></details>`
        : ''
    }
  </article>`
}

export function renderHtml(model, { notes = [] } = {}) {
  const headline = model.sections.find((s) => s.id === 'list-next')?.rows ?? []
  const seasonal = model.sections.find((s) => s.id === 'seasonal')?.rows ?? []
  const top = headline[0] ?? seasonal[0] ?? null
  const hasRelated = model.sections.some((section) =>
    section.rows.some((row) => row.related?.length),
  )

  const sections = model.sections
    .filter((section) => section.rows.length)
    .map((section) => {
      if (section.id === 'avoid') {
        return `<section><h2>${escapeHtml(section.heading)}</h2><p class="blurb">${escapeHtml(section.blurb)}</p>
        <ul class="avoid">${section.rows
          .map(
            (row) =>
              `<li><strong>${escapeHtml(row.term)}</strong> — ${escapeHtml(row.evidence?.[0] ?? row.rationale)}</li>`,
          )
          .join('')}</ul></section>`
      }
      return `<section><h2>${escapeHtml(section.heading)}</h2><p class="blurb">${escapeHtml(section.blurb)}</p>
      <div class="grid">${section.rows.map(renderCard).join('')}</div></section>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Etsy listing plan — ${escapeHtml(model.date)}</title>
<style>
:root{color-scheme:light dark;--bg:#faf8f5;--panel:#fff;--ink:#1d1a17;--muted:#6b6259;--line:#e7e0d7;
--early:#0f7b53;--hot:#c2410c;--season:#7c3aed;--steady:#57534e;--avoid:#9f1239;--accent:#0f7b53}
@media (prefers-color-scheme:dark){:root{--bg:#16130f;--panel:#1f1b16;--ink:#f2ede6;--muted:#a29688;
--line:#332c24;--early:#4ade80;--hot:#fb923c;--season:#c4b5fd;--steady:#a8a29e;--avoid:#fb7185;--accent:#4ade80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px 64px}
header.top{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:28px}
h1{font-size:1.7rem;margin:0 0 6px;letter-spacing:-.02em}
.lede{font-size:1.05rem;margin:.4rem 0 0;max-width:70ch}
.meta{color:var(--muted);font-size:.85rem;margin-top:10px}
.note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);
padding:10px 14px;border-radius:8px;margin:16px 0;font-size:.9rem;color:var(--muted)}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:14px 0 0;
color:var(--muted);font-size:.8rem}
h2{font-size:1.15rem;margin:36px 0 4px;letter-spacing:-.01em}
.blurb{color:var(--muted);margin:0 0 16px;font-size:.9rem}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;
border-top:3px solid var(--steady)}
.tone-early{border-top-color:var(--early)}.tone-hot{border-top-color:var(--hot)}
.tone-season{border-top-color:var(--season)}.tone-avoid{border-top-color:var(--avoid)}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.card h3{margin:0;font-size:1.05rem;letter-spacing:-.01em}
.action{margin:2px 0 0;font-weight:600;color:var(--accent);font-size:.85rem}
.score{text-align:right;line-height:1.1}.score strong{font-size:1.5rem}.score span{color:var(--muted);font-size:.75rem}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 8px}
.badge{font-size:.72rem;border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--ink)}
.badge.subtle{color:var(--muted)}
.rationale{margin:0 0 12px;font-size:.9rem;color:var(--muted)}
.facts{margin:0 0 12px;display:grid;gap:6px}
.facts div{display:grid;grid-template-columns:88px 1fr;gap:10px;font-size:.86rem}
.facts dt{color:var(--muted)}.facts dd{margin:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem}
.muted{color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 12px}
.tags code{font-size:.72rem;background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:2px 6px}
.why{margin:0 0 10px;padding:8px 11px;background:var(--bg);border-radius:8px;font-size:.83rem}
.warn{margin:0 0 10px;padding:8px 11px;border-radius:8px;font-size:.83rem;
background:var(--bg);border:1px solid var(--avoid);color:var(--ink)}
.warn strong{color:var(--avoid)}
.discovery .stats{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px}
.discovery .stats div{flex:1 1 120px;background:var(--panel);border:1px solid var(--line);
border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.discovery .stats strong{font-size:1.5rem;line-height:1.1}
.discovery .stats span{color:var(--muted);font-size:.75rem}
.related{margin:0 0 12px}
.related-head{display:block;color:var(--muted);font-size:.72rem;text-transform:uppercase;
letter-spacing:.06em;margin-bottom:5px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{font-size:.72rem;border:1px solid var(--line);border-radius:999px;padding:2px 8px;color:var(--muted)}
.chip-breakout{border-color:var(--hot);color:var(--hot)}
.chip-gap{border-color:var(--accent);color:var(--accent)}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{text-align:left;padding:9px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
thead th{color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
tbody tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.meters{display:grid;gap:5px;margin-bottom:10px}
.meter{display:grid;grid-template-columns:120px 1fr 30px;align-items:center;gap:8px;font-size:.75rem}
.meter-label{color:var(--muted)}
.meter-track{height:5px;background:var(--line);border-radius:99px;overflow:hidden}
.meter-fill{display:block;height:100%;background:var(--accent)}
.meter-value{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
details summary{cursor:pointer;font-size:.8rem;color:var(--muted)}
details ul{margin:8px 0 0;padding-left:18px;font-size:.82rem;color:var(--muted)}
ul.avoid{margin:0;padding-left:18px;color:var(--muted);font-size:.9rem}
ul.avoid strong{color:var(--ink)}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <h1>Etsy listing plan — ${escapeHtml(model.date)}</h1>
  <p class="lede">${
    top
      ? `Today's call: <strong>${escapeHtml(top.term)}</strong>${
          top.product ? ` — ${escapeHtml(top.product.form)}` : ''
        }. ${headline.length} rising ${headline.length === 1 ? 'niche' : 'niches'} and ${seasonal.length} seasonal ${
          seasonal.length === 1 ? 'deadline' : 'deadlines'
        } worth acting on.`
      : 'Nothing cleared the bar today. That is a normal result on a quiet week.'
  }</p>
  <p class="meta">${model.totalScanned} trends scanned · market ${escapeHtml(model.geo)}${
    model.formats?.length ? ` · ${escapeHtml(model.formats.join(', '))} only` : ''
  } · generated ${escapeHtml(model.generatedAt)}</p>
  ${notes.map((note) => `<p class="note">${escapeHtml(note)}</p>`).join('')}
  ${
    hasRelated
      ? `<p class="legend">In the "people also search for" chips:
        <span class="chip chip-breakout">breakout ↑</span> growing fastest ·
        <span class="chip chip-gap">gap ○</span> people search it, sellers here have not tagged it</p>`
      : ''
  }
</header>
${renderDiscovery(model.discovery)}
${sections}
${renderFiltered(model.filtered, model.formats)}
${renderLongTail(model.longTail)}
<footer>Scores are relative rankings built from public search-interest data and Etsy listing supply.
Etsy publishes no public sales or view counts, so nothing here is a sales forecast.</footer>
</div>
</body>
</html>
`
}
