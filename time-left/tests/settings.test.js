import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  loadSettings,
  resolveInputs,
  saveSettings,
} from '../src/lib/settings.js'
import { parseDate } from '../src/lib/dates.js'

const NOW = parseDate('2026-09-06')

function settings(patch) {
  return { ...DEFAULT_SETTINGS, ...patch }
}

function fakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    store,
  }
}

test('an unfinished form is pending, not wrong', () => {
  assert.equal(resolveInputs(settings({}), NOW).pending, true)
  assert.equal(resolveInputs(settings({ birthDate: '1980-07-01' }), NOW).pending, true)
})

test('a birth date in the future or beyond human record is an error', () => {
  assert.match(resolveInputs(settings({ birthDate: '2030-01-01' }), NOW).error, /future/)
  assert.match(resolveInputs(settings({ birthDate: '1850-01-01' }), NOW).error, /older/)
})

test('a place resolves to the figure for the chosen sex', () => {
  const base = { birthDate: '1980-07-01', regionId: 'united-kingdom' }
  assert.equal(resolveInputs(settings(base), NOW).lifeExpectancyAtBirth, 81.4)
  assert.equal(resolveInputs(settings({ ...base, sex: 'male' }), NOW).lifeExpectancyAtBirth, 79.3)
  assert.equal(resolveInputs(settings({ ...base, sex: 'female' }), NOW).lifeExpectancyAtBirth, 83.4)
})

test('seasons follow the place unless they are overridden', () => {
  const base = { birthDate: '1980-07-01', regionId: 'australia' }
  assert.equal(resolveInputs(settings(base), NOW).hemisphere, 's')
  assert.equal(resolveInputs(settings({ ...base, hemisphere: 'n' }), NOW).hemisphere, 'n')
  assert.equal(
    resolveInputs(settings({ birthDate: '1980-07-01', regionId: 'us-texas' }), NOW).hemisphere,
    'n',
  )
})

test('a custom figure is accepted, and a silly one is not', () => {
  const base = { birthDate: '1980-07-01', regionId: 'custom' }
  const ok = resolveInputs(settings({ ...base, customExpectancy: '90' }), NOW)
  assert.equal(ok.ok, true)
  assert.equal(ok.lifeExpectancyAtBirth, 90)
  assert.equal(ok.hemisphere, 'n')
  assert.match(resolveInputs(settings({ ...base, customExpectancy: '5' }), NOW).error, /between/)
  assert.match(resolveInputs(settings({ ...base, customExpectancy: '' }), NOW).error, /between/)
})

test('settings survive a round trip through storage', () => {
  const storage = fakeStorage()
  const saved = settings({ birthDate: '1980-07-01', regionId: 'uk-scotland', factors: { sleep: 'good' } })
  saveSettings(storage, saved)
  assert.deepEqual(loadSettings(storage), saved)
})

test('missing or corrupt storage falls back to the defaults', () => {
  assert.deepEqual(loadSettings(fakeStorage()), DEFAULT_SETTINGS)
  assert.deepEqual(loadSettings(fakeStorage({ [STORAGE_KEY]: 'not json' })), DEFAULT_SETTINGS)
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS)
  assert.doesNotThrow(() => saveSettings(null, DEFAULT_SETTINGS))
})

test('an older saved shape is filled in with the defaults it lacks', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ birthDate: '1990-01-01' }) })
  const loaded = loadSettings(storage)
  assert.equal(loaded.birthDate, '1990-01-01')
  assert.equal(loaded.mode, DEFAULT_SETTINGS.mode)
  assert.deepEqual(loaded.factors, {})
})
