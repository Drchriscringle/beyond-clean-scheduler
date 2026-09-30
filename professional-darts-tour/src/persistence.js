const KEY = 'pdt-career-v2'

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY)
    const c = raw ? JSON.parse(raw) : null
    return c?.version === 2 ? c : null
  } catch {
    return null
  }
}

export function saveCareer(career) {
  try {
    if (career) {
      const { _rankCache, ...rest } = career
      void _rankCache
      localStorage.setItem(KEY, JSON.stringify(rest))
    } else localStorage.removeItem(KEY)
  } catch {
    // Storage full or blocked: the game still works for this session.
  }
}
