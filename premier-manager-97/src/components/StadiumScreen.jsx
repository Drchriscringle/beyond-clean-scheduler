import { useState } from 'react'
import { Money } from './shared.jsx'
import { formatMoneyFull } from '../utils/format.js'
import { totalCapacity } from '../data/clubs.js'
import { buildCost, buildWeeks } from '../state/transfers.js'
import { PITCH_LEVELS, TRAINING_LEVELS, YOUTH_LEVELS, nextLevel } from '../data/facilities.js'

const EXPAND_OPTIONS = [1000, 2500, 5000]

function FacilityBlock({ title, levels, currentLevel, onUpgrade, bankBalance }) {
  const current = levels.find((l) => l.level === currentLevel)
  const next = nextLevel(levels, currentLevel)
  return (
    <div className="panel-inset">
      <h3>{title}</h3>
      <p>Current: {current.label} (Level {current.level})</p>
      {next ? (
        <>
          <p>Next: {next.label} — {formatMoneyFull(next.cost)}</p>
          <button className="btn btn-primary" disabled={next.cost > bankBalance} onClick={onUpgrade}>
            Upgrade
          </button>
        </>
      ) : (
        <p>Already at the highest level.</p>
      )}
    </div>
  )
}

export default function StadiumScreen({ state, dispatch }) {
  const club = state.clubs[state.playerClubId]
  const [ticketPrice, setTicketPrice] = useState(club.ticketPrice)

  function build(standId, add) {
    dispatch({ type: 'BUILD_STAND', payload: { standId, capacityAdd: add } })
  }

  function applyTicketPrice() {
    dispatch({ type: 'SET_TICKET_PRICE', payload: { price: Number(ticketPrice) } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">{club.name.toUpperCase()} — {club.ground.toUpperCase()}</div>
        <p>Total capacity: {totalCapacity(club).toLocaleString('en-GB')}</p>
        <p>Bank balance: <Money value={club.bankBalance} /></p>

        <div className="grid-2">
          {club.stands.map((stand) => {
            const project = club.stadiumProjects[stand.id]
            return (
              <div className="panel-inset" key={stand.id}>
                <h3>{stand.name}</h3>
                <p>Capacity: {stand.capacity.toLocaleString('en-GB')}</p>
                {project ? (
                  <p>
                    Under construction: +{project.capacityAdd.toLocaleString('en-GB')} seats, {project.weeksRemaining} week(s)
                    remaining. Capacity reduced while building.
                  </p>
                ) : (
                  <div className="field-row" style={{ flexWrap: 'wrap' }}>
                    {EXPAND_OPTIONS.map((add) => (
                      <button
                        key={add}
                        className="btn btn-small"
                        disabled={buildCost(add, club.reputation) > club.bankBalance}
                        onClick={() => build(stand.id, add)}
                        title={`${formatMoneyFull(buildCost(add, club.reputation))}, ${buildWeeks(add)} weeks`}
                      >
                        +{add.toLocaleString('en-GB')} ({formatMoneyFull(buildCost(add, club.reputation))})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="panel-inset" style={{ marginTop: 10 }}>
          <h3>Ticket Pricing</h3>
          <div className="field-row">
            <label htmlFor="ticket-price">Ticket price (£)</label>
            <input id="ticket-price" type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} />
            <button className="btn" onClick={applyTicketPrice}>
              Set Price
            </button>
          </div>
          <p>Higher prices raise revenue per fan but dampen attendance.</p>
        </div>

        <div className="grid-3" style={{ marginTop: 10 }}>
          <FacilityBlock
            title="Pitch Quality"
            levels={PITCH_LEVELS}
            currentLevel={club.facilities.pitch}
            bankBalance={club.bankBalance}
            onUpgrade={() => dispatch({ type: 'UPGRADE_FACILITY', payload: { facility: 'pitch' } })}
          />
          <FacilityBlock
            title="Training Ground"
            levels={TRAINING_LEVELS}
            currentLevel={club.facilities.training}
            bankBalance={club.bankBalance}
            onUpgrade={() => dispatch({ type: 'UPGRADE_FACILITY', payload: { facility: 'training' } })}
          />
          <FacilityBlock
            title="Youth Academy"
            levels={YOUTH_LEVELS}
            currentLevel={club.facilities.youth}
            bankBalance={club.bankBalance}
            onUpgrade={() => dispatch({ type: 'UPGRADE_FACILITY', payload: { facility: 'youth' } })}
          />
        </div>
      </div>
    </div>
  )
}
