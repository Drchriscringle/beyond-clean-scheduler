import { NATION_FLAGS } from '../career/players.js'

export function playerLabel(career, id) {
  if (id === null || id === undefined) return 'Bye'
  const p = career.players[id]
  if (!p) return '—'
  return id === 'user' ? `${p.name} (you)` : `${NATION_FLAGS[p.nation] ?? ''} ${p.name}`
}

export function money(n) {
  return `£${Math.round(n ?? 0).toLocaleString()}`
}

export const TIER_LABELS = ['Qualifying', 'Pro Tour', 'Ranking event', 'Major', 'World Championship']

export function statusText(career) {
  const u = career.players.user
  if (career.status.qschool) return 'Q-School entrant'
  if (u.tour === 'pro') return `Tour Card holder · card to end of ${career.status.cardExpiry}`
  return 'Challenge Tour'
}
