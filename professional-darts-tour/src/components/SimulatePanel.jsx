import { useState } from 'react'
import { currentEvent, eventTime } from '../career/career.js'
import { money } from './common.jsx'

const DAY = 86400000

export default function SimulatePanel({ career, onSimulate }) {
  const [mode, setMode] = useState('play')
  const [date, setDate] = useState('')
  const ev = currentEvent(career)
  if (!ev) return null
  const start = eventTime(ev)
  const end = Date.UTC(career.year, 11, 31)
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  const go = (until) => onSimulate({ until, mode })
  return (
    <div className="card sim-panel">
      <div className="card-label">Simulate ahead</div>
      <div className="seg">
        <button className={`chip small ${mode === 'play' ? 'on' : ''}`} onClick={() => setMode('play')}>Enter my events & auto-sim my matches</button>
        <button className={`chip small ${mode === 'skip' ? 'on' : ''}`} onClick={() => setMode('skip')}>I'm away: skip my events</button>
      </div>
      <div className="btn-row tight">
        <button className="btn small" onClick={() => go(start + 6 * DAY)}>1 week</button>
        <button className="btn small" onClick={() => go(start + 13 * DAY)}>2 weeks</button>
        <button className="btn small" onClick={() => go(start + 30 * DAY)}>1 month</button>
        <button className="btn small" onClick={() => go(end)}>Rest of season</button>
      </div>
      <div className="date-row">
        <input type="date" min={iso(start)} max={iso(end)} value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn small" disabled={!date} onClick={() => go(Date.parse(`${date}T00:00:00Z`))}>Simulate to date</button>
      </div>
    </div>
  )
}

export function SimSummary({ summary, onClose }) {
  if (!summary) return null
  const reason = { season: 'The season has finished.', qschool: 'Q-School registration needs your decision.', premier: 'You have a Premier League invitation to answer.' }[summary.stoppedFor]
  return (
    <div className="card review">
      <div className="card-label">While you were away</div>
      {summary.played.length ? (
        <ul className="plain small-text">{summary.played.map((p, i) => <li key={i}><b>{p.name}</b>: {p.result}{p.prize ? ` (${money(p.prize)})` : ''}</li>)}</ul>
      ) : <p className="small-text">You didn't play in any events.</p>}
      <p className="small-text">Bank balance change: {money(summary.money)}</p>
      {reason && <p className="small-text gold">{reason}</p>}
      <button className="btn small" onClick={onClose}>OK</button>
    </div>
  )
}
