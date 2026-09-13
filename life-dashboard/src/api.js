/** Everything the browser asks of the local server, in one place. */

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }
  return body
}

const send = (method) => (path, payload) =>
  request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  })

const post = send('POST')
const patch = send('PATCH')

export const api = {
  meta: () => request('/meta'),
  brief: ({ day, news = true } = {}) =>
    request(`/brief?${new URLSearchParams({ ...(day ? { day } : {}), news: String(news) })}`),
  profile: () => request('/profile'),
  saveProfile: (changes) => patch('/profile', changes),
  loadDemo: () => post('/demo'),

  list: (collection) => request(`/${collection}`).then((body) => body[collection] ?? []),
  create: (collection, record) => post(`/${collection}`, record),
  update: (collection, id, changes) => patch(`/${collection}/${id}`, changes),
  remove: (collection, id) => request(`/${collection}/${id}`, { method: 'DELETE' }),

  tickStep: (objectiveId, stepId, done) => post('/objective-steps', { objectiveId, stepId, done }),
  setMetric: (objectiveId, current) => post('/objective-metric', { objectiveId, current }),

  news: (days) => request(`/news${days ? `?days=${days}` : ''}`),
  dismissStory: (key) => post('/news/dismiss', { key }),

  transactions: () => request('/transactions').then((body) => body.transactions),
  clearTransactions: () => request('/transactions', { method: 'DELETE' }),
  importCsv: (text, { accountId, dayFirst = true } = {}) =>
    request(`/import?${new URLSearchParams({ ...(accountId ? { accountId } : {}), dayFirst: String(dayFirst) })}`, {
      method: 'POST',
      headers: { 'content-type': 'text/csv' },
      body: text,
    }),

  bankConnect: () => request('/banking/connect'),
  bankSync: () => post('/banking/sync'),
  bankConnections: () => request('/banking/connections').then((body) => body.connections),
  bankDisconnect: (id) => request(`/banking/connections/${id}`, { method: 'DELETE' }),
}

/** Money, formatted the way the server formats it, for the browser. */
export function money(pence, { currency = 'GBP', locale = 'en-GB', signed = false } = {}) {
  const amount = (pence ?? 0) / 100
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  if (signed) return `${amount < 0 ? '−' : '+'}${formatted}`
  return amount < 0 ? `−${formatted}` : formatted
}

/** Pounds typed into a form, as pence — without floating-point drift. */
export function toPence(value) {
  const cleaned = String(value ?? '').replace(/[£$€,\s]/g, '')
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

export function fromPence(pence) {
  if (pence === null || pence === undefined) return ''
  return (pence / 100).toFixed(2)
}
