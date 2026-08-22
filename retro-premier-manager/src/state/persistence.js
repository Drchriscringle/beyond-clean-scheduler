const SAVE_KEY_PREFIX = 'pm97-save-slot-'
const LEGACY_SAVE_KEY = 'pm97-save-v1'
export const SAVE_SLOTS = [1, 2, 3]

// All persistence helpers fail soft (return null/false) rather than throw -
// localStorage can be unavailable (private browsing, quota exceeded) and
// that should never crash the game.

function slotKey(slot) {
  return `${SAVE_KEY_PREFIX}${slot}`
}

// One-time migration: before multiple save slots existed, every save lived
// under a single fixed key. If that's still around and slot 1 is free,
// adopt it as slot 1 rather than losing an existing player's save.
function migrateLegacySave() {
  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
    if (legacy && !localStorage.getItem(slotKey(1))) {
      localStorage.setItem(slotKey(1), legacy)
    }
    if (legacy) localStorage.removeItem(LEGACY_SAVE_KEY)
  } catch {
    // best effort only
  }
}

export function saveGame(state, slot = 1) {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify({ savedAt: Date.now(), state }))
    return true
  } catch {
    return false
  }
}

export function loadGame(slot = 1) {
  try {
    migrateLegacySave()
    const raw = localStorage.getItem(slotKey(slot))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.state) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSave(slot = 1) {
  try {
    localStorage.removeItem(slotKey(slot))
    return true
  } catch {
    return false
  }
}

export function hasSave(slot = 1) {
  try {
    migrateLegacySave()
    return localStorage.getItem(slotKey(slot)) != null
  } catch {
    return false
  }
}

// Every slot's save data (or null), for the "continue saved career" picker.
export function listSaves() {
  migrateLegacySave()
  return SAVE_SLOTS.map((slot) => ({ slot, data: loadGame(slot) }))
}
