const KEY = 'pdt-career-v2'

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY)
    const c = raw ? JSON.parse(raw) : null
    if (c?.version !== 2) return null
    // Fields added after the first v2 saves.
    c.records ??= { bestIn: {}, peakRank: null, most180s: null, lowestLeg: null, highestCheckout: null, bestAverage: null }
    c.offers ??= {}
    c.prizeScale ??= 1
    c.shirt ??= null
    return c
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
