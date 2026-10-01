// The in-game email inbox: entry confirmations, PDC tournament office communications,
// prize money statements, sponsor offers and a monthly news round-up.

export const SENDERS = {
  office: 'PDC Tournament Office',
  finance: 'PDC Finance',
  pdpa: 'PDPA Player Services',
  qschool: 'PDC Qualifying School',
  news: 'Darts Weekly',
  premier: 'PDC Premier League',
}

export function dateStr(career, event) {
  const e = event ?? career.calendar[Math.min(career.eventIndex, career.calendar.length - 1)]
  const y = e?.year ?? career.year
  return `${y}-${String(e?.month ?? 12).padStart(2, '0')}-${String(e?.day ?? 31).padStart(2, '0')}`
}

export function sendMail(career, { from, subject, body, actions = null, key = null, date = null, article = null }) {
  if (key && career.inbox.some((m) => m.key === key)) return null
  const mail = { id: `m${++career.mailSeq}`, key, date: date ?? dateStr(career), from: SENDERS[from] ?? from, subject, body, actions, read: false, resolved: null }
  if (article) mail.article = article
  career.inbox.unshift(mail)
  if (career.inbox.length > 400) career.inbox.length = 400
  return mail
}

export function resolveMail(career, key, label) {
  for (const m of career.inbox) if (m.key === key && !m.resolved) m.resolved = label
}

export function unreadCount(career) {
  return career.inbox.filter((m) => !m.read).length
}

export function news(career, text, event = null) {
  career.news.unshift({ date: dateStr(career, event), text })
  if (career.news.length > 400) career.news.length = 400
}
