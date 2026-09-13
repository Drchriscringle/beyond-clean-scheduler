import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createDashboardServer } from '../server/index.js'
import { withStore } from './helpers.js'

const statement = await readFile(fileURLToPath(new URL('../fixtures/statement.csv', import.meta.url)), 'utf8')
const offline = async () => { throw new Error('no network in tests') }

/** Starts the server on a free port and returns a fetch bound to it. */
async function serve(t, options = {}) {
  const store = options.store ?? (await withStore(t))
  const server = createDashboardServer({ store, fetchImpl: offline, ...options })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`

  const call = async (path, init) => {
    const response = await fetch(`${base}${path}`, init)
    const text = await response.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { status: response.status, body }
  }
  return { store, call, base }
}

const asJson = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('the API describes what it supports', async (t) => {
  const { call } = await serve(t)
  const { status, body } = await call('/api/meta')
  assert.equal(status, 200)
  assert.ok(body.frequencies.monthly)
  assert.ok(body.categories.includes('direct-debit'))
  assert.equal(typeof body.banking.configured, 'boolean')
})

test('an unknown endpoint is a clean 404', async (t) => {
  const { call } = await serve(t)
  assert.equal((await call('/api/nonsense')).status, 404)
})

test('a commitment can be created, changed and removed', async (t) => {
  const { call } = await serve(t)

  const created = await call('/api/commitments', asJson({
    name: 'Broadband', kind: 'outgoing', category: 'direct-debit', amountPence: 3_499,
    schedule: { frequency: 'monthly', anchor: '2026-09-12' },
  }))
  assert.equal(created.status, 201)
  const { id } = created.body

  const patched = await call(`/api/commitments/${id}`, { ...asJson({ amountPence: 3_999 }), method: 'PATCH' })
  assert.equal(patched.body.amountPence, 3_999)
  assert.equal(patched.body.name, 'Broadband', 'a patch leaves the other fields alone')

  const listed = await call('/api/commitments')
  assert.equal(listed.body.commitments.length, 1)

  assert.equal((await call(`/api/commitments/${id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await call('/api/commitments')).body.commitments.length, 0)
})

test('patching something that does not exist is a 404, not a silent create', async (t) => {
  const { call } = await serve(t)
  const result = await call('/api/commitments/nope', { ...asJson({ amountPence: 1 }), method: 'PATCH' })
  assert.equal(result.status, 404)
})

