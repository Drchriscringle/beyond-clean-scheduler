import { useState } from 'react'
import { playerLabel } from './common.jsx'
import { profileLabel, profileOf } from '../career/media.js'

// Post-match press conference. onAnswer(key) returns { profile, text }.
export default function PressConference({ career, onAnswer }) {
  const p = career.pressPending
  const [outcome, setOutcome] = useState(null)
  if (!p && !outcome) return null
  if (outcome) {
    return (
      <div className="modal-back">
        <div className="modal press">
          <div className="card-label">Press conference</div>
          <p>{outcome.text}</p>
          <p className="muted small-text">Profile: {profileOf(career)} · {profileLabel(profileOf(career))}. A bigger profile means better sponsor offers.</p>
          <button className="btn primary" onClick={() => setOutcome(null)}>Done</button>
        </div>
      </div>
    )
  }
  return (
    <div className="modal-back">
      <div className="modal press">
        <div className="card-label">🎙️ Press conference · {p.event}</div>
        <p className="muted small-text">{p.won ? 'Win' : 'Defeat'} v {playerLabel(career, p.opponent)} · {p.stage}</p>
        <h3 className="press-q">“{p.question}”</h3>
        <div className="press-answers">
          {p.answers.map((a) => (
            <button key={a.key} className={`btn press-a ${a.key}`} onClick={() => setOutcome(onAnswer(a.key))}>
              <b>{a.label}</b>
              <span>“{a.text}”</span>
            </button>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => setOutcome(onAnswer('skip'))}>No comment (walk out)</button>
      </div>
    </div>
  )
}
