import test from 'node:test'
import assert from 'node:assert/strict'
import { withStore } from './helpers.js'

test('a collection starts at its empty shape', async (t) => {
  const store = await withStore(t)
  assert.deepEqual(await store.get('commitments'), [])
  assert.deepEqual(await store.get('profile'), {})
})

test('records round-trip through the file on disk', async (t) => {
  const store = await withStore(t)
  const saved = await store.add('commitments', { name: 'Rent', amount: 1200 })
  assert.ok(saved.id)
  store.forget()
  const [read] = await store.get('commitments')
  assert.equal(read.name, 'Rent')
})

test('patch changes one record and leaves its id alone', async (t) => {
  const store = await withStore(t)
  const saved = await store.add('commitments', { name: 'Rent', amount: 1200 })
  const patched = await store.patch('commitments', saved.id, { amount: 1250, id: 'sneaky' })
  assert.equal(patched.id, saved.id)
  assert.equal(patched.amount, 1250)
})

test('remove reports whether anything went', async (t) => {
  const store = await withStore(t)
  const saved = await store.add('commitments', { name: 'Rent' })
  assert.equal(await store.remove('commitments', saved.id), true)
  assert.equal(await store.remove('commitments', saved.id), false)
})

test('overlapping writes all land', async (t) => {
  const store = await withStore(t)
  await Promise.all(
    Array.from({ length: 20 }, (_, index) => store.add('events', { title: `Event ${index}` })),
  )
  store.forget()
  assert.equal((await store.get('events')).length, 20)
})

test('an unknown collection is refused rather than written', async (t) => {
  const store = await withStore(t)
  await assert.rejects(() => store.get('nonsense'), /Unknown collection/)
})
