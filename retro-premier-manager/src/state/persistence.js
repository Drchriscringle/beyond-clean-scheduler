const SAVE_KEY = 'pm97-save-v1'

// All persistence helpers fail soft (return null/false) rather than throw -
// localStorage can be unavailable (private browsing, quota exceeded) and
// that should never crash the game.

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state }))
    return true
  } catch {
    return false
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.state) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) != null
  } catch {
    return false
  }
}
