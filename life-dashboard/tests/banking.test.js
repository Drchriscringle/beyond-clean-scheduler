import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizeUrl, bankingConfig, createBankConnection, exchangeCode, fetchBalancePence,
  fetchTransactions, isConfigured, listAccounts, normalizeTransaction, refreshTokens,
} from '../server/money/banking.js'
import { withStore } from './helpers.js'

const CONFIG = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  redirectUri: 'http://localhost:5175/api/banking/callback',
  environment: 'sandbox',
  auth: 'https://auth.truelayer-sandbox.com',
  api: 'https://api.truelayer-sandbox.com',
}

/** A fetch stand-in serving canned TrueLayer responses. */
function stubApi(routes) {
  const calls = []
  return async (url, options = {}) => {
    calls.push({ url, options })
    const match = Object.keys(routes).find((pattern) => url.includes(pattern))
    if (!match) return { ok: false, status: 404, text: async () => 'not found', json: async () => ({}) }
    const body = typeof routes[match] === 'function' ? routes[match](url, options) : routes[match]
    if (body?.__status && body.__status >= 400) {
      return { ok: false, status: body.__status, text: async () => JSON.stringify(body), json: async () => body }
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }
  }
}

test('the dashboard reports honestly when Open Banking is not set up', () => {
  const config = bankingConfig({})
  assert.equal(isConfigured(config), false)
  assert.throws(() => authorizeUrl(config), /not configured/)
})

test('sandbox is the default, so a misconfiguration cannot hit a real bank', () => {
  assert.equal(bankingConfig({}).environment, 'sandbox')
  assert.equal(bankingConfig({ TRUELAYER_ENV: 'live' }).environment, 'live')
  assert.match(bankingConfig({}).auth, /sandbox/)
})

test('the consent URL asks only for read access, and carries a state', () => {
  const { url, state } = authorizeUrl(CONFIG)
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get('response_type'), 'code')
  assert.equal(parsed.searchParams.get('client_id'), 'test-client')
  assert.equal(parsed.searchParams.get('state'), state)
  assert.ok(state.length >= 16, 'the state should not be guessable')

  const scopes = parsed.searchParams.get('scope').split(' ')
  assert.deepEqual(scopes.sort(), ['accounts', 'balance', 'cards', 'info', 'offline_access', 'transactions'])
  assert.equal(scopes.includes('payments'), false, 'nothing here should be able to move money')
})

test('two consent URLs do not share a state', () => {
  assert.notEqual(authorizeUrl(CONFIG).state, authorizeUrl(CONFIG).state)
})

test('an authorisation code becomes tokens with an expiry', async () => {
  const fetchImpl = stubApi({
    '/connect/token': { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 },
  })
  const tokens = await exchangeCode(CONFIG, 'the-code', { fetchImpl })
  assert.equal(tokens.accessToken, 'access-1')
  assert.equal(tokens.refreshToken, 'refresh-1')
  assert.ok(Date.parse(tokens.expiresAt) > Date.now())
})

test('a rejected exchange explains itself rather than throwing a bare 400', async () => {
  const fetchImpl = stubApi({
    '/connect/token': { __status: 400, error: 'invalid_grant', error_description: 'The code has expired.' },
  })
  await assert.rejects(() => exchangeCode(CONFIG, 'stale', { fetchImpl }), /The code has expired/)
})

test('a refresh that omits the refresh token keeps the existing one', async () => {
  // TrueLayer may return only a new access token; forgetting the old refresh
  // token here would silently end the connection at the next expiry.
  const fetchImpl = stubApi({ '/connect/token': { access_token: 'access-2', expires_in: 3600 } })
  const tokens = await refreshTokens(CONFIG, 'refresh-1', { fetchImpl })
  assert.equal(tokens.accessToken, 'access-2')
  assert.equal(tokens.refreshToken, 'refresh-1')
})

test('accounts and cards both come back', async () => {
  const fetchImpl = stubApi({
    '/data/v1/accounts': {
      results: [{
        account_id: 'acc-1', display_name: 'Everyday', currency: 'GBP',
        account_number: { sort_code: '04-00-04', number: '12345678' },
      }],
    },
    '/data/v1/cards': { results: [{ account_id: 'card-1', display_name: 'Rewards card', partial_card_number: '4321' }] },
  })
  const accounts = await listAccounts(CONFIG, 'access-1', { fetchImpl })
  assert.deepEqual(accounts.map((account) => [account.name, account.kind]), [
    ['Everyday', 'account'],
    ['Rewards card', 'card'],
  ])
  assert.equal(accounts[0].number, '••••5678', 'only the last four digits are kept')
})

test('a balance arrives as pence', async () => {
  const fetchImpl = stubApi({ '/balance': { results: [{ available: 1234.56, current: 1300.00 }] } })
  assert.equal(await fetchBalancePence(CONFIG, 'access-1', 'acc-1', { fetchImpl }), 123_456)
})

