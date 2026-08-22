import { useState } from 'react'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID } from '../data/clubs.js'
import { totalCapacity } from '../data/clubs.js'
import { formatMoney } from '../utils/format.js'
import { RepStars } from './shared.jsx'
import { loadGame, clearSave } from '../state/persistence.js'

export default function NewGameScreen({ dispatch }) {
  const [division, setDivision] = useState('PL')
  const [clubId, setClubId] = useState(null)
  const [managerName, setManagerName] = useState('')
  const [savedGame, setSavedGame] = useState(() => loadGame())

  const clubList = division === 'CH' ? CHAMPIONSHIP_CLUBS : CLUBS
  const selected = CLUB_BY_ID[clubId]

  function chooseDivision(next) {
    setDivision(next)
    setClubId(null)
  }

  function start() {
    if (!clubId || !managerName.trim()) return
    dispatch({ type: 'START_NEW_GAME', payload: { clubId, managerName: managerName.trim() } })
  }

  function continueSave() {
    if (!savedGame) return
    dispatch({ type: 'LOAD_GAME', payload: { state: savedGame.state, savedAt: savedGame.savedAt } })
  }

  function deleteSave() {
    clearSave()
    setSavedGame(null)
  }

  return (
    <div className="screen">
      {savedGame && (
        <div className="panel">
          <div className="panel-title">CONTINUE SAVED CAREER</div>
          <p>
            {savedGame.state.managerName} — {CLUB_BY_ID[savedGame.state.playerClubId]?.name ?? 'Unknown club'}
            &nbsp;· Season {savedGame.state.season}, Week {Math.min(savedGame.state.week, 38)}/38
          </p>
          <p style={{ fontSize: 14 }}>Last saved: {new Date(savedGame.savedAt).toLocaleString()}</p>
          <button className="btn btn-primary" onClick={continueSave}>
            Continue
          </button>{' '}
          <button className="btn btn-danger" onClick={deleteSave}>
            Delete Save
          </button>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">PREMIER MANAGER '97 — NEW GAME</div>
        <p>Select a club to take charge of for the 2025/26 season.</p>
        <div className="tabs" style={{ marginBottom: 8 }}>
          <button className={`tab${division === 'PL' ? ' active' : ''}`} onClick={() => chooseDivision('PL')}>
            Premier League
          </button>
          <button className={`tab${division === 'CH' ? ' active' : ''}`} onClick={() => chooseDivision('CH')}>
            Championship
          </button>
        </div>
        <div className="club-list panel-inset">
          {clubList.map((c) => (
            <button
              key={c.id}
              className={`club-tile${c.id === clubId ? ' selected' : ''}`}
              onClick={() => setClubId(c.id)}
            >
              <div>{c.name}</div>
              <div style={{ fontSize: 13 }}>
                <RepStars reputation={c.reputation} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-title">{selected.name.toUpperCase()}</div>
          <div className="grid-2">
            <div>
              <p>Division: {selected.division === 'CH' ? 'Championship' : 'Premier League'}</p>
              <p>Ground: {selected.ground}</p>
              <p>Capacity: {totalCapacity(selected).toLocaleString('en-GB')}</p>
              <p>Reputation: <RepStars reputation={selected.reputation} /></p>
            </div>
            <div>
              <p>Starting transfer budget: {formatMoney(selected.startingBudget)}</p>
              <p>Bank balance: {formatMoney(selected.bankBalance)}</p>
              <p>Ticket price: £{selected.ticketPrice}</p>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">MANAGER DETAILS</div>
        <div className="field-row">
          <label htmlFor="manager-name">Manager name</label>
          <input
            id="manager-name"
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="e.g. A. Wenger"
          />
        </div>
        <button className="btn btn-primary" disabled={!clubId || !managerName.trim()} onClick={start}>
          Begin Season
        </button>
      </div>
    </div>
  )
}
