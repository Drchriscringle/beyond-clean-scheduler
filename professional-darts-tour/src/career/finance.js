// Bank balance, expenses and sponsorship.
import { news, sendMail } from './inbox.js'
import { pick } from '../engine/rng.js'
import { ranking, rankOf } from './rankings.js'

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
  shirt: ['Northgate Motors', 'Bulldog Builders', 'Castle Crisps', 'Harbour Insurance', 'Redline Energy', 'Kestrel Logistics', 'Summit Scaffolding', 'Oakbridge Homes'],
  equipment: ['Arrowline Tungsten', 'Triple Top Darts', 'Flightpath', 'Barrel & Co.', 'Oche Pro Equipment', 'Steel Tip Supply'],
  sleeve: ['Mill Lane Plumbing', 'Brewhouse Taverns', 'Clearview Windows', 'Pitstop Tyres', 'Riverside Roofing', 'Crown Carpets'],
}

export const SLOTS = {
  shirt: { label: 'Main shirt sponsor', factor: 1 },
  equipment: { label: 'Darts & equipment', factor: 0.6 },
  sleeve: { label: 'Sleeve sponsor', factor: 0.35 },
}

// What a main shirt deal is worth per month right now. Driven by your Order of Merit
// ranking, boosted by titles this season, with a small floor for Challenge Tour players.
export function marketValue(career) {
  const y = career.year
  const user = career.players.user
  const oom = ranking(career, 'oom')
  const r = rankOf(oom, 'user')
  const ranked = (user.earn[y]?.ranked ?? 0) + (user.earn[y - 1]?.ranked ?? 0) > 0
  let value
  if (user.tour === 'pro' || (ranked && r <= 128)) value = 45000 * Math.exp(-(r - 1) / 9) + 4000 * Math.exp(-(r - 1) / 45) + 400
  else {
    const ct = rankOf(ranking(career, 'ct'), 'user') ?? 200
    value = 150 + 350 * Math.exp(-(ct - 1) / 15)
  }
  const titles = user.titles.filter((t) => t.startsWith(`${y} `) || t.startsWith(`${y - 1} `)).length
  value *= 1 + Math.min(1, titles * 0.08)
  return Math.round(value / 50) * 50
}

function makeOffer(career, slot, why, rng) {
  const fair = marketValue(career) * SLOTS[slot].factor
  const monthly = Math.max(50, Math.round((fair * (0.8 + rng() * 0.25)) / 50) * 50)
  const brand = pick(BRANDS[slot], rng)
  const offer = { id: `s${career.mailSeq + 1}`, brand, slot, monthly, titleBonus: Math.round((monthly * 1.5) / 50) * 50, months: rng() < 0.5 ? 12 : 24, fair, rounds: 0 }
  career.offers[offer.id] = offer
  offerMail(career, offer, `${brand} would like to become your ${SLOTS[slot].label.toLowerCase()} ${why}.`)
  return offer
}

function offerMail(career, o, intro) {
  const current = career.sponsors.find((s) => s.slot === o.slot)
  const actions = [{ label: `Accept £${o.monthly.toLocaleString()}/month`, action: 'acceptSponsor', payload: o.id }]
  if (o.rounds < 2) {
    for (const [label, ask] of [['Ask for 10% more', 1.1], ['Ask for 25% more', 1.25], ['Ask for 50% more', 1.5]]) actions.push({ label, action: 'negotiateSponsor', payload: `${o.id}:${ask}` })
  }
  actions.push({ label: 'Decline', action: 'declineSponsor', payload: o.id })
  sendMail(career, {
    from: `${o.brand} (sponsorship)`,
    key: `offer-${o.id}-${o.rounds}`,
    subject: `${o.rounds ? 'Revised offer' : 'Sponsorship offer'}: ${o.brand}`,
    body: `${intro}\n\nTerms: £${o.monthly.toLocaleString()} a month for ${o.months} months, plus £${o.titleBonus.toLocaleString()} for every title you win.${current ? ` Accepting replaces your current ${SLOTS[o.slot].label.toLowerCase()}, ${current.brand} (£${current.monthly.toLocaleString()}/month).` : ''}${o.rounds < 2 ? ' You can try to negotiate, but push too hard and they may walk away.' : ' This is their final offer.'}`,
    actions,
  })
}

