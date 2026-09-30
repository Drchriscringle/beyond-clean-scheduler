import { useState } from 'react'
import { COMPETITIONS } from '../career/data/competitions.js'
import { MONTHS } from '../career/career.js'
import { eligibility } from '../career/entry.js'
import { formatLabel, prizeFund, roundFormat } from '../career/formats.js'
import { dateLabel, KEY_LABELS, money, playerLabel } from './common.jsx'
import { eventStatus } from './Hub.jsx'

const KIND_CLASS = { 'Q-School': 'k-qs', 'Challenge Tour': 'k-ct', 'Development Tour': 'k-dt', 'Players Championship': 'k-pc', 'European Tour': 'k-et', Major: 'k-major', 'World Championship': 'k-major', 'Premier League': 'k-pl', 'World Cup': 'k-major', 'World Series': 'k-ws' }

export default function CalendarView({ career, onEntry }) {
  const current = career.calendar[career.eventIndex]
  const [month, setMonth] = useState(current?.month ?? 1)
  const [selected, setSelected] = useState(null)
  const [mineOnly, setMineOnly] = useState(false)
  const y = career.year
  const events = career.calendar.filter((e) => e.month === month)
  const shown = mineOnly ? events.filter((e) => ['in', 'pending', 'done'].includes(eventStatus(career, e).kind)) : events
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay()
  const offset = (first + 6) % 7
  const days = new Date(Date.UTC(y, month, 0)).getUTCDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const sel = selected && career.calendar.find((e) => e.id === selected)

  return (
    <div className="tab-body">
      <div className="month-nav">
        <button className="btn small ghost" onClick={() => setMonth((m) => Math.max(1, m - 1))} disabled={month === 1}>‹</button>
        <b>{MONTHS[month - 1]} {y}</b>
        <button className="btn small ghost" onClick={() => setMonth((m) => Math.min(12, m + 1))} disabled={month === 12}>›</button>
      </div>
      <div className="cal-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          const evs = d ? events.filter((e) => e.day === d) : []
          const mine = evs.some((e) => ['in', 'pending', 'done'].includes(eventStatus(career, e).kind))
          return (
            <div key={i} className={`cal-cell ${d ? '' : 'empty'} ${mine ? 'mine' : ''}`} onClick={() => evs[0] && setSelected(evs[0].id)}>
              {d && <span className="cal-day">{d}</span>}
              <div className="cal-dots">{evs.slice(0, 3).map((e) => <i key={e.id} className={KIND_CLASS[KEY_LABELS[e.key]]} />)}</div>
            </div>
          )
        })}
      </div>
      <label className="check small-text"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Only events I'm in or can enter</label>

      {sel && <EventDetail career={career} e={sel} onEntry={onEntry} onClose={() => setSelected(null)} />}

      <ul className="calendar">
        {shown.map((e) => {
          const st = eventStatus(career, e)
          const r = career.results[e.id]
          return (
            <li key={e.id} className={`${e.id === current?.id ? 'current' : ''} tier-${e.tier}`} onClick={() => setSelected(e.id)}>
              <span className="cal-month">{e.day}</span>
              <span className="cal-name"><i className={`kind-dot ${KIND_CLASS[KEY_LABELS[e.key]]}`} />{e.name}{r && !r.user ? <span className="muted small-text"> · {playerLabel(career, r.champion)}</span> : null}</span>
              <span className={`tag ${st.kind}`}>{st.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EventDetail({ career, e, onEntry, onClose }) {
  const comp = COMPETITIONS[e.key]
  const past = career.calendar.indexOf(e) < career.eventIndex
  const el = !past ? eligibility(career, e) : null
  const state = career.entries[e.id]
  const canEnter = !past && el && (el.status === 'in' || el.status === 'qualifier') && !el.auto && career.active?.eventId !== e.id
  const fund = prizeFund(e.key)
  return (
    <div className="card event-detail">
      <button className="btn ghost small close" onClick={onClose}>✕</button>
      <div className="card-label">{dateLabel(e)} · {KEY_LABELS[e.key]}</div>
      <h2>{e.name}</h2>
      <div className="event-meta">{e.venue ?? ''}</div>
      {fund > 0 && <div className="event-meta">Prize fund {money(fund)} · Winner {money(comp.prizes[0])}</div>}
      <div className="event-meta">{formatLabel(roundFormat(e, 0, career.settings.matchLength))} in round one</div>
      <p className="small-text">{comp.blurb}</p>
      {career.results[e.id] && <p><b>Winner:</b> {playerLabel(career, career.results[e.id].champion)}{career.results[e.id].user ? ` · You: ${career.results[e.id].user}` : ''}</p>}
      {el && <p className="small-text"><b>Your entry:</b> {el.reason || (el.status === 'skip' ? 'Not needed' : '—')}</p>}
      {canEnter && (
        <div className="btn-row tight">
          <button className={`btn small ${state === 'confirmed' ? 'primary' : ''}`} onClick={() => onEntry(e.id, 'confirmed')}>{state === 'confirmed' ? '✓ Entered' : 'Confirm entry'}</button>
          <button className={`btn small ${state === 'withdrawn' ? 'danger' : ''}`} onClick={() => onEntry(e.id, 'withdrawn')}>{state === 'withdrawn' ? 'Withdrawn' : 'Withdraw'}</button>
        </div>
      )}
    </div>
  )
}
