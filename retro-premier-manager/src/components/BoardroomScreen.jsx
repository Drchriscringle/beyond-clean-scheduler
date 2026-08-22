import { useState } from 'react'
import { ConfidenceMeter, Money } from './shared.jsx'
import { confidenceLabel } from '../state/boardroom.js'
import { leaguePositionOf, playerLeagueClubIds } from '../state/gameReducer.js'

const REASONS = [
  { value: 'striker', label: 'We need a new striker' },
  { value: 'defender', label: 'We need defensive reinforcements' },
  { value: 'midfielder', label: 'We need a new midfielder' },
  { value: 'keeper', label: 'We need a new goalkeeper' },
  { value: 'wages', label: 'We need to improve the wage budget' },
  { value: 'general', label: 'General squad strengthening' },
]

export default function BoardroomScreen({ state, dispatch }) {
  const [amount, setAmount] = useState(1_000_000)
  const [reason, setReason] = useState('striker')

  const club = state.clubs[state.playerClubId]
  const clubIds = playerLeagueClubIds(state)
  const position = leaguePositionOf(state.standings, clubIds, state.playerClubId)
  const onTrack = position <= club.objective.targetPosition

  function submit() {
    dispatch({ type: 'REQUEST_BUDGET', payload: { amount: Number(amount), reason } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">BOARDROOM</div>

        <div className="panel-inset" style={{ marginBottom: 10 }}>
          <h3>Season Objective</h3>
          <p>The board expects: <strong>{club.objective.label}</strong></p>
          <p>Current league position: {position} — {onTrack ? 'on track' : 'currently short of the target'}</p>
          {club.objectiveMissedStreak > 0 && (
            <p style={{ color: '#800000', fontWeight: 'bold' }}>
              Warning: {club.objectiveMissedStreak} season(s) running without meeting the objective. One more failure and the board will act.
            </p>
          )}
        </div>

        <div className="grid-2">
          <div className="panel-inset">
            <h3>Chairman's Confidence</h3>
            <ConfidenceMeter value={club.boardConfidence} />
            <p>{confidenceLabel(club.boardConfidence)} ({club.boardConfidence}/100)</p>
            <p>Bank balance: <Money value={club.bankBalance} /></p>
            <p>Current transfer budget: <Money value={club.budget} /></p>
          </div>
          <div className="panel-inset">
            <h3>Request Additional Funds</h3>
            <div className="field-row">
              <label htmlFor="reason">Reason</label>
              <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label htmlFor="amount">Amount (£)</label>
              <input id="amount" type="number" step="100000" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={submit}>
              Put it to the Chairman
            </button>
          </div>
        </div>

        <div className="panel-inset" style={{ marginTop: 10 }}>
          <h3>Meeting Log</h3>
          {state.boardroomLog.length === 0 && <p>No meetings held yet this season.</p>}
          <div className="scrollbox">
            {state.boardroomLog.map((entry, i) => (
              <p key={i}>
                Wk{entry.week} — {entry.message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
