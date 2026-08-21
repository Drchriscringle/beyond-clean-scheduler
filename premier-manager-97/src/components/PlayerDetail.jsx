import { useState } from 'react'
import { AttrBar, Money, FormBadge, FormDots } from './shared.jsx'
import { formatWage } from '../utils/format.js'
import { estimatePlayerValue } from '../state/finance.js'
import { formLabel, currentForm } from '../state/form.js'
import { expectedWage } from '../state/contracts.js'

function attrLabels(position) {
  if (position === 'GK') {
    return { pace: 'Positioning', tackling: 'Handling', passing: 'Passing', shooting: 'Reflexes', stamina: 'Stamina', strength: 'Strength' }
  }
  return { pace: 'Pace', tackling: 'Tackling', passing: 'Passing', shooting: 'Shooting', stamina: 'Stamina', strength: 'Strength' }
}

export default function PlayerDetail({ state, dispatch }) {
  const [offerFee, setOfferFee] = useState('')
  const [contractWage, setContractWage] = useState(null)
  const [contractYears, setContractYears] = useState(3)
  const ownSquad = state.squads[state.playerClubId]
  const viewingClubId = state.viewingClubId
  const foreignSquad = viewingClubId && viewingClubId !== state.playerClubId ? state.squads[viewingClubId] : null

  const player =
    ownSquad.find((p) => p.id === state.selectedPlayerId) ||
    foreignSquad?.find((p) => p.id === state.selectedPlayerId) ||
    state.freeAgents.find((p) => p.id === state.selectedPlayerId)

  if (!player) {
    return (
      <div className="screen">
        <div className="panel">Player not found.</div>
      </div>
    )
  }

  const isOwn = ownSquad.some((p) => p.id === player.id)
  const isFreeAgent = state.freeAgents.some((p) => p.id === player.id)
  const labels = attrLabels(player.position)
  const value = estimatePlayerValue(player)
  const club = state.clubs[state.playerClubId]

  function back() {
    if (foreignSquad) dispatch({ type: 'NAVIGATE', payload: { screen: 'transfers' } })
    else if (isFreeAgent) dispatch({ type: 'NAVIGATE', payload: { screen: 'transfers' } })
    else dispatch({ type: 'NAVIGATE', payload: { screen: 'squad' } })
  }

  function makeOffer() {
    const fee = Number(offerFee)
    if (!fee || fee <= 0) return
    dispatch({ type: 'MAKE_OFFER', payload: { playerId: player.id, fromClubId: viewingClubId, fee } })
  }

  function signFreeAgent() {
    dispatch({ type: 'SIGN_FREE_AGENT', payload: { playerId: player.id, contractYears: 3 } })
    dispatch({ type: 'NAVIGATE', payload: { screen: 'transfers' } })
  }

  function offerContract() {
    const wage = Number(contractWage ?? expectedWage(player))
    dispatch({ type: 'OFFER_CONTRACT', payload: { playerId: player.id, wage, years: Number(contractYears) } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">
          #{player.squadNumber ?? '-'} {player.name.toUpperCase()}
        </div>
        <button className="btn btn-small" onClick={back} style={{ marginBottom: 10 }}>
          ◄ Back
        </button>
        <div className="grid-2">
          <div className="panel-inset">
            <p>Position: {player.position}</p>
            <p>Age: {player.age}</p>
            <p>Current ability: {player.ability}/99</p>
            <p>Potential ability: {player.potential}/99</p>
            <p>Wage: {formatWage(player.wage)}</p>
            <p>Contract: {player.contractYears === 0 ? 'Expired' : `${player.contractYears} year(s)`}</p>
            <p>Morale: {player.morale}/100</p>
            <p>Fitness: {player.fitness}/100 {player.injured ? `(injured, ${player.injuryWeeks} wks)` : ''}</p>
            <p>Form: <FormBadge player={player} /> — {formLabel(currentForm(player))}</p>
            <p>Estimated value: <Money value={value} /></p>
          </div>
          <div className="panel-inset">
            <AttrBar label={labels.pace} value={player.attributes.pace} />
            <AttrBar label={labels.tackling} value={player.attributes.tackling} />
            <AttrBar label={labels.passing} value={player.attributes.passing} />
            <AttrBar label={labels.shooting} value={player.attributes.shooting} />
            <AttrBar label={labels.stamina} value={player.attributes.stamina} />
            <AttrBar label={labels.strength} value={player.attributes.strength} />
          </div>
        </div>

        <div className="panel-inset" style={{ marginTop: 10 }}>
          <strong>Recent form</strong>
          <div style={{ marginTop: 6 }}>
            <FormDots player={player} />
          </div>
        </div>

        {isOwn && (
          <div className="panel-inset" style={{ marginTop: 10 }}>
            <strong>Contract Renewal</strong>
            <p style={{ fontSize: 14 }}>Current wage: {formatWage(player.wage)}. Guide expectation: {formatWage(expectedWage(player))}.</p>
            <div className="field-row">
              <label htmlFor="contract-wage">New wage (£/wk)</label>
              <input
                id="contract-wage"
                type="number"
                value={contractWage ?? expectedWage(player)}
                onChange={(e) => setContractWage(e.target.value)}
              />
              <label htmlFor="contract-years">Years</label>
              <select id="contract-years" value={contractYears} onChange={(e) => setContractYears(e.target.value)}>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={offerContract}>
                Offer New Deal
              </button>
            </div>
          </div>
        )}

        {!isOwn && !isFreeAgent && (
          <div className="panel-inset" style={{ marginTop: 10 }}>
            <div className="field-row">
              <label htmlFor="offer-fee">Offer fee (£)</label>
              <input id="offer-fee" type="number" value={offerFee} onChange={(e) => setOfferFee(e.target.value)} />
              <button className="btn btn-primary" onClick={makeOffer}>
                Submit Offer
              </button>
            </div>
            <p>Transfer budget remaining: <Money value={club.budget} /></p>
          </div>
        )}

        {isFreeAgent && (
          <div className="panel-inset" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={signFreeAgent}>
              Sign on a Free Transfer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
