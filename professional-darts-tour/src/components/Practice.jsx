import { useState } from 'react'
import { checkoutRoute } from '../engine/checkout.js'
import PubMode from './PubMode.jsx'
import { loadPub } from '../pub.js'

const KEY = 'pdt-practice-v1'

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function saveRecord(name, value, better) {
  const r = loadRecords()
  if (r[name] === undefined || better(value, r[name])) {
    r[name] = value
    try { localStorage.setItem(KEY, JSON.stringify(r)) } catch { /* ignore */ }
    return true
  }
  return false
}

export default function Practice({ onPlay, initialMode = null }) {
  const [mode, setMode] = useState(initialMode)
  const records = loadRecords()
  if (mode === 'bobs') return <Bobs27 onBack={() => setMode(null)} />
  if (mode === 'atc') return <RoundTheClock onBack={() => setMode(null)} />
  if (mode === '121') return <Checkout121 onBack={() => setMode(null)} />
  if (mode === 'friendly') return <FriendlySetup onPlay={onPlay} onBack={() => setMode(null)} />
  if (mode === 'pub') return <PubMode onPlay={onPlay} onBack={() => setMode(null)} />
  const games = [
    ['pub', 'Down the Pub 🍺', 'Your local: beat the regulars on the ladder one by one, or enter the pub knockout. Averages from 25 to 64.', loadPub().ladder ? `Ladder: ${loadPub().ladder}/10` : null],
    ['friendly', 'Friendly match', 'Play 501 against a virtual opponent at any average. Nothing counts towards your career.', null],
    ['bobs', "Bob's 27", 'Three darts at each double from 1 to bull. Hit to add, miss them all to lose the double. Start on 27.', records.bobs27 !== undefined ? `Best: ${records.bobs27}` : null],
    ['atc', 'Round the Clock (doubles)', 'Double 1 to double 20, then the bull, in as few darts as possible.', records.atc !== undefined ? `Best: ${records.atc} darts` : null],
    ['121', '121 Checkout', 'Nine darts to check out 121. Succeed and the target goes up one; fail and it comes down.', records.t121 !== undefined ? `Highest: ${records.t121}` : null],
  ]
  return (
    <div className="tab-body">
      {games.map(([k, name, blurb, rec]) => (
        <button key={k} className="card practice-card" onClick={() => setMode(k)}>
          <b>{name}</b>
          <span className="small-text muted">{blurb}</span>
          {rec && <span className="tag done">{rec}</span>}
        </button>
      ))}
    </div>
  )
}

function FriendlySetup({ onPlay, onBack }) {
  const [avg, setAvg] = useState(60)
  const [legs, setLegs] = useState(3)
  const [doubleIn, setDoubleIn] = useState(false)
  return (
    <div className="tab-body">
      <button className="btn ghost small back" onClick={onBack}>‹ Practice</button>
      <div className="card form">
        <label>Opponent average: <b>{avg}</b><input type="range" min="20" max="110" value={avg} onChange={(e) => setAvg(Number(e.target.value))} /></label>
        <label>First to <b>{legs}</b> legs<input type="range" min="1" max="11" value={legs} onChange={(e) => setLegs(Number(e.target.value))} /></label>
        <label className="check"><input type="checkbox" checked={doubleIn} onChange={(e) => setDoubleIn(e.target.checked)} /> Double in (World Grand Prix rules)</label>
        <button className="btn primary big" onClick={() => onPlay({ avg, format: { legs, sets: 0, doubleIn } })}>Game on</button>
      </div>
    </div>
  )
}

function HitPad({ onHit, max = 3, labels }) {
  return (
    <div className="btn-row">
      {Array.from({ length: max + 1 }, (_, n) => <button key={n} className="btn big-num" onClick={() => onHit(n)}>{labels?.[n] ?? n}</button>)}
    </div>
  )
}

