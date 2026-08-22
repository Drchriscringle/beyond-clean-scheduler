import { useState } from 'react'
import { formatMoneyFull } from '../utils/format.js'

function DealCard({ deal, selected, onSelect }) {
  return (
    <button className={`club-tile${selected ? ' selected' : ''}`} onClick={onSelect} style={{ width: '100%', textAlign: 'left' }}>
      <div style={{ fontWeight: 'bold' }}>{deal.label}</div>
      <div style={{ fontSize: 14, margin: '4px 0' }}>{deal.description}</div>
      <div style={{ fontSize: 15 }}>Signing bonus: {formatMoneyFull(deal.signingBonus)}</div>
      <div style={{ fontSize: 15 }}>Weekly income: {formatMoneyFull(deal.weeklyIncome)}/wk</div>
    </button>
  )
}

export default function CommercialScreen({ state, dispatch }) {
  const { sponsorshipOptions, merchandiseOptions } = state.commercial
  const [sponsorshipId, setSponsorshipId] = useState(sponsorshipOptions[0].id)
  const [merchandiseId, setMerchandiseId] = useState(merchandiseOptions[0].id)
  const club = state.clubs[state.playerClubId]

  function confirm() {
    dispatch({ type: 'CONFIRM_COMMERCIAL_DEALS', payload: { sponsorshipId, merchandiseId } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">COMMERCIAL BOARDROOM — {club.name.toUpperCase()}</div>
        <p>Before the season begins, the board asks you to settle on this year's commercial partners.</p>

        <div className="panel-inset" style={{ marginBottom: 10 }}>
          <h3>Season Objective</h3>
          <p>The board expects: <strong>{club.objective.label}</strong></p>
        </div>

        <h3>Shirt Sponsorship</h3>
        <div className="grid-3" style={{ marginBottom: 14 }}>
          {sponsorshipOptions.map((deal) => (
            <DealCard key={deal.id} deal={deal} selected={sponsorshipId === deal.id} onSelect={() => setSponsorshipId(deal.id)} />
          ))}
        </div>

        <h3>Merchandising Partner</h3>
        <div className="grid-3">
          {merchandiseOptions.map((deal) => (
            <DealCard key={deal.id} deal={deal} selected={merchandiseId === deal.id} onSelect={() => setMerchandiseId(deal.id)} />
          ))}
        </div>

        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={confirm}>
          Confirm Deals &amp; Begin Season
        </button>
      </div>
    </div>
  )
}