test('malformed JSON is rejected with a readable message', async (t) => {
  const { call } = await serve(t)
  const result = await call('/api/commitments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  })
  assert.equal(result.status, 400)
  assert.match(result.body.error, /valid JSON/)
})

test('the demo loads and the brief then has something in it', async (t) => {
  const { call } = await serve(t)
  assert.equal((await call('/api/demo', { method: 'POST' })).status, 200)

  const { status, body } = await call('/api/brief?news=false')
  assert.equal(status, 200)
  assert.ok(body.money.openingPence > 0)
  assert.ok(body.objectives.active.length > 0)
  assert.ok(body.attention.length > 0)
})

test('the brief can be asked for a specific day', async (t) => {
  const { call } = await serve(t)
  await call('/api/demo', { method: 'POST' })
  const { body } = await call('/api/brief?day=2026-09-13&news=false')
  assert.equal(body.today, '2026-09-13')
  assert.equal(body.heading, 'Sunday 13 September')
})

test('the profile can be read and adjusted', async (t) => {
  const { call } = await serve(t)
  assert.equal((await call('/api/profile')).body.currency, 'GBP')

  const updated = await call('/api/profile', { ...asJson({ bufferPence: 50_000, name: 'Chris' }), method: 'PATCH' })
  assert.equal(updated.body.bufferPence, 50_000)
  assert.equal((await call('/api/profile')).body.name, 'Chris')
})

test('a statement uploads, and uploading it twice adds nothing', async (t) => {
  const { call } = await serve(t)
  const upload = () => call('/api/import?accountId=current', {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    body: statement,
  })

  const first = await upload()
  assert.equal(first.body.read, 8)
  assert.equal(first.body.added, 8)

  const second = await upload()
  assert.equal(second.body.added, 0)
  assert.equal(second.body.duplicates, 8)
  assert.equal((await call('/api/transactions')).body.transactions.length, 8)
})

test('an imported statement shows up in the brief as reconciliation', async (t) => {
  const { store, call } = await serve(t)
  await store.add('commitments', {
    id: 'water', name: 'Water', kind: 'outgoing', category: 'direct-debit', amountPence: 4_200,
    schedule: { frequency: 'monthly', anchor: '2026-09-10' },
  })
  await call('/api/import', { method: 'POST', headers: { 'content-type': 'text/csv' }, body: statement })

  const { body } = await call('/api/brief?day=2026-09-20&news=false')
  assert.deepEqual(body.money.reconciliation.missing.map((entry) => entry.name), ['Water'])
})

test('ticking a step records progress and that the objective moved', async (t) => {
  const { store, call } = await serve(t)
  const created = await call('/api/objectives', asJson({
    title: 'Ship the thing',
    steps: [{ id: 's1', title: 'Write it' }, { id: 's2', title: 'Send it' }],
  }))
  await store.patch('objectives', created.body.id, { lastMovedAt: '2026-01-01T00:00:00.000Z' })

  const ticked = await call('/api/objective-steps', asJson({ objectiveId: created.body.id, stepId: 's1' }))
  assert.equal(ticked.body.steps[0].done, true)
  assert.notEqual(ticked.body.lastMovedAt, '2026-01-01T00:00:00.000Z')
})

test('updating a metric counts as movement', async (t) => {
  const { call } = await serve(t)
  const created = await call('/api/objectives', asJson({
    title: 'Save up', metric: { name: 'saved', start: 0, current: 100, goal: 1000 },
  }))
  const updated = await call('/api/objective-metric', asJson({ objectiveId: created.body.id, current: 450 }))
  assert.equal(updated.body.metric.current, 450)
})

test('updating a metric on an objective that has none is refused', async (t) => {
  const { call } = await serve(t)
  const created = await call('/api/objectives', asJson({ title: 'No metric' }))
  const result = await call('/api/objective-metric', asJson({ objectiveId: created.body.id, current: 5 }))
  assert.equal(result.status, 400)
})

test('a dismissed story is remembered', async (t) => {
  const { store, call } = await serve(t)
  const result = await call('/api/news/dismiss', asJson({ key: 'https://example.com/story' }))
  assert.equal(result.status, 200)
  assert.deepEqual((await store.get('dismissals')).map((entry) => entry.key), ['https://example.com/story'])
})

test('Open Banking says it is unconfigured rather than failing obscurely', async (t) => {
  const { call } = await serve(t)
  const result = await call('/api/banking/connect')
  assert.equal(result.status, 400)
  assert.match(result.body.error, /not configured/)
})

test('a bank callback that this dashboard did not start is refused', async (t) => {
  const { call } = await serve(t)
  const result = await call('/api/banking/callback?code=abc&state=forged')
  assert.equal(result.status, 400)
  assert.match(result.body, /did not start here/)
})

test('bank tokens are never served to the browser', async (t) => {
  const { store, call } = await serve(t)
  await store.add('connections', {
    id: 'c1', name: 'Bank', accessToken: 'super-secret', refreshToken: 'also-secret', accounts: [],
  })
  const { body } = await call('/api/banking/connections')
  assert.equal(body.connections[0].name, 'Bank')
  assert.equal(body.connections[0].accessToken, undefined)
  assert.equal(body.connections[0].refreshToken, undefined)
})

test('an unbuilt front end explains itself instead of 404ing blankly', async (t) => {
  const { call } = await serve(t)
  const { status, body } = await call('/')
  // Either the built app is there, or a clear message about building it.
  if (status === 404) assert.match(body, /npm run build/)
  else assert.equal(status, 200)
})

test('a crafted path cannot read a file outside the build directory', async (t) => {
  const { base } = await serve(t)
  // Percent-encoded too, because fetch collapses a plain `..` before the
  // request is ever sent — only the encoded form reaches the server's guard.
  const attempts = [
    '/../package.json',
    '/%2e%2e%2f%2e%2e%2fpackage.json',
    '/assets/../../package.json',
    '/..%2f..%2fserver%2fstore.js',
  ]
  for (const path of attempts) {
    const body = await (await fetch(`${base}${path}`)).text()
    assert.equal(body.includes('"life-dashboard"'), false, `${path} leaked package.json`)
    assert.equal(body.includes('SECRET_COLLECTIONS'), false, `${path} leaked source`)
  }
})
