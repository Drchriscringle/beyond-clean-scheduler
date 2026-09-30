// Bank balance, expenses and sponsorship.
import { news, sendMail } from './inbox.js'
import { pick } from '../engine/rng.js'

const UK = ['ENG', 'SCO', 'WAL', 'NIR', 'IRL']

export function ledger(career, amount, text, date) {
  if (!amount) return
  career.finance.bank += amount
  career.finance.ledger.unshift({ date, text, amount })
  if (career.finance.ledger.length > 300) career.finance.ledger.length = 300
}

// Travel and accommodation for events the player enters. Televised majors and
// invitationals are paid for by the organisers.
export function travelCost(event) {
  if (event.tier >= 3 || event.key === 'ws') return 0
  const uk = UK.includes(event.country)
  if (event.key === 'qsFirst' || event.key === 'qsFinal') return uk || !event.country ? 90 : 160
  if (event.key === 'et') return 380
  return uk ? 110 : 260
}

const BRANDS = {
  equipment: ['Arrowline Tungsten', 'Triple Top Darts', 'Flightpath', 'Barrel & Co.', 'Oche Pro Equipment', 'Steel Tip Supply'],
  shirt: ['Northgate Motors', 'Bulldog Builders', 'Castle Crisps', 'Harbour Insurance', 'Redline Energy', 'Kestrel Logistics'],
  sleeve: ['Mill Lane Plumbing', 'Brewhouse Taverns', 'Clearview Windows', 'Pitstop Tyres'],
}

// Milestones that bring sponsors knocking, with the monthly fee they offer.
const MILESTONES = {
  card: { slot: 'equipment', monthly: 400, bonus: 1000, why: 'on winning your Tour Card' },
  firstTitle: { slot: 'shirt', monthly: 900, bonus: 2500, why: 'after your first title' },
  top64: { slot: 'sleeve', monthly: 600, bonus: 1500, why: 'now you are inside the top 64' },
  top32: { slot: 'shirt', monthly: 2500, bonus: 5000, why: 'now you are inside the top 32' },
  majorQF: { slot: 'equipment', monthly: 1800, bonus: 5000, why: 'after your run on TV' },
  top16: { slot: 'shirt', monthly: 6000, bonus: 10000, why: 'now you are one of the top 16 players in the world' },
  majorTitle: { slot: 'equipment', monthly: 9000, bonus: 20000, why: 'after winning a major' },
}

export function milestone(career, key, rng = Math.random) {
  if (career.milestones[key]) return
  career.milestones[key] = true
  const m = MILESTONES[key]
  const brand = pick(BRANDS[m.slot], rng)
  const months = 12
  const offer = { id: `s${career.mailSeq + 1}`, brand, slot: m.slot, monthly: m.monthly, titleBonus: m.bonus, months }
  career.offers[offer.id] = offer
  sendMail(career, {
    from: `${brand} (sponsorship)`,
    key: `offer-${offer.id}`,
    subject: `Sponsorship offer: ${brand}`,
    body: `Congratulations ${m.why}. ${brand} would like to become your ${m.slot} sponsor for ${months} months: £${m.monthly.toLocaleString()} a month plus £${m.bonus.toLocaleString()} for every title you win.${career.sponsors.some((s) => s.slot === m.slot) ? ` Accepting replaces your current ${m.slot} deal.` : ''}`,
    actions: [{ label: 'Accept', action: 'acceptSponsor', payload: offer.id }, { label: 'Decline', action: 'declineSponsor', payload: offer.id }],
  })
}

export function acceptSponsor(career, offerId) {
  const o = career.offers[offerId]
  if (!o) return
  career.sponsors = career.sponsors.filter((s) => s.slot !== o.slot)
  career.sponsors.push({ ...o, monthsLeft: o.months })
  news(career, `${career.players.user.name} signs a sponsorship deal with ${o.brand}.`)
  delete career.offers[offerId]
}

export function paySponsors(career, date) {
  for (const s of career.sponsors) {
    ledger(career, s.monthly, `${s.brand} sponsorship`, date)
    s.monthsLeft--
    if (s.monthsLeft === 0) sendMail(career, { from: s.brand, subject: `Your ${s.brand} deal has ended`, body: `Thanks for a great year. Keep winning and we'll talk again.` })
  }
  career.sponsors = career.sponsors.filter((s) => s.monthsLeft > 0)
}

export function titleBonuses(career, eventName, date) {
  for (const s of career.sponsors) ledger(career, s.titleBonus, `${s.brand} title bonus: ${eventName}`, date)
}
