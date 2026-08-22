// All figures per matchday/week are simulated approximations, tuned for a
// readable in-game economy rather than real-world accuracy.

import { currentForm } from './form.js'

export function weeklyWageBill(squad) {
  return squad.reduce((sum, p) => sum + p.wage, 0)
}

export function staffWageBill(club) {
  return Math.round(2000 + club.reputation * 1800)
}

export function maintenanceCost(totalCapacity) {
  return Math.round(totalCapacity * 0.35)
}

export function sponsorshipIncome(club) {
  return Math.round(8000 + club.reputation * 14000)
}

// Full-season TV/broadcast pot amortised per matchweek. Championship clubs
// earn a small fraction of Premier League broadcast money, reflecting the
// real-world gulf between the two divisions; Scottish broadcast deals are
// smaller again than even the English Championship's.
export function tvIncomeForWeek(leaguePosition, division = 'PL') {
  if (division === 'CH') {
    const seasonPot = 7_000_000 - (leaguePosition - 1) * 120_000
    return Math.round(Math.max(seasonPot, 3_500_000) / 38)
  }
  if (division === 'SPL') {
    const seasonPot = 1_800_000 - (leaguePosition - 1) * 90_000
    return Math.round(Math.max(seasonPot, 700_000) / 38)
  }
  if (division === 'SCH') {
    const seasonPot = 500_000 - (leaguePosition - 1) * 30_000
    return Math.round(Math.max(seasonPot, 200_000) / 38)
  }
  if (division === 'LALIGA') {
    const seasonPot = 48_000_000 - (leaguePosition - 1) * 1_500_000
    return Math.round(Math.max(seasonPot, 17_000_000) / 38)
  }
  if (division === 'SEGUNDA') {
    const seasonPot = 5_500_000 - (leaguePosition - 1) * 100_000
    return Math.round(Math.max(seasonPot, 2_800_000) / 38)
  }
  if (division === 'SERIEA') {
    const seasonPot = 46_000_000 - (leaguePosition - 1) * 1_400_000
    return Math.round(Math.max(seasonPot, 16_000_000) / 38)
  }
  if (division === 'SERIEB') {
    const seasonPot = 5_000_000 - (leaguePosition - 1) * 90_000
    return Math.round(Math.max(seasonPot, 2_600_000) / 38)
  }
  if (division === 'BUNDESLIGA') {
    const seasonPot = 50_000_000 - (leaguePosition - 1) * 1_600_000
    return Math.round(Math.max(seasonPot, 18_000_000) / 38)
  }
  if (division === 'BUNDESLIGA2') {
    const seasonPot = 6_000_000 - (leaguePosition - 1) * 110_000
    return Math.round(Math.max(seasonPot, 3_000_000) / 38)
  }
  if (division === 'LIGUE1') {
    const seasonPot = 38_000_000 - (leaguePosition - 1) * 1_200_000
    return Math.round(Math.max(seasonPot, 14_000_000) / 38)
  }
  if (division === 'LIGUE2') {
    const seasonPot = 4_500_000 - (leaguePosition - 1) * 80_000
    return Math.round(Math.max(seasonPot, 2_400_000) / 38)
  }
  if (division === 'EREDIVISIE') {
    const seasonPot = 30_000_000 - (leaguePosition - 1) * 1_000_000
    return Math.round(Math.max(seasonPot, 12_000_000) / 38)
  }
  if (division === 'EERSTEDIVISIE') {
    const seasonPot = 5_000_000 - (leaguePosition - 1) * 90_000
    return Math.round(Math.max(seasonPot, 2_600_000) / 38)
  }
  const seasonPot = 60_000_000 - (leaguePosition - 1) * 1_900_000
  return Math.round(Math.max(seasonPot, 22_000_000) / 38)
}

export function availableCapacity(club, stadiumProjects) {
  return club.stands.reduce((sum, stand) => {
    const project = stadiumProjects?.[stand.id]
    if (project && project.weeksRemaining > 0) {
      return sum + Math.round(stand.capacity * 0.35)
    }
    return sum + stand.capacity
  }, 0)
}

// Concession spend is per attendee (not everyone buys food/drink, so it's
// dialled back by a fixed uptake rate) and, like ticket price, pricing it
// too high above a reasonable baseline dampens attendance a little too -
// fans weigh the whole matchday cost, not just the ticket.
const CONCESSION_UPTAKE = 0.65

export function matchdayIncome({ club, capacity, ticketPrice, concessionPrice = 0, leaguePosition, formGoodwill, divisionSize = 20, rng = Math.random }) {
  const reputationBase = 0.55 + club.reputation * 0.06
  // Same overall swing (top club +0.08, bottom club ~0) regardless of the
  // division's actual size, so a smaller league (e.g. a 12-club Scottish
  // Premiership) doesn't get an artificially compressed or inflated bonus.
  const positionBonus = (divisionSize + 1 - leaguePosition) * (0.08 / divisionSize)
  const priceDrag = Math.max(0, (ticketPrice - 40) * 0.0025)
  const concessionDrag = Math.max(0, (concessionPrice - 12) * 0.003)
  const attendancePct = Math.min(
    0.99,
    Math.max(0.35, reputationBase + positionBonus - priceDrag - concessionDrag + formGoodwill + (rng() - 0.5) * 0.08),
  )
  const attendance = Math.round(capacity * attendancePct)
  const gateRevenue = attendance * ticketPrice
  const seasonTicketBase = Math.round(capacity * 0.28 * (ticketPrice * 0.6))
  const concessionRevenue = Math.round(attendance * concessionPrice * CONCESSION_UPTAKE)
  return { attendance, attendancePct, gateRevenue: gateRevenue + seasonTicketBase, concessionRevenue }
}

export function squadValue(squad) {
  return squad.reduce((sum, p) => sum + estimatePlayerValue(p), 0)
}

export function estimatePlayerValue(player) {
  const ageFactor = player.age <= 24 ? 1.35 : player.age <= 29 ? 1.0 : player.age <= 32 ? 0.6 : 0.32
  const base = Math.pow(player.ability / 50, 3.4) * 3_500_000
  const form = currentForm(player)
  const formFactor = Math.max(0.7, Math.min(1.3, 0.85 + (form - 6) * 0.075))
  return Math.max(50_000, Math.round(base * ageFactor * formFactor))
}

export function stadiumValue(club) {
  const totalCap = club.stands.reduce((sum, s) => sum + s.capacity, 0)
  return Math.round(totalCap * 1800)
}
