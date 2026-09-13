import { randomBytes } from 'node:crypto'
import { FetchError } from '../lib/http.js'

/**
 * Open Banking, through TrueLayer.
 *
 * This is optional. Everything else in the money panel works from commitments
 * you type in and statements you import, and it works offline. A live bank
 * connection buys you two things: balances that are right without you updating
 * them, and reconciliation that happens by itself.
 *
 * The consent model is the bank's, not ours: you are sent to your bank, you
 * approve read-only access, and we are handed a token that expires. That token
 * lives in `connections.json`, written user-only. There is no server in the
 * middle — this process talks to TrueLayer directly from your machine.
 *
 * Scope is deliberately read-only. Nothing here can move money, and TrueLayer's
 * payments API is not touched.
 */

const SCOPES = ['info', 'accounts', 'balance', 'cards', 'transactions', 'offline_access']

const ENDPOINTS = {
  sandbox: { auth: 'https://auth.truelayer-sandbox.com', api: 'https://api.truelayer-sandbox.com' },
  live: { auth: 'https://auth.truelayer.com', api: 'https://api.truelayer.com' },
}

export function bankingConfig(env = process.env) {
  const environment = env.TRUELAYER_ENV === 'live' ? 'live' : 'sandbox'
  return {
    clientId: env.TRUELAYER_CLIENT_ID ?? null,
    clientSecret: env.TRUELAYER_CLIENT_SECRET ?? null,
    redirectUri: env.TRUELAYER_REDIRECT_URI ?? 'http://localhost:5175/api/banking/callback',
    environment,
    ...ENDPOINTS[environment],
  }
}

export function isConfigured(config = bankingConfig()) {
  return Boolean(config.clientId && config.clientSecret)
}

/**
 * The URL to send the browser to. `state` is a random value we keep and check
 * on the way back, so a callback we did not start cannot attach an account.
 */
export function authorizeUrl(config, { state = randomBytes(16).toString('hex'), providers = 'uk-ob-all uk-oauth-all' } = {}) {
  if (!isConfigured(config)) throw new Error('Open Banking is not configured — see .env.example.')
  const url = new URL('/', config.auth)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('providers', providers)
  url.searchParams.set('state', state)
  return { url: url.toString(), state }
}

async function postForm(url, body, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  })
  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  if (!response.ok) {
    const detail = payload?.error_description ?? payload?.error ?? text.slice(0, 200)
    throw new FetchError(`TrueLayer rejected the request: ${detail}`, { status: response.status, url })
  }
  return payload
}

export async function exchangeCode(config, code, options = {}) {
  const payload = await postForm(`${config.auth}/connect/token`, {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  }, options)
  return toTokens(payload)
}

export async function refreshTokens(config, refreshToken, options = {}) {
  const payload = await postForm(`${config.auth}/connect/token`, {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  }, options)
  // A refresh response may omit the refresh token, meaning "keep the one you
  // have". Dropping it would silently end the connection at the next expiry.
  return { ...toTokens(payload), refreshToken: payload.refresh_token ?? refreshToken }
}

function toTokens(payload) {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (Number(payload.expires_in ?? 3600) - 60) * 1000).toISOString(),
  }
}

async function getJson(config, path, accessToken, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(`${config.api}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  })
  if (response.status === 401) {
    throw new FetchError('The bank connection has expired and needs reconnecting.', { status: 401 })
  }
  if (!response.ok) {
    throw new FetchError(`TrueLayer returned ${response.status}.`, { status: response.status })
  }
  const payload = await response.json()
  return payload?.results ?? []
}

export async function listAccounts(config, accessToken, options = {}) {
  const [accounts, cards] = await Promise.all([
    getJson(config, '/data/v1/accounts', accessToken, options).catch(() => []),
    getJson(config, '/data/v1/cards', accessToken, options).catch(() => []),
  ])
  return [
    ...accounts.map((account) => ({
      providerAccountId: account.account_id,
      name: account.display_name ?? account.account_type ?? 'Account',
      kind: 'account',
      currency: account.currency ?? 'GBP',
      sortCode: account.account_number?.sort_code ?? null,
      number: account.account_number?.number ? `••••${String(account.account_number.number).slice(-4)}` : null,
    })),
    ...cards.map((card) => ({
      providerAccountId: card.account_id,
      name: card.display_name ?? 'Card',
      kind: 'card',
      currency: card.currency ?? 'GBP',
      number: card.partial_card_number ? `••••${card.partial_card_number}` : null,
    })),
  ]
}

export async function fetchBalancePence(config, accessToken, providerAccountId, { kind = 'account', ...options } = {}) {
  const path = kind === 'card'
    ? `/data/v1/cards/${providerAccountId}/balance`
    : `/data/v1/accounts/${providerAccountId}/balance`
  const [balance] = await getJson(config, path, accessToken, options)
  if (!balance) return null
  // A card's "balance" is what you owe, so it counts against you.
  const amount = kind === 'card'
    ? -Math.abs(balance.current ?? 0)
    : (balance.available ?? balance.current ?? 0)
  return Math.round(amount * 100)
}

export async function fetchTransactions(config, accessToken, providerAccountId, { from, to, kind = 'account', accountId = null, ...options } = {}) {
  const base = kind === 'card' ? 'cards' : 'accounts'
  const query = new URLSearchParams({ from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` })
  const results = await getJson(config, `/data/v1/${base}/${providerAccountId}/transactions?${query}`, accessToken, options)
  return results.map((transaction) => normalizeTransaction(transaction, { accountId, kind }))
}

