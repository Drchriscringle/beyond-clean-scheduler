import { useState } from 'react'
import { DIFFICULTY_MODES, LEVEL_BANDS, SKILL_PRESETS } from '../career/difficulty.js'
import { MATCH_LENGTHS } from '../career/formats.js'
import { NATIONS } from '../career/players.js'

export default function NewCareer({ onStart, onPractice }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [nation, setNation] = useState('ENG')
  const [age, setAge] = useState(25)
  const [avg, setAvg] = useState(52)
  const [difficultyMode, setMode] = useState('progressive')
  const [fixedAvg, setFixedAvg] = useState(55)
  const [matchLength, setMatchLength] = useState('quick')

  return (
    <div className="screen new-career">
      <div className="logo big">OCHE TOUR</div>
      <p className="tagline">Throw real darts at your own board. Your virtual opponent throws back. Win a Tour Card at Q-School, and keep it.</p>
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
            {SKILL_PRESETS.map((p) => <button key={p.label} type="button" className={`chip ${avg === p.avg ? 'on' : ''}`} onClick={() => setAvg(p.avg)}>{p.label} ~{p.avg}</button>)}
          </div>
          <input type="number" min="15" max="120" value={avg} onChange={(e) => setAvg(Number(e.target.value))} />
          <small>Used when you auto-sim a match, and updated as you play.</small>
        </label>
        <div>
          <div className="label">Opponents</div>
          {Object.entries(DIFFICULTY_MODES).map(([k, label]) => (
            <label key={k} className="check"><input type="radio" name="dm" checked={difficultyMode === k} onChange={() => setMode(k)} /> {label}</label>
          ))}
          {difficultyMode === 'fixed' ? (
            <label>Opponent average: <b>{fixedAvg}</b><input type="range" min="20" max="110" value={fixedAvg} onChange={(e) => setFixedAvg(Number(e.target.value))} /></label>
          ) : (
            <small>Challenge Tour and Q-School opponents throw {LEVEL_BANDS.dev.early.join('–')} early on, rising to {LEVEL_BANDS.dev.late.join('–')} in the semis and final. The Pro Tour, majors and the Worlds are tougher again.</small>
          )}
        </div>
        <label>
          Match length
          <select value={matchLength} onChange={(e) => setMatchLength(e.target.value)}>
            {Object.entries(MATCH_LENGTHS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <button className="btn primary big" onClick={() => onStart({ name: name.trim() || 'Player One', nickname: nickname.trim(), nation, age, avg, difficultyMode, fixedAvg, matchLength })}>
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
