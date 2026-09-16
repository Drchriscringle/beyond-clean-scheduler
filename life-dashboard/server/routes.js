import { createBrief, profileOf } from './brief.js'
import { loadDemo } from './demo.js'
import { addDays, today as todayIn } from './lib/dates.js'
import { authorizeUrl, bankingConfig, createBankConnection, exchangeCode, isConfigured, listAccounts } from './money/banking.js'
import { importCsv, mergeTransactions } from './money/csv.js'
import { CATEGORIES, FREQUENCIES, SHIFTS } from './money/schedule.js'
import { completeStep, createObjective, HORIZONS, OBJECTIVE_STATES, touch } from './objectives.js'
import { TARGET_KINDS } from './news/reel.js'

const MAX_BODY_BYTES = 20_000_000

/** Collections the client may edit directly through the generic CRUD routes. */
const EDITABLE = new Set(['accounts', 'commitments', 'events', 'feeds', 'targets', 'newsSources', 'objectives'])

export function createApi({ store, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const brief = createBrief({ store, fetchImpl, now })
  const banking = createBankConnection({ store, fetchImpl, now: () => now().getTime() })
  // Consent states live in memory: a callback is only valid for the run of the
  // process that started it.
  const pendingStates = new Map()

  return async function handle(req, res, url) {
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const [head, ...rest] = segments

    if (head === 'meta' && req.method === 'GET') {
      return json(res, 200, {
        frequencies: FREQUENCIES,
        categories: CATEGORIES,
        shifts: SHIFTS,
        horizons: HORIZONS,
        objectiveStates: OBJECTIVE_STATES,
        targetKinds: TARGET_KINDS,
        banking: { configured: isConfigured(bankingConfig()), environment: bankingConfig().environment },
        dataDir: store.root,
      })
    }

    if (head === 'brief' && req.method === 'GET') {
      const day = url.searchParams.get('day')
      const result = await brief.build({
        day: day || null,
        refresh: url.searchParams.get('refresh') !== 'false',
        includeNews: url.searchParams.get('news') !== 'false',
      })
      return json(res, 200, result)
    }

    if (head === 'profile') {
      if (req.method === 'GET') return json(res, 200, profileOf(await store.get('profile')))
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await readJson(req)
        const saved = await store.update('profile', (current) => ({ ...current, ...body }))
        return json(res, 200, profileOf(saved))
      }
      return methodNotAllowed(res)
    }

    if (head === 'demo' && req.method === 'POST') {
      const profile = profileOf(await store.get('profile'))
      const data = await loadDemo(store, todayIn(profile.timezone, now()))
      brief.calendar.forget()
      brief.reel.forget()
      return json(res, 200, { loaded: Object.keys(data) })
    }

    // ---- generic collection CRUD ------------------------------------------
    if (EDITABLE.has(head)) {
      const id = rest[0]

      if (!id) {
        if (req.method === 'GET') return json(res, 200, { [head]: await store.get(head) })
        if (req.method === 'POST') {
          const body = await readJson(req)
          const record = head === 'objectives' ? createObjective(body) : body
          const saved = await store.add(head, record)
          invalidate(head, brief)
          return json(res, 201, saved)
        }
        return methodNotAllowed(res)
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await readJson(req)
        const saved = await store.patch(head, id, body)
        if (!saved) return json(res, 404, { error: `No ${singular(head)} with that id.` })
        invalidate(head, brief)
        return json(res, 200, saved)
      }
      if (req.method === 'DELETE') {
        const removed = await store.remove(head, id)
        invalidate(head, brief)
        return json(res, removed ? 200 : 404, removed ? { removed: id } : { error: 'Not found.' })
      }
      return methodNotAllowed(res)
    }

    // ---- objectives: tick a step ------------------------------------------
    if (head === 'objective-steps' && req.method === 'POST') {
      const { objectiveId, stepId, done = true } = await readJson(req)
      const objectives = await store.get('objectives')
      const objective = objectives.find((entry) => entry.id === objectiveId)
      if (!objective) return json(res, 404, { error: 'No objective with that id.' })
      const updated = completeStep(objective, stepId, done, now())
      const saved = await store.patch('objectives', objectiveId, updated)
      return json(res, 200, saved)
    }

    /** Recording progress on a metric also counts as the objective moving. */
    if (head === 'objective-metric' && req.method === 'POST') {
      const { objectiveId, current } = await readJson(req)
      const objectives = await store.get('objectives')
      const objective = objectives.find((entry) => entry.id === objectiveId)
      if (!objective) return json(res, 404, { error: 'No objective with that id.' })
      if (!objective.metric) return json(res, 400, { error: 'That objective has no metric to update.' })
      const updated = touch({ ...objective, metric: { ...objective.metric, current: Number(current) } }, now())
      return json(res, 200, await store.patch('objectives', objectiveId, updated))
    }

    // ---- news -------------------------------------------------------------
    if (head === 'news' && rest[0] === 'dismiss' && req.method === 'POST') {
      const { key } = await readJson(req)
      if (!key) return json(res, 400, { error: 'Nothing to dismiss.' })
      await store.add('dismissals', { kind: 'news', key })
      return json(res, 200, { dismissed: key })
    }

    if (head === 'news' && req.method === 'GET') {
      const profile = profileOf(await store.get('profile'))
      const result = await brief.reel.build({
        today: todayIn(profile.timezone, now()),
        days: Number(url.searchParams.get('days')) || profile.newsDays,
      })
      return json(res, 200, result)
    }

    // ---- money ------------------------------------------------------------
    if (head === 'transactions') {
      if (req.method === 'GET') return json(res, 200, { transactions: await store.get('transactions') })
      if (req.method === 'DELETE') {
        await store.set('transactions', [])
        return json(res, 200, { cleared: true })
      }
      return methodNotAllowed(res)
    }

    if (head === 'import' && req.method === 'POST') {
      const body = await readBody(req)
      const accountId = url.searchParams.get('accountId') ?? null
      const dayFirst = url.searchParams.get('dayFirst') !== 'false'
      const { transactions, skipped, columns } = importCsv(body, { accountId, dayFirst })

      let added = 0
      let duplicates = 0
      await store.update('transactions', (existing) => {
        const merged = mergeTransactions(existing, transactions)
        added = merged.added
        duplicates = merged.duplicates
        return merged.transactions
      })
      return json(res, 200, { read: transactions.length, added, duplicates, skipped, columns })
    }

    // ---- Open Banking -----------------------------------------------------
    if (head === 'banking') {
      const config = bankingConfig()

      if (rest[0] === 'connect' && req.method === 'GET') {
        if (!isConfigured(config)) {
          return json(res, 400, { error: 'Open Banking is not configured. See .env.example.' })
        }
        const { url: consentUrl, state } = authorizeUrl(config)
        pendingStates.set(state, now().getTime())
        return json(res, 200, { url: consentUrl })
      }

      if (rest[0] === 'callback' && req.method === 'GET') {
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        // A callback we did not start must not be able to attach an account.
        if (!state || !pendingStates.has(state)) return html(res, 400, 'That bank connection did not start here. Nothing was saved.')
        pendingStates.delete(state)
        if (!code) return html(res, 400, url.searchParams.get('error_description') ?? 'The bank did not return an authorisation code.')

        try {
          const tokens = await exchangeCode(config, code, { fetchImpl })
          const providerAccounts = await listAccounts(config, tokens.accessToken, { fetchImpl })
          const linked = []
          for (const account of providerAccounts) {
            const local = await store.add('accounts', {
              name: account.name,
              balancePence: 0,
              kind: account.kind,
              provider: 'truelayer',
              number: account.number,
            })
            linked.push({ ...account, localAccountId: local.id })
          }
          await store.add('connections', { ...tokens, name: 'Bank', provider: 'truelayer', accounts: linked })
          await banking.sync()
          return html(res, 200, 'Bank connected. You can close this tab and go back to the dashboard.')
        } catch (error) {
          return html(res, 500, `Could not finish connecting: ${error.message}`)
        }
      }

      if (rest[0] === 'sync' && req.method === 'POST') {
        const profile = profileOf(await store.get('profile'))
        const today = todayIn(profile.timezone, now())
        const { report, transactions } = await banking.sync({ from: addDays(today, -90), to: today })
        let added = 0
        if (transactions.length > 0) {
          await store.update('transactions', (existing) => {
            const merged = mergeTransactions(existing, transactions)
            added = merged.added
            return merged.transactions
          })
        }
        return json(res, 200, { report, added })
      }

      if (rest[0] === 'connections' && req.method === 'GET') {
        const connections = await store.get('connections')
        // Never hand tokens back to the browser.
        return json(res, 200, {
          connections: connections.map(({ accessToken: _access, refreshToken: _refresh, ...rest }) => rest),
        })
      }

      if (rest[0] === 'connections' && rest[1] && req.method === 'DELETE') {
        const removed = await store.remove('connections', rest[1])
        return json(res, removed ? 200 : 404, removed ? { removed: rest[1] } : { error: 'Not found.' })
      }
    }

    return json(res, 404, { error: 'No such endpoint.' })
  }
}

/** A change to feeds or targets means the cached copies are stale. */
function invalidate(collection, brief) {
  if (collection === 'feeds') brief.calendar.forget()
  if (collection === 'targets' || collection === 'newsSources') brief.reel.forget()
}

function singular(collection) {
  return collection.replace(/ies$/, 'y').replace(/s$/, '')
}

export function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function html(res, status, message) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset="utf-8"><title>Life Dashboard</title><body style="font:16px/1.5 system-ui;padding:3rem;max-width:34rem"><p>${escapeHtml(message)}</p>`)
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character])
}

function methodNotAllowed(res) {
  return json(res, 405, { error: 'Method not allowed.' })
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('That upload is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readJson(req) {
  const body = await readBody(req)
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw Object.assign(new Error('That request body was not valid JSON.'), { status: 400 })
  }
}
