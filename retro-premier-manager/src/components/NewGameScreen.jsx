import { useState } from 'react'
import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, DIVISION_LABELS } from '../data/clubs.js'
import { totalCapacity } from '../data/clubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../data/scottishClubs.js'
import { LA_LIGA_CLUBS } from '../data/laLigaClubs.js'

const DIVISION_CLUB_LISTS = {
  PL: CLUBS,
  CH: CHAMPIONSHIP_CLUBS,
  SPL: SCOTTISH_PREMIERSHIP_CLUBS,
  SCH: SCOTTISH_CHAMPIONSHIP_CLUBS,
  LALIGA: LA_LIGA_CLUBS,
}
import { formatMoney } from '../utils/format.js'
import { RepStars } from './shared.jsx'
import { listSaves, clearSave } from '../state/persistence.js'
import { DIFFICULTIES, difficultyLabel } from '../state/difficulty.js'

export default function NewGameScreen({ dispatch }) {
  const [division, setDivision] = useState('PL')
  const [clubId, setClubId] = useState(null)
  const [managerName, setManagerName] = useState('')
  const [difficulty, setDifficulty] = useState('normal')
  const [saves, setSaves] = useState(() => listSaves())

  const firstEmptySlot = saves.find((s) => !s.data)?.slot ?? saves[0].slot
  const [saveSlot, setSaveSlot] = useState(firstEmptySlot)

  const clubList = DIVISION_CLUB_LISTS[division]
  const selected = CLUB_BY_ID[clubId]

  function chooseDivision(next) {
    setDivision(next)
    setClubId(null)
  }

  function start() {
    if (!clubId || !managerName.trim()) return
    dispatch({ type: 'START_NEW_GAME', payload: { clubId, managerName: managerName.trim(), difficulty, saveSlot } })
  }

  function continueSave(slot, data) {
    dispatch({ type: 'LOAD_GAME', payload: { state: data.state, savedAt: data.savedAt } })
  }

  function deleteSave(slot) {
    clearSave(slot)
    setSaves(listSaves())
  }

  return (
    <div className="screen">
      {saves.some((s) => s.data) && (
        <div className="panel">
          <div className="panel-title">CONTINUE SAVED CAREER</div>
          {saves
            .filter((s) => s.data)
            .map(({ slot, data }) => (
              <div key={slot} className="panel-inset" style={{ marginBottom: 8 }}>
                <p>
                  Slot {slot}: {data.state.managerName} — {CLUB_BY_ID[data.state.playerClubId]?.name ?? 'Unknown club'}
                  &nbsp;· Season {data.state.season}, Week {Math.min(data.state.week, 38)}/38
                </p>
                <p style={{ fontSize: 14 }}>Last saved: {new Date(data.savedAt).toLocaleString()}</p>
                <button className="btn btn-primary btn-small" onClick={() => continueSave(slot, data)}>
                  Continue
                </button>{' '}
                <button className="btn btn-danger btn-small" onClick={() => deleteSave(slot)}>
                  Delete Save
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-title">PREMIER MANAGER '97 — NEW GAME</div>
        <p>Select a club to take charge of for the 2025/26 season.</p>
        <div className="tabs" style={{ marginBottom: 8 }}>
          {Object.keys(DIVISION_CLUB_LISTS).map((d) => (
            <button key={d} className={`tab${division === d ? ' active' : ''}`} onClick={() => chooseDivision(d)}>
              {DIVISION_LABELS[d]}
            </button>
          ))}
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
              <p>Division: {DIVISION_LABELS[selected.division]}</p>
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
        <div className="field-row">
          <label htmlFor="difficulty">Difficulty</label>
          <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {difficultyLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="save-slot">Save to slot</label>
          <select id="save-slot" value={saveSlot} onChange={(e) => setSaveSlot(Number(e.target.value))}>
            {saves.map(({ slot, data }) => (
              <option key={slot} value={slot}>
                Slot {slot}{data ? ' (occupied — will overwrite)' : ' (empty)'}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" disabled={!clubId || !managerName.trim()} onClick={start}>
          Begin Season
        </button>
      </div>
    </div>
  )
}
