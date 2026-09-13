// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines in quotes).
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''))
  if (!header) return []
  const keys = header.map((h) => h.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
}

/** Coerce CSV strings into the column types a table expects. */
export function coerceRow(row, columns) {
  const out = {}
  for (const [key, type] of Object.entries(columns)) {
    if (!(key in row)) continue
    const raw = String(row[key]).trim()
    if (raw === '') {
      out[key] = null
      continue
    }
    if (type === 'int') out[key] = Math.round(Number(raw)) || 0
    else if (type === 'num') out[key] = Number(raw) || 0
    else if (type === 'bool') out[key] = /^(true|yes|y|1|✓)$/i.test(raw)
    else out[key] = raw
  }
  return out
}

export const TABLE_COLUMNS = {
  products: {
    name: 'text',
    price: 'num',
    status: 'text',
    etsy_url: 'text',
    etsy_views_30d: 'int',
    etsy_sales_30d: 'int',
    images_ready: 'bool',
    copy_ready: 'bool',
    notes: 'text',
  },
  pinterest_pins: {
    product_id: 'text',
    pin_name: 'text',
    caption: 'text',
    board: 'text',
    status: 'text',
    scheduled_date: 'text',
    scheduled_time: 'text',
    pinterest_url: 'text',
    clicks_7d: 'int',
    impressions_7d: 'int',
    saves_7d: 'int',
    notes: 'text',
  },
  instagram_posts: {
    product_id: 'text',
    post_number: 'int',
    post_date: 'text',
    pillar: 'text',
    hook: 'text',
    caption_full: 'text',
    status: 'text',
    images_ready: 'bool',
    posted_date: 'text',
    instagram_url: 'text',
    likes: 'int',
    saves: 'int',
    comments: 'int',
    clicks_to_etsy: 'int',
    conversions: 'int',
    notes: 'text',
  },
  daily_performance: {
    date: 'text',
    etsy_revenue: 'num',
    etsy_sales: 'int',
    etsy_views: 'int',
    pinterest_clicks: 'int',
    pinterest_impressions: 'int',
    instagram_likes: 'int',
    instagram_saves: 'int',
    instagram_clicks: 'int',
    top_product_revenue: 'text',
    top_pin_clicks: 'text',
    top_post_engagement: 'text',
    notes: 'text',
  },
}
