import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createDom, findAll } from './dom-stub.js'
import { sampleCourse } from './helpers.js'
import { toPlayerCourse } from '../server/export/html.js'

const source = await readFile(
  fileURLToPath(new URL('../server/export/player/player.js', import.meta.url)),
  'utf8',
)

/**
 * Runs the real player source against a stub DOM. `parent` lets a test model
 * the window the player is framed in — including one that refuses to be read.
 */
function bootPlayer({ parent, opener, localStorage } = {}) {
  const { document, sidebar, main } = createDom()
  const errors = []

  const window = {
    __COURSE__: toPlayerCourse(sampleCourse()),
    localStorage: localStorage ?? {
      store: new Map(),
      getItem(key) {
        return this.store.get(key) ?? null
      },
      setItem(key, value) {
        this.store.set(key, value)
      },
    },
    addEventListener() {},
    scrollTo() {},
    opener: opener ?? null,
  }
  // `window.parent` is defined separately so a test can make reading it throw,
  // which is what a cross-origin ancestor does.
  Object.defineProperty(window, 'parent', parent ?? { value: window })

  try {
    new Function('window', 'document', source)(window, document)
  } catch (error) {
    errors.push(error)
  }

  return { sidebar, main, errors }
}

/** A window whose every property read throws, as a cross-origin one does. */
function crossOriginWindow() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          'Blocked a frame with origin "https://example.test" from accessing a cross-origin frame.',
        )
      },
    },
  )
}

test('the player renders when it owns the page', () => {
  const { sidebar, main, errors } = bootPlayer()

  assert.deepEqual(errors, [])
  assert.ok(findAll(sidebar, 'nav-item').length > 0, 'the outline is rendered')
  assert.ok(findAll(main, 'stage').length > 0, 'the first slide is rendered')
})

test('the player still renders when framed cross-origin', () => {
  // The bug this guards: the SCORM adapter walked up the window chain reading
  // `win.API`, which throws cross-origin. The throw escaped the boot IIFE and
  // the learner got a blank page — in an LMS iframe as much as anywhere else.
  const { sidebar, main, errors } = bootPlayer({
    parent: { get: () => crossOriginWindow() },
  })

  assert.deepEqual(errors, [], 'a cross-origin ancestor must not throw out of the player')
  assert.ok(findAll(sidebar, 'nav-item').length > 0, 'the outline is still rendered')
  assert.ok(findAll(main, 'stage').length > 0, 'the first slide is still rendered')
})

test('an unreadable window.opener does not stop the player', () => {
  const { sidebar, errors } = bootPlayer({ opener: crossOriginWindow() })

  assert.deepEqual(errors, [])
  assert.ok(findAll(sidebar, 'nav-item').length > 0)
})

test('the player renders when storage is unavailable', () => {
  // Private browsing and blocked site data both make this throw.
  const hostile = {
    getItem() {
      throw new Error('The operation is insecure.')
    },
    setItem() {
      throw new Error('The operation is insecure.')
    },
  }
  const { sidebar, main, errors } = bootPlayer({ localStorage: hostile })

  assert.deepEqual(errors, [])
  assert.ok(findAll(sidebar, 'nav-item').length > 0)
  assert.ok(findAll(main, 'stage').length > 0)
})

test('a SCORM API that is present gets initialised', () => {
  const calls = []
  const api = {
    LMSInitialize: (value) => {
      calls.push(['LMSInitialize', value])
      return 'true'
    },
    LMSGetValue: (key) => {
      calls.push(['LMSGetValue', key])
      return 'not attempted'
    },
    LMSSetValue: (key, value) => calls.push(['LMSSetValue', key, value]),
    LMSCommit: () => calls.push(['LMSCommit']),
    LMSFinish: () => calls.push(['LMSFinish']),
  }

  const { errors } = bootPlayer({ parent: { value: { API: api, parent: null } } })

  assert.deepEqual(errors, [])
  assert.ok(calls.some(([name]) => name === 'LMSInitialize'), 'the handshake runs')
  assert.ok(
    calls.some(([name, key, value]) => name === 'LMSSetValue' && key === 'cmi.core.lesson_status' && value === 'incomplete'),
    'a fresh attempt is marked incomplete',
  )
})

test('a SCORM API that throws does not take the player down', () => {
  const api = {
    LMSInitialize: () => 'true',
    LMSGetValue: () => {
      throw new Error('LMS connection lost')
    },
    LMSSetValue: () => {},
    LMSCommit: () => {},
    LMSFinish: () => {},
  }

  const { sidebar, errors } = bootPlayer({ parent: { value: { API: api, parent: null } } })

  assert.deepEqual(errors, [])
  assert.ok(findAll(sidebar, 'nav-item').length > 0, 'the course is still playable')
})