test('what you owe on a card counts against you', async () => {
  const fetchImpl = stubApi({ '/balance': { results: [{ current: 450.00 }] } })
  const balance = await fetchBalancePence(CONFIG, 'access-1', 'card-1', { kind: 'card', fetchImpl })
  assert.equal(balance, -45_000)
})

test('a bank transaction lands in the same shape as an imported one', () => {
  const transaction = normalizeTransaction({
    transaction_id: 'tx-1',
    timestamp: '2026-09-14T08:32:00Z',
    description: 'DD NETFLIX.COM',
    merchant_name: 'Netflix',
    amount: -12.99,
    transaction_type: 'DEBIT',
    running_balance: { amount: 1430.33 },
  }, { accountId: 'current' })

  assert.deepEqual(transaction, {
    id: 'tx-1',
    accountId: 'current',
    day: '2026-09-14',
    description: 'Netflix',
    amountPence: -1_299,
    balancePence: 143_033,
    type: 'DEBIT',
    source: 'open-banking',
  })
})

test('card spending reported as a positive debit still comes out negative', () => {
  const transaction = normalizeTransaction(
    { transaction_id: 'tx-2', timestamp: '2026-09-14T08:32:00Z', description: 'SHOP', amount: 20.00, transaction_type: 'DEBIT' },
    { kind: 'card' },
  )
  assert.equal(transaction.amountPence, -2_000)
})

test('a credit is positive whichever way the provider signs it', () => {
  const credit = normalizeTransaction(
    { transaction_id: 'tx-3', timestamp: '2026-09-25T00:00:00Z', description: 'SALARY', amount: 2800, transaction_type: 'CREDIT' },
    {},
  )
  assert.equal(credit.amountPence, 280_000)
})

test('transactions are fetched for the window asked for', async () => {
  let requested = null
  const fetchImpl = stubApi({
    '/transactions': (url) => {
      requested = new URL(url)
      return { results: [{ transaction_id: 't1', timestamp: '2026-09-14T00:00:00Z', description: 'X', amount: -5, transaction_type: 'DEBIT' }] }
    },
  })
  const transactions = await fetchTransactions(CONFIG, 'access-1', 'acc-1', {
    from: '2026-09-01', to: '2026-09-30', fetchImpl,
  })
  assert.equal(transactions.length, 1)
  assert.equal(requested.searchParams.get('from'), '2026-09-01T00:00:00Z')
  assert.equal(requested.searchParams.get('to'), '2026-09-30T23:59:59Z')
})

test('an expired connection renews itself mid-sync and saves the new tokens', async (t) => {
  const store = await withStore(t)
  const account = await store.add('accounts', { name: 'Everyday', balancePence: 0 })
  await store.add('connections', {
    id: 'conn-1',
    name: 'Test Bank',
    accessToken: 'stale',
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() - 60_000).toISOString(), // already expired
    accounts: [{ providerAccountId: 'acc-1', kind: 'account', localAccountId: account.id }],
  })

  let usedToken = null
  const fetchImpl = stubApi({
    '/connect/token': { access_token: 'fresh', expires_in: 3600 },
    '/balance': (url, options) => {
      usedToken = options.headers.authorization
      return { results: [{ available: 1500.00 }] }
    },
  })

  const banking = createBankConnection({ store, config: CONFIG, fetchImpl })
  const { report } = await banking.sync()

  assert.equal(report[0].ok, true)
  assert.equal(usedToken, 'Bearer fresh')
  const [saved] = await store.get('connections')
  assert.equal(saved.accessToken, 'fresh')
  assert.equal(saved.refreshToken, 'refresh-1')
  const [updated] = await store.get('accounts')
  assert.equal(updated.balancePence, 150_000)
})

test('a connection that cannot be renewed is reported, and the others still sync', async (t) => {
  const store = await withStore(t)
  await store.add('connections', {
    id: 'dead', name: 'Old Bank', accessToken: 'stale', refreshToken: null,
    expiresAt: new Date(Date.now() - 60_000).toISOString(), accounts: [],
  })
  await store.add('connections', {
    id: 'live', name: 'Good Bank', accessToken: 'fine',
    expiresAt: new Date(Date.now() + 600_000).toISOString(), accounts: [],
  })

  const banking = createBankConnection({ store, config: CONFIG, fetchImpl: stubApi({}) })
  const { report } = await banking.sync()

  assert.equal(report[0].ok, false)
  assert.match(report[0].error, /reconnect/i)
  assert.equal(report[1].ok, true)
})

test('token files are written so only the owner can read them', async (t) => {
  const { stat } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const store = await withStore(t)
  await store.add('connections', { id: 'c', accessToken: 'secret' })
  const stats = await stat(join(store.root, 'connections.json'))
  assert.equal(stats.mode & 0o777, 0o600)
})
