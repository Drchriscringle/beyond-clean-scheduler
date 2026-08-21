// Season-start commercial deals: a shirt sponsor and a merchandising
// partner, each offering the same three archetypes traded off between an
// upfront signing bonus and steady weekly income.

const SPONSOR_NAMES = [
  'Northbridge Insurance', 'Atlas Airlines', 'Fenwick Bank', 'Corvus Motors',
  'Halcyon Telecom', 'Meridian Energy', 'Sterling Brewery', 'Vantage Tech',
]

const MERCHANDISE_PARTNERS = [
  'Kestrel Sportswear', 'Ironclad Apparel', 'Redline Kits', 'Anchor & Vine Retail',
  'Founders Sports', 'Blackwood Leisure', 'Crestline Goods', 'Union Sportswear',
]

function buildArchetypes(baseWeekly, baseBonus, names, rng) {
  const name = names[Math.floor(rng() * names.length)]
  return [
    {
      id: 'steady',
      partner: name,
      label: `${name} — Standard Deal`,
      description: 'A modest signing fee with dependable weekly payments.',
      signingBonus: Math.round(baseBonus * 0.6),
      weeklyIncome: Math.round(baseWeekly * 1.0),
    },
    {
      id: 'bonus',
      partner: name,
      label: `${name} — Upfront Bonus Deal`,
      description: 'A large signing bonus now, but smaller payments across the season.',
      signingBonus: Math.round(baseBonus * 1.8),
      weeklyIncome: Math.round(baseWeekly * 0.65),
    },
    {
      id: 'longterm',
      partner: name,
      label: `${name} — Long-Term Partnership`,
      description: 'Little money now, but the best weekly income over a full season.',
      signingBonus: Math.round(baseBonus * 0.25),
      weeklyIncome: Math.round(baseWeekly * 1.45),
    },
  ]
}

export function generateSponsorshipOffers(reputation, rng = Math.random) {
  const baseWeekly = 6000 + reputation * 5500
  const baseBonus = 300_000 + reputation * 350_000
  return buildArchetypes(baseWeekly, baseBonus, SPONSOR_NAMES, rng)
}

export function generateMerchandiseOffers(reputation, rng = Math.random) {
  const baseWeekly = 3500 + reputation * 3200
  const baseBonus = 150_000 + reputation * 180_000
  return buildArchetypes(baseWeekly, baseBonus, MERCHANDISE_PARTNERS, rng)
}
