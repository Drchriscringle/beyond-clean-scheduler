const KEY = 'oche-tour-save-v1'

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCareer(career) {
  try {
    if (career) localStorage.setItem(KEY, JSON.stringify(career))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage full or blocked: the game still works for this session.
  }
}
