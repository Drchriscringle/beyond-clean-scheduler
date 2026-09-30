import { useState } from 'react'
import { SKILL_PRESETS, suggestedRange } from '../career/difficulty.js'
import DifficultyPicker from './DifficultyPicker.jsx'
import { MATCH_LENGTHS } from '../career/formats.js'
import { NATIONS } from '../career/players.js'

export default function NewCareer({ onStart, onPractice }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [nation, setNation] = useState('ENG')
  const [age, setAge] = useState(25)
  const [avg, setAvg] = useState(52)
  const [difficulty, setDifficulty] = useState({ mode: 'range', fixedAvg: 52, rangeMin: suggestedRange(52)[0], rangeMax: suggestedRange(52)[1] })
  const [rangeTouched, setRangeTouched] = useState(false)
  const pickAvg = (v) => {
    setAvg(v)
    if (!rangeTouched) {
      const [lo, hi] = suggestedRange(v || 50)
      setDifficulty((d) => ({ ...d, rangeMin: lo, rangeMax: hi, fixedAvg: v || d.fixedAvg }))
    }
  }
  const [matchLength, setMatchLength] = useState('quick')

  return (
    <div className="screen new-career">
      <div className="logo big">PROFESSIONAL DARTS TOUR</div>
      <p className="tagline">Throw real darts at your own board. Your virtual opponent throws back. Win your Tour Card at Q-School, and keep it.</p>
      <div className="card form">
        <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Carter" maxLength={28} /></label>
        <label>Nickname (optional)<input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. The Flying Scotsman" maxLength={28} /></label>
        <div className="row-2">
          <label>
            Nation
            <select value={nation} onChange={(e) => setNation(e.target.value)}>
              {Object.entries(NATIONS).sort((a, b) => a[1][0].localeCompare(b[1][0])).map(([code, n]) => <option key={code} value={code}>{n[1]} {n[0]}</option>)}
            </select>
          </label>
          <label>Age<input type="number" min="16" max="70" value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
        </div>
        <small>Nation decides UK or European Q-School and your World Cup team. Aged 16–24 you can also play the Development Tour.</small>
        <label>
          Your standard (3-dart average)
          <div className="preset-row">
            {SKILL_PRESETS.map((p) => <button key={p.label} type="button" className={`chip ${avg === p.avg ? 'on' : ''}`} onClick={() => pickAvg(p.avg)}>{p.label} ~{p.avg}</button>)}
          </div>
          <input type="number" min="15" max="120" value={avg} onChange={(e) => pickAvg(Number(e.target.value))} />
          <small>Used when you auto-sim a match, and updated as you play.</small>
        </label>
        <div>
          <div className="label">Who you play against</div>
          <DifficultyPicker value={difficulty} onChange={(v) => { setRangeTouched(true); setDifficulty(v) }} />
        </div>
        <label>
          Match length
          <select value={matchLength} onChange={(e) => setMatchLength(e.target.value)}>
            {Object.entries(MATCH_LENGTHS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <button className="btn primary big" onClick={() => onStart({ name: name.trim() || 'Player One', nickname: nickname.trim(), nation, age, avg, difficultyMode: difficulty.mode, fixedAvg: difficulty.fixedAvg, rangeMin: difficulty.rangeMin, rangeMax: difficulty.rangeMax, matchLength })}>
        Start career
      </button>
      <button className="btn ghost" onClick={onPractice}>Practice without a career</button>
      <details className="card how">
        <summary className="card-label">How the career works</summary>
        <ul className="plain">
          <li><b>January, Q-School:</b> First Stage (5–7 Jan): reach the last 16 on any day, or top the points list, to reach the Final Stage (8–11 Jan). Both finalists each day win a two-year Tour Card; the rest go to the top of the Q-School Order of Merit.</li>
          <li><b>No card?</b> The Challenge Tour (24 events). Top 2 earn cards, top 3 go to the Worlds. The Q-School Order of Merit is also the reserve list for Players Championships.</li>
          <li><b>With a card:</b> 34 Players Championships, the UK Open, and qualifiers for 15 European Tour events. The majors come from the Orders of Merit, all based on prize money.</li>
          <li><b>Keep it:</b> when your card expires you must be inside the top 64 on the two-year Order of Merit.</li>
          <li><b>Your inbox</b> asks you to confirm each entry, and brings draws, prize money statements, rankings updates, sponsor offers and news.</li>
        </ul>
      </details>
    </div>
  )
}
