/**
 * Reading a bank's CSV export.
 *
 * Every bank exports a different shape, and several of them are wrong in the
 * same predictable ways: dates as DD/MM/YYYY, amounts with a currency symbol
 * and thousands separators, debits either negative or in their own column,
 * and descriptions wrapped in quotes containing the delimiter. So the columns
 * are detected rather than assumed, and anything undetectable is reported as a
 * row that needs a mapping rather than silently dropped.
 */

/**
 * A CSV parser that honours quoting. Written out rather than split(',')
 * because a merchant called "SMITH, J & SONS LTD" is extremely normal and
 * splitting naively shifts every column after it.
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text).replace(/^﻿/, '') // strip a BOM from Excel

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else quoted = false
      } else field += character
      continue
    }

    if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += character
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

const HEADER_PATTERNS = {
  day: [/^(transaction\s*)?date$/i, /^date$/i, /^posted$/i, /^value date$/i],
  description: [/^(transaction\s*)?description$/i, /^details$/i, /^narrative$/i, /^merchant$/i, /^reference$/i, /^memo$/i, /^name$/i],
  amount: [/^amount$/i, /^value$/i, /^transaction amount$/i],
  debit: [/^(debit|paid out|money out|withdrawal)s?( amount)?$/i],
  credit: [/^(credit|paid in|money in|deposit)s?( amount)?$/i],
  balance: [/^balance$/i, /^running balance$/i],
  type: [/^type$/i, /^transaction type$/i],
}

/** Works out which column is which from the header row. */
export function detectColumns(header) {
  const mapping = {}
  header.forEach((rawName, index) => {
    const name = String(rawName).trim()
    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (mapping[field] === undefined && patterns.some((pattern) => pattern.test(name))) {
        mapping[field] = index
        return
      }
    }
  })
  return mapping
}

/**
 * Parses a date the way a bank wrote it.
 *
 * Day-first is assumed for ambiguous slash dates, because these exports come
 * from UK and European banks; an ISO date is unambiguous and read as such.
 * 05/03 is the 5th of March, not the 3rd of May — getting this backwards would
 * quietly misdate a third of every statement, so `dayFirst` is explicit.
 */
export function parseCsvDate(value, { dayFirst = true } = {}) {
  const text = String(value).trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text)
  if (slash) {
    const [, first, second, rawYear] = slash
    const day = dayFirst ? first : second
    const month = dayFirst ? second : first
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    if (Number(month) > 12) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // "13 Sep 2026" and friends.
  const named = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/.exec(text)
  if (named) {
    const month = MONTHS.findIndex((name) => name.startsWith(named[2].slice(0, 3).toLowerCase()))
    if (month >= 0) {
      return `${named[3]}-${String(month + 1).padStart(2, '0')}-${String(named[1]).padStart(2, '0')}`
    }
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Money as pence, from whatever decoration the bank applied. */
export function parseAmountPence(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null

  // Accounting style: (12.34) means negative.
  const bracketed = /^\((.*)\)$/.exec(text)
  const body = bracketed ? bracketed[1] : text
  const cleaned = body.replace(/[£$€,\s]/g, '')
  if (!/^[+-]?\d*\.?\d+$/.test(cleaned)) return null

  const pence = Math.round(Number(cleaned) * 100)
  if (!Number.isFinite(pence)) return null
  return bracketed ? -pence : pence
}

/**
 * Turns a CSV export into normalised transactions.
 *
 * The same shape comes out of the Open Banking provider, so everything
 * downstream — reconciliation, the ledger, the "unexpected payment" check —
 * works identically whether the data was imported or synced.
 */
export function importCsv(text, { accountId = null, dayFirst = true, columns = null } = {}) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { transactions: [], skipped: [], columns: {} }

  const mapping = columns ?? detectColumns(rows[0])
  const hasHeader = Object.keys(mapping).length > 0
  const body = hasHeader ? rows.slice(1) : rows

  if (!hasHeader || mapping.day === undefined) {
    return {
      transactions: [],
      skipped: body.map((row, index) => ({ line: index + 1, row, reason: 'Could not tell which column holds the date.' })),
      columns: mapping,
    }
  }

  const transactions = []
  const skipped = []

  body.forEach((row, index) => {
    const line = index + (hasHeader ? 2 : 1)
    const day = parseCsvDate(row[mapping.day], { dayFirst })
    if (!day) {
      skipped.push({ line, row, reason: `Could not read the date "${row[mapping.day] ?? ''}".` })
      return
    }

    let amountPence = null
    if (mapping.amount !== undefined) {
      amountPence = parseAmountPence(row[mapping.amount])
    }
    if (amountPence === null && (mapping.debit !== undefined || mapping.credit !== undefined)) {
      // Separate in/out columns: exactly one is filled per row.
      const debit = parseAmountPence(row[mapping.debit])
      const credit = parseAmountPence(row[mapping.credit])
      if (debit) amountPence = -Math.abs(debit)
      else if (credit) amountPence = Math.abs(credit)
    }
    if (amountPence === null) {
      skipped.push({ line, row, reason: 'Could not read an amount.' })
      return
    }

    const description = (mapping.description !== undefined ? row[mapping.description] : '') ?? ''
    transactions.push({
      id: `${accountId ?? 'import'}:${day}:${amountPence}:${hash(description)}`,
      accountId,
      day,
      description: description.trim().replace(/\s+/g, ' '),
      amountPence,
      balancePence: mapping.balance !== undefined ? parseAmountPence(row[mapping.balance]) : null,
      type: mapping.type !== undefined ? String(row[mapping.type] ?? '').trim() : null,
      source: 'csv',
    })
  })

  return { transactions, skipped, columns: mapping }
}

/** A short stable hash, so re-importing the same file does not duplicate rows. */
function hash(text) {
  let value = 5381
  for (let index = 0; index < text.length; index += 1) {
    value = ((value * 33) ^ text.charCodeAt(index)) >>> 0
  }
  return value.toString(36)
}

/** Merges new transactions into existing ones, skipping those already held. */
export function mergeTransactions(existing, incoming) {
  const seen = new Set(existing.map((transaction) => transaction.id))
  const added = incoming.filter((transaction) => !seen.has(transaction.id))
  return { transactions: [...existing, ...added], added: added.length, duplicates: incoming.length - added.length }
}