/**
 * Maps a TrueLayer transaction onto the same shape the CSV importer produces,
 * so reconciliation cannot tell where the data came from.
 */
export function normalizeTransaction(transaction, { accountId = null, kind = 'account' } = {}) {
  const amount = Number(transaction.amount ?? 0)
  // TrueLayer signs `amount` for current accounts but reports card spending as
  // a positive DEBIT, so the type is what decides the direction.
  const type = String(transaction.transaction_type ?? '').toUpperCase()
  const signed = type === 'DEBIT'
    ? -Math.abs(amount)
    : type === 'CREDIT'
      ? Math.abs(amount)
      : kind === 'card' ? -amount : amount

  return {
    id: transaction.transaction_id ?? `${accountId}:${transaction.timestamp}:${amount}`,
    accountId,
    day: String(transaction.timestamp ?? '').slice(0, 10),
    description: (transaction.merchant_name ?? transaction.description ?? '').trim(),
    amountPence: Math.round(signed * 100),
    balancePence: transaction.running_balance?.amount !== undefined
      ? Math.round(Number(transaction.running_balance.amount) * 100)
      : null,
    type: transaction.transaction_category ?? transaction.transaction_type ?? null,
    source: 'open-banking',
  }
}

/**
 * A connection that refreshes itself.
 *
 * Access tokens last an hour, so anything that reads from the bank goes
 * through here; it renews and re-saves the tokens when they are close to
 * expiry rather than failing halfway through a sync.
 */
export function createBankConnection({ store, config = bankingConfig(), fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  async function validAccessToken(connection) {
    const expired = !connection.expiresAt || Date.parse(connection.expiresAt) <= now()
    if (!expired) return connection.accessToken

    if (!connection.refreshToken) {
      throw new FetchError('The bank connection has expired and needs reconnecting.', { status: 401 })
    }
    const tokens = await refreshTokens(config, connection.refreshToken, { fetchImpl })
    await store.patch('connections', connection.id, tokens)
    return tokens.accessToken
  }

  return {
    config,
    isConfigured: () => isConfigured(config),

    async connection(id) {
      const connections = await store.get('connections')
      return connections.find((entry) => entry.id === id) ?? null
    },

    /** Refreshes balances and pulls recent transactions for every connection. */
    async sync({ from, to } = {}) {
      const connections = await store.get('connections')
      const report = []
      const fetched = []

      for (const connection of connections) {
        try {
          const accessToken = await validAccessToken(connection)
          for (const account of connection.accounts ?? []) {
            const balancePence = await fetchBalancePence(config, accessToken, account.providerAccountId, {
              kind: account.kind,
              fetchImpl,
            })
            if (balancePence !== null && account.localAccountId) {
              await store.patch('accounts', account.localAccountId, {
                balancePence,
                balanceUpdatedAt: new Date(now()).toISOString(),
              })
            }
            if (from && to) {
              fetched.push(
                ...(await fetchTransactions(config, accessToken, account.providerAccountId, {
                  from, to, kind: account.kind, accountId: account.localAccountId, fetchImpl,
                })),
              )
            }
          }
          report.push({ id: connection.id, name: connection.name, ok: true, error: null })
        } catch (error) {
          report.push({ id: connection.id, name: connection.name, ok: false, error: error.message })
        }
      }
      return { report, transactions: fetched }
    },
  }
}
