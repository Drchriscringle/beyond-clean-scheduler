// Orders of Merit, all based on prize money, as on the real tour.
//   oom   PDC Order of Merit: ranked prize money over two calendar years
//   pt    Pro Tour: Players Championship + European Tour money this year
//   pc    Players Championship money this year (Players Championship Finals)
//   et    European Tour money this year (European Championship)
//   ct/dt Challenge / Development Tour money this year
//   ws    World Series money this year (World Series Finals)

export const RANKING_LABELS = {
  oom: 'PDC Order of Merit (2 years)',
  pt: 'Pro Tour (this year)',
  pc: 'Players Championships (this year)',
  et: 'European Tour (this year)',
  ct: 'Challenge Tour',
  dt: 'Development Tour',
  ws: 'World Series',
  wo: "Women's Series",
  sn: 'Seniors Tour',
}

export function earned(p, year, cat) {
  return p.earn?.[year]?.[cat] ?? 0
}

export function addEarnings(p, year, cats, amount) {
  if (!amount) return
  p.earn[year] ??= {}
  const e = p.earn[year]
  e.total = (e.total ?? 0) + amount
  for (const c of cats) e[c] = (e[c] ?? 0) + amount
}

export function rankingValue(p, year, key) {
  if (key === 'oom') return earned(p, year, 'ranked') + earned(p, year - 1, 'ranked')
  return earned(p, year, key)
}

function eligible(p, key, year) {
  if (key === 'ct') return p.tour !== 'pro'
  if (key === 'dt') return p.tour !== 'pro' || p.age <= 24
  if (key === 'wo') return p.gender === 'f'
  if (key === 'sn') return p.age >= 45 && p.tour !== 'pro'
  if (key === 'oom') return rankingValue(p, year, 'oom') > 0 || p.tour === 'pro'
  return true
}

// Returns ids in order. Ties are broken by standard so empty rankings still order sensibly.
export function ranking(career, key) {
  const y = career.year
  const cache = (career._rankCache ??= {})
  const stamp = `${key}:${y}:${career.moneyStamp ?? 0}`
  if (cache[key]?.stamp === stamp) return cache[key].list
  const list = Object.values(career.players)
    .filter((p) => eligible(p, key, y))
    .map((p) => [p.id, rankingValue(p, y, key), p.id === 'user' ? career.user.avg : p.rating])
    .sort((a, b) => b[1] - a[1] || b[2] - a[2])
    .map(([id]) => id)
  cache[key] = { stamp, list }
  return list
}

export function rankOf(list, id) {
  const i = list.indexOf(id)
  return i < 0 ? null : i + 1
}

export function prune(career) {
  // Keep only what the Orders of Merit need (and a little history for the stats page).
  const keep = career.year - 2
  for (const p of Object.values(career.players)) {
    for (const y of Object.keys(p.earn)) if (Number(y) < keep && p.id !== 'user') delete p.earn[y]
  }
}
