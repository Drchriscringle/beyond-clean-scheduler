import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../server/store.js'

async function freshStore() {
  return createStore(await mkdtemp(join(tmpdir(), 'course-forge-test-')))
}

test('courses round-trip through the store', async () => {
  const store = await freshStore()
  await store.save({ id: 'crs_one', title: 'One', updatedAt: '2026-01-01T00:00:00.000Z' })

  const loaded = await store.get('crs_one')
  assert.equal(loaded.title, 'One')
  assert.equal(await store.get('crs_missing'), null)
})

test('the list is newest first', async () => {
  const store = await freshStore()
  await store.save({ id: 'crs_old', updatedAt: '2020-01-01T00:00:00.000Z' })
  await store.save({ id: 'crs_new', updatedAt: '2026-01-01T00:00:00.000Z' })

  assert.deepEqual((await store.list()).map((course) => course.id), ['crs_new', 'crs_old'])
})

test('a corrupt file is skipped rather than failing the whole list', async () => {
  const store = await freshStore()
  await store.save({ id: 'crs_good', updatedAt: '2026-01-01T00:00:00.000Z' })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(store.root, 'crs_broken.json'), '{ not json', 'utf8')

  assert.deepEqual((await store.list()).map((course) => course.id), ['crs_good'])
})

test('an id that is not an id is rejected before it touches the filesystem', async () => {
  const store = await freshStore()
  await assert.rejects(() => store.get('../../etc/passwd'), /Invalid course id/)
  await assert.rejects(() => store.remove('a/b'), /Invalid course id/)
})

test('overlapping saves of one course all land, last write wins', async () => {
  // A running build checkpoints after every stage while its request is still
  // open, so saves genuinely overlap. None may fail, and none may leave a
  // temporary file behind.
  const store = await freshStore()
  await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      store.save({ id: 'crs_busy', revision: index, updatedAt: new Date(index).toISOString() }),
    ),
  )

  assert.equal((await store.get('crs_busy')).revision, 29)
  const leftovers = (await readdir(store.root)).filter((file) => file.includes('.tmp'))
  assert.deepEqual(leftovers, [], 'no temporary files survive')
})

test('removing a course is idempotent', async () => {
  const store = await freshStore()
  await store.save({ id: 'crs_gone', updatedAt: '2026-01-01T00:00:00.000Z' })
  await store.remove('crs_gone')
  await store.remove('crs_gone')
  assert.equal(await store.get('crs_gone'), null)
})