function Bobs27({ onBack }) {
  const targets = [...Array.from({ length: 20 }, (_, i) => i + 1), 25]
  const [i, setI] = useState(0)
  const [score, setScore] = useState(27)
  const [log, setLog] = useState([])
  const over = score <= 0 || i >= targets.length
  const n = targets[Math.min(i, targets.length - 1)]
  const value = n === 25 ? 50 : n * 2
  const [best, setBest] = useState(false)
  function hit(h) {
    const next = score + (h ? h * value : -value)
    setLog([`${n === 25 ? 'Bull' : `D${n}`}: ${h ? `+${h * value}` : `−${value}`}`, ...log])
    setScore(next)
    setI(i + 1)
    if (next <= 0 || i + 1 >= targets.length) setBest(saveRecord('bobs27', Math.max(0, next), (a, b) => a > b))
  }
  return (
    <div className="tab-body">
      <button className="btn ghost small back" onClick={onBack}>‹ Practice</button>
      <div className="card drill">
        <div className="card-label">Bob's 27</div>
        <div className="drill-score">{score}</div>
        {over ? <p>{score <= 0 ? 'Bust! Game over.' : `Finished on ${score}!`} {best && <b className="gold">New personal best.</b>}</p> : <p>Aim at <b>{n === 25 ? 'the bull' : `double ${n}`}</b>. How many did you hit?</p>}
        {!over && <HitPad onHit={hit} />}
        {over && <button className="btn primary" onClick={() => { setI(0); setScore(27); setLog([]); setBest(false) }}>Play again</button>}
        <p className="small-text muted">{log.slice(0, 6).join(' · ')}</p>
      </div>
    </div>
  )
}

function RoundTheClock({ onBack }) {
  const targets = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'Bull']
  const [i, setI] = useState(0)
  const [darts, setDarts] = useState(0)
  const [best, setBest] = useState(false)
  const done = i >= targets.length
  function hit(n) {
    const next = Math.min(targets.length, i + n)
    const used = next === targets.length && n > 0 ? darts + n : darts + 3
    setDarts(used)
    setI(next)
    if (next === targets.length) setBest(saveRecord('atc', used, (a, b) => a < b))
  }
  return (
    <div className="tab-body">
      <button className="btn ghost small back" onClick={onBack}>‹ Practice</button>
      <div className="card drill">
        <div className="card-label">Round the Clock: doubles</div>
        <div className="drill-score">{done ? 'Done' : targets[i]}</div>
        <p>{darts} darts thrown{done ? '' : `. How many targets did you hit in order this visit?`}</p>
        {done ? <>{best && <p className="gold">New personal best!</p>}<button className="btn primary" onClick={() => { setI(0); setDarts(0); setBest(false) }}>Play again</button></> : <HitPad onHit={hit} />}
      </div>
    </div>
  )
}

function Checkout121({ onBack }) {
  const [target, setTarget] = useState(121)
  const [high, setHigh] = useState(121)
  const [attempts, setAttempts] = useState(0)
  const route = checkoutRoute(target)
  function result(ok) {
    setAttempts(attempts + 1)
    const next = ok ? target + 1 : Math.max(121, target - 1)
    if (ok && target > 170) return
    setTarget(Math.min(170, next))
    if (ok) {
      setHigh(Math.max(high, target))
      saveRecord('t121', target, (a, b) => a > b)
    }
  }
  return (
    <div className="tab-body">
      <button className="btn ghost small back" onClick={onBack}>‹ Practice</button>
      <div className="card drill">
        <div className="card-label">121 Checkout · attempt {attempts + 1}</div>
        <div className="drill-score">{target}</div>
        <p>Nine darts to check out. Suggested: <b>{route?.join(' · ')}</b></p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => result(true)}>Checked out</button>
          <button className="btn" onClick={() => result(false)}>Missed</button>
        </div>
        <p className="small-text muted">Highest this session: {high}</p>
      </div>
    </div>
  )
}
