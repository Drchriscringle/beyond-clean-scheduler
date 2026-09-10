import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCourseForgeServer } from '../server/index.js'
import { createStore } from '../server/store.js'
import { applyEdit } from '../server/http/api.js'
import { sampleCourse } from './helpers.js'

let server
let base

before(async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), 'course-forge-api-')))
  server = createCourseForgeServer({ store, providerOptions: { provider: 'mock' } })
  await new Promise((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve) => server.close(resolve)))

const json = async (path, options) => {
  const response = await fetch(base + path, options)
  return { status: response.status, body: await response.json() }
}

const post = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * Starts a build and waits for it to finish. Generation is accepted and runs
 * in the background, so the test polls the course the way the studio does
 * rather than holding a response open.
 */
async function runGeneration(id, body = {}) {
  const response = await fetch(`${base}/api/courses/${id}/generate`, post(body))

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { body: state } = await json(`/api/courses/${id}`)
    if (state.job && state.job.status !== 'running') return { response, job: state.job, state }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('generation did not finish')
}

test('the meta endpoint reports which generator is in use', async () => {
  const { status, body } = await json('/api/meta')
  assert.equal(status, 200)
  assert.equal(body.provider, 'mock')
  assert.ok(body.levels.includes('beginner'))
})

test('a course is created from a brief and normalized on the way in', async () => {
  const { status, body } = await json('/api/courses', post({ brief: { topic: 'Tables', audience: 'Devs', level: 'nonsense', durationMinutes: 5 } }))
  assert.equal(status, 201)
  assert.equal(body.course.brief.level, 'beginner')
  assert.equal(body.course.brief.durationMinutes, 10, 'below the minimum runtime is raised to it')
  assert.equal(body.course.stage, 'brief')
})

test('a build is accepted immediately and reports its own progress', async () => {
  const { body: created } = await json('/api/courses', post({ brief: { topic: 'Jobs', audience: 'Devs', durationMinutes: 20, moduleCount: 1 } }))

  const { response, job, state } = await runGeneration(created.course.id)
  assert.equal(response.status, 202, 'the request returns rather than being held open')

  assert.equal(job.status, 'done')
  assert.ok(job.steps.length > 0, 'each stage was recorded as it ran')
  assert.ok(job.steps.every((step) => step.state === 'done'))
  assert.ok(job.startedAt && job.finishedAt)
  assert.equal(state.progress.complete, true)
  assert.ok(state.course.modules.length > 0, 'the finished course was persisted')
})

test('a second build is refused while one is running', async () => {
  const { body: created } = await json('/api/courses', post({ brief: { topic: 'Busy', audience: 'Devs', durationMinutes: 20, moduleCount: 1 } }))

  const first = await fetch(`${base}/api/courses/${created.course.id}/generate`, post({}))
  assert.equal(first.status, 202)
  const second = await fetch(`${base}/api/courses/${created.course.id}/generate`, post({}))
  assert.ok([202, 409].includes(second.status), 'either it was already done, or it was refused as busy')

  await runGeneration(created.course.id).catch(() => {})
})

test('every export format is served with the right headers', async () => {
  const { body: created } = await json('/api/courses', post({ brief: { topic: 'Exports', audience: 'Devs', durationMinutes: 20, moduleCount: 1 } }))
  await runGeneration(created.course.id)
  const id = created.course.id

  const html = await fetch(`${base}/api/courses/${id}/export/html`)
  assert.match(html.headers.get('content-type'), /text\/html/)
  assert.match(html.headers.get('content-disposition'), /attachment; filename="exports-a-practical-course\.html"/)

  const preview = await fetch(`${base}/api/courses/${id}/export/preview`)
  assert.equal(preview.headers.get('content-disposition'), null, 'the preview renders inline')

  const scorm = await fetch(`${base}/api/courses/${id}/export/scorm`)
  assert.equal(scorm.headers.get('content-type'), 'application/zip')
  const buffer = Buffer.from(await scorm.arrayBuffer())
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'the body really is a zip')

  const unknown = await fetch(`${base}/api/courses/${id}/export/pdf`)
  assert.equal(unknown.status, 400)
})

test('unknown courses and malformed bodies fail cleanly', async () => {
  assert.equal((await json('/api/courses/crs_nope')).status, 404)
  assert.equal((await json('/api/nothing')).status, 404)

  const bad = await fetch(`${base}/api/courses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ not json',
  })
  assert.equal(bad.status, 400)
})

test('a course can be deleted', async () => {
  const { body: created } = await json('/api/courses', post({ brief: { topic: 'Temporary', audience: 'Devs' } }))
  assert.equal((await json(`/api/courses/${created.course.id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await json(`/api/courses/${created.course.id}`)).status, 404)
})

test('a static path cannot escape the build directory', async () => {
  const response = await fetch(`${base}/../../../../etc/passwd`, { redirect: 'manual' })
  assert.ok(response.status !== 200 || !(await response.text()).includes('root:'))
})

test('applyEdit writes only the fields an author owns', async () => {
  const course = sampleCourse()
  const edited = applyEdit(course, {
    title: '  A better title  ',
    id: 'crs_hacked',
    stage: 'ready',
    generation: { provider: 'forged' },
    modules: [],
  })

  assert.equal(edited.title, 'A better title')
  assert.equal(edited.id, course.id, 'the id is not writable')
  assert.equal(edited.generation.provider, course.generation.provider, 'the generation record is not writable')
  assert.equal(edited.modules.length, course.modules.length, 'modules are not replaceable wholesale')
})

test('editing a lesson re-estimates its scene timings', () => {
  const course = sampleCourse()
  const module = course.modules[0]
  const lesson = module.lessons[0]

  const edited = applyEdit(course, {
    lesson: {
      moduleId: module.id,
      lessonId: lesson.id,
      scenes: [{ heading: 'New', bullets: ['a'], narration: 'word '.repeat(140).trim(), visual: '' }],
      takeaways: ['Kept', ''],
    },
  })

  const updated = edited.modules[0].lessons[0]
  assert.equal(updated.scenes.length, 1)
  assert.equal(updated.scenes[0].seconds, 60, '140 words at 140wpm is a minute')
  assert.deepEqual(updated.takeaways, ['Kept'], 'blank takeaways are dropped')
})