// Negotiation: how far above a fair deal you ask decides whether they agree, meet you
// halfway, or walk away.
export function negotiateSponsor(career, payload, rng = Math.random) {
  const [id, askStr] = payload.split(':')
  const o = career.offers[id]
  if (!o) return
  const ask = Math.round((o.monthly * Number(askStr)) / 50) * 50
  const ratio = ask / Math.max(1, o.fair)
  const chance = ratio <= 1 ? 0.95 : ratio <= 1.1 ? 0.75 : ratio <= 1.25 ? 0.5 : ratio <= 1.45 ? 0.25 : 0.08
  o.rounds++
  const roll = rng()
  if (roll < chance) {
    o.monthly = ask
    o.titleBonus = Math.round((ask * 1.5) / 50) * 50
    acceptSponsor(career, id)
    sendMail(career, { from: `${o.brand} (sponsorship)`, subject: `Deal agreed with ${o.brand}`, body: `You drive a hard bargain. We agree to £${ask.toLocaleString()} a month for ${o.months} months, plus £${o.titleBonus.toLocaleString()} per title. Welcome aboard.` })
  } else if (roll < chance + (1 - chance) * 0.55 && o.rounds < 3) {
    o.monthly = Math.round((o.monthly + (ask - o.monthly) * 0.45) / 50) * 50
    o.titleBonus = Math.round((o.monthly * 1.5) / 50) * 50
    offerMail(career, o, `We can't go to £${ask.toLocaleString()}, but we'd like to meet you part of the way.`)
  } else {
    delete career.offers[id]
    sendMail(career, { from: `${o.brand} (sponsorship)`, subject: `${o.brand} have withdrawn their offer`, body: `£${ask.toLocaleString()} a month is more than we can justify at the moment. Best of luck this season; perhaps we'll talk again if your ranking improves.` })
  }
}

// Milestones bring sponsors knocking.
const MILESTONES = {
  card: ['equipment', 'now that you have won your Tour Card'],
  firstTitle: ['shirt', 'after your first title'],
  top64: ['sleeve', 'now you are inside the top 64'],
  top32: ['shirt', 'now you are inside the top 32'],
  majorQF: ['equipment', 'after your run on TV'],
  top16: ['shirt', 'now you are one of the top 16 players in the world'],
  majorTitle: ['shirt', 'after winning a major'],
}

export function milestone(career, key, rng = Math.random) {
  if (career.milestones[key]) return
  career.milestones[key] = true
  const [slot, why] = MILESTONES[key]
  makeOffer(career, slot, why, rng)
}

// Each month there's a chance of fresh offers, more likely the better you're doing,
// and existing sponsors offer renewals as deals run out.
export function monthlySponsorship(career, rng = Math.random) {
  const value = marketValue(career)
  const chance = Math.min(0.45, 0.08 + value / 20000)
  const pendingSlots = new Set(Object.values(career.offers).map((o) => o.slot))
  for (const slot of Object.keys(SLOTS)) {
    const current = career.sponsors.find((s) => s.slot === slot)
    if (pendingSlots.has(slot)) continue
    const worthMore = current && current.monthly < value * SLOTS[slot].factor * 0.8
    if (current && current.monthsLeft <= 1) makeOffer(career, slot, `as your ${current.brand} deal ends this month`, rng)
    else if ((!current || worthMore) && rng() < chance) makeOffer(career, slot, current ? 'with a bigger deal than your current one' : `based on your ranking`, rng)
  }
}

export function acceptSponsor(career, offerId) {
  const o = career.offers[offerId]
  if (!o) return
  career.sponsors = career.sponsors.filter((s) => s.slot !== o.slot)
  career.sponsors.push({ ...o, monthsLeft: o.months })
  news(career, `${career.players.user.name} signs a ${o.months}-month deal with ${o.brand}.`)
  for (const [id, other] of Object.entries(career.offers)) if (other.slot === o.slot) delete career.offers[id]
}

export function paySponsors(career, date) {
  for (const s of career.sponsors) {
    ledger(career, s.monthly, `${s.brand} sponsorship`, date)
    s.monthsLeft--
    if (s.monthsLeft === 0) sendMail(career, { from: s.brand, subject: `Your ${s.brand} deal has ended`, body: 'Thanks for your time with us. Keep winning and we will talk again.' })
  }
  career.sponsors = career.sponsors.filter((s) => s.monthsLeft > 0)
}

export function titleBonuses(career, eventName, date) {
  for (const s of career.sponsors) ledger(career, s.titleBonus, `${s.brand} title bonus: ${eventName}`, date)
}
