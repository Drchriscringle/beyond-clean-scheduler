import { flag, nationName } from '../career/players.js'

export function playerLabel(career, id) {
  if (id === null || id === undefined) return 'Bye'
  if (typeof id === 'string' && id.startsWith('T:')) return `${flag(id.slice(2))} ${nationName(id.slice(2))}`
  const p = career.players[id]
  if (!p) return '—'
  return id === 'user' ? `${flag(p.nation)} ${p.name} (you)` : `${flag(p.nation)} ${p.name}`
}

export function money(n) {
  const v = Math.round(n ?? 0)
  return `${v < 0 ? '−' : ''}£${Math.abs(v).toLocaleString()}`
}

export const TIER_LABELS = ['Qualifying & secondary tours', 'Pro Tour', 'Ranking event', 'Major', 'World Championship']

export const KEY_LABELS = {
  qsFirst: 'Q-School', qsFinal: 'Q-School', ct: 'Challenge Tour', dt: 'Development Tour', pc: 'Players Championship', et: 'European Tour',
  ukopen: 'Major', masters: 'Major', matchplay: 'Major', grandprix: 'Major', eurochamp: 'Major', grandslam: 'Major', pcfinals: 'Major',
  worlds: 'World Championship', premier: 'Premier League', plPlayoffs: 'Premier League', worldcup: 'World Cup', ws: 'World Series', wsfinals: 'World Series',
}

export function statusText(career) {
  const u = career.players.user
  if (u.tour === 'pro') return `Tour Card holder · card to end of ${u.cardExpiry}`
  if (career.qschool?.registered && !career.qschool.done) return 'Q-School entrant'
  if (career.qschool?.registered) return 'Challenge Tour member'
  return 'No Tour Card'
}

export function dateLabel(e) {
  const d = new Date(Date.UTC(e.year, e.month - 1, e.day))
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
