import { useState } from 'react'
import { MATCH_LENGTHS } from '../career/calendar.js'
import { DIFFICULTIES, SKILL_PRESETS } from '../career/difficulty.js'

export default function NewCareer({ onStart }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [avg, setAvg] = useState(42)
  const [difficulty, setDifficulty] = useState('normal')
  const [matchLength, setMatchLength] = useState('quick')

  return (
    <div className="screen new-career">
      <div className="logo big">OCHE TOUR</div>
      <p className="tagline">Throw real darts at your own board. Your virtual opponent throws back. Win a Tour Card, and keep it.</p>
      <div className="card form">
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Carter" maxLength={28} />
        </label>
        <label>
          Nickname (optional)
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. The Flying Scotsman" maxLength={28} />
        </label>
        <label>
          Your standard (3-dart average)
          <div className="preset-row">
            {SKILL_PRESETS.map((p) => (
              <button key={p.label} type="button" className={`chip ${avg === p.avg ? 'on' : ''}`} onClick={() => setAvg(p.avg)}>
                {p.label} ~{p.avg}
              </button>
            ))}
          </div>
          <input type="number" min="15" max="120" value={avg} onChange={(e) => setAvg(Number(e.target.value))} />
          <small>Opponents are scaled to your standard, and it updates as you play.</small>
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {Object.entries(DIFFICULTIES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
          <small>{DIFFICULTIES[difficulty].blurb}</small>
        </label>
        <label>
          Match length
          <select value={matchLength} onChange={(e) => setMatchLength(e.target.value)}>
            {Object.entries(MATCH_LENGTHS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <button className="btn primary big" onClick={() => onStart({ name: name.trim() || 'Player One', nickname: nickname.trim(), avg, difficulty, matchLength })}>
        Head to Q-School
      </button>
      <details className="card how">
        <summary className="card-label">How the career works</summary>
        <ul className="plain">
          <li><b>January, Q-School:</b> four days of knockout darts. Reach a day's final, or finish top 4 on the Q-School Order of Merit, to win a two-year Tour Card.</li>
          <li><b>No card?</b> You play the Challenge Tour. Finish top 2 on its Order of Merit to earn a card (and a World Championship spot).</li>
          <li><b>With a card</b> you play Players Championships, the Open and European Tour events, and qualify for majors through the two-year Order of Merit.</li>
          <li><b>Keep it:</b> after two years you must be inside the top 64, or it's back to Q-School.</li>
          <li><b>Playing a match:</b> throw your three darts, type in your score, and the virtual player throws their visit. They get sharper the deeper you go and the bigger the event.</li>
        </ul>
      </details>
    </div>
  )
}
