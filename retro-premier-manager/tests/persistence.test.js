import { test } from 'node:test'
import assert from 'node:assert/strict'

// persistence.js talks to the browser's localStorage, which doesn't exist
// under Node's test runner - a minimal in-memory stand-in is enough to
// exercise the real save/load/clear/list logic without adding a dependency.
function fakeLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

globalThis.localStorage = fakeLocalStorage()
const { saveGame, loadGame, clearSave, hasSave, listSaves, SAVE_SLOTS } = await import('../src/state/persistence.js')

test('save/load/clear round-trip per slot, independent of other slots', () => {
  globalThis.localStorage = fakeLocalStorage()
  assert.equal(hasSave(1), false)
  assert.equal(hasSave(2), false)

  saveGame({ managerName: 'Slot One Manager' }, 1)
  saveGame({ managerName: 'Slot Two Manager' }, 2)

  assert.equal(hasSave(1), true)
  assert.equal(hasSave(2), true)
  assert.equal(hasSave(3), false)
  assert.equal(loadGame(1).state.managerName, 'Slot One Manager')
  assert.equal(loadGame(2).state.managerName, 'Slot Two Manager')

  clearSave(1)
  assert.equal(hasSave(1), false)
  assert.equal(hasSave(2), true, 'clearing slot 1 should not affect slot 2')
})

test('listSaves reports every slot, occupied or not', () => {
  globalThis.localStorage = fakeLocalStorage()
  saveGame({ managerName: 'Only Save' }, 2)

  const saves = listSaves()
  assert.deepEqual(saves.map((s) => s.slot), SAVE_SLOTS)
  assert.equal(saves.find((s) => s.slot === 2).data.state.managerName, 'Only Save')
  assert.equal(saves.find((s) => s.slot === 1).data, null)
  assert.equal(saves.find((s) => s.slot === 3).data, null)
})

test('a pre-existing legacy single save is migrated into slot 1', () => {
  globalThis.localStorage = fakeLocalStorage()
  globalThis.localStorage.setItem('pm97-save-v1', JSON.stringify({ savedAt: 123, state: { managerName: 'Legacy Manager' } }))

  assert.equal(hasSave(1), true)
  assert.equal(loadGame(1).state.managerName, 'Legacy Manager')
  assert.equal(globalThis.localStorage.getItem('pm97-save-v1'), null, 'the legacy key should be cleaned up after migration')
})

test('loadGame returns null for an empty slot or malformed data', () => {
  globalThis.localStorage = fakeLocalStorage()
  assert.equal(loadGame(1), null)
  globalThis.localStorage.setItem('pm97-save-slot-1', 'not json')
  assert.equal(loadGame(1), null)
})
