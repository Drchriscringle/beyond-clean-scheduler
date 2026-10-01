import { useState } from 'react'
import { KNOCKOUT_LEVELS, knockoutOpponent, koRoundName, loadPub, REGULARS, regular, savePub, startKnockout } from '../pub.js'

// onPlay({ avg, format, opp: {name, nickname}, stage, pub: {kind, id} })
export default function PubMode({ onPlay, onBack }) {
  const [pub, setPub] = useState(loadPub)
  const [legs, setLegs] = useState(2)
  const [editing, setEditing] = useState(false)
  const format = { legs, sets: 0 }
  const play = (r, kind, stage) => onPlay({ avg: r.avg, format: kind === 'knockout' ? { legs: 2, sets: 0 } : format, opp: { name: r.name, nickname: r.nickname }, stage, pub: { kind, id: r.id } })
  const ko = pub.knockout
  const koOpp = knockoutOpponent(ko)

  return (
    <div className="tab-body pub">
      <button className="btn ghost small back" onClick={onBack}>‹ Practice</button>
      <div className="card pub-sign">
        {editing ? (
          <input autoFocus value={pub.pubName} maxLength={28} onChange={(e) => setPub({ ...pub, pubName: e.target.value })} onBlur={() => { savePub(pub); setEditing(false) }} />
        ) : (
          <h2 onClick={() => setEditing(true)} title="Rename your local">🍺 {pub.pubName}</h2>
        )}
        <p className="small-text muted">Your local. Tap the name to rename it. Beat the regulars one by one, or enter the pub knockout. Nothing here counts towards your career.</p>
        <div className="stats-grid">
          <div><b>{pub.wins}–{pub.losses}</b><span>Won–lost down the pub</span></div>
          <div><b>{pub.knockoutTitles}</b><span>Pub knockout titles</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-label">Pub knockout</div>
        {!ko || ko.champion ? (
          <>
            {ko?.champion && <p>{ko.champion === 'you' ? <b className="gold">🏆 You won the last pub knockout!</b> : <>Last knockout won by <b>{regular(ko.champion).name}</b>.</>}</p>}
            <p className="small-text muted">Eight players, first to 2 legs, winner takes the meat raffle.</p>
            <div className="btn-row tight">
              {Object.entries(KNOCKOUT_LEVELS).map(([k, l]) => <button key={k} className="btn small" onClick={() => setPub(startKnockout(k))}>{l.label}</button>)}
            </div>
          </>
        ) : (
          <>
            <p className="small-text">{KNOCKOUT_LEVELS[ko.level].label} knockout · {koRoundName(ko.round)}</p>
            <ul className="plain small-text">{ko.log.map((m, i) => <li key={i}>{koRoundName(m.round)}: {m.won ? 'beat' : 'lost to'} {regular(m.opponent).name} {m.score[0]}–{m.score[1]}</li>)}</ul>
            {koOpp && (
              <div className="pub-next">
                <b>{regular(koOpp).name}</b> “{regular(koOpp).nickname}” · plays around {regular(koOpp).avg}
                <button className="btn primary" onClick={() => play(regular(koOpp), 'knockout', `${pub.pubName} knockout, ${koRoundName(ko.round).toLowerCase()}`)}>Play</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-label">The regulars ladder</div>
        <div className="legs-pick small-text">Matches: first to
          {[1, 2, 3, 5].map((n) => <button key={n} className={`chip small ${legs === n ? 'on' : ''}`} onClick={() => setLegs(n)}>{n}</button>)} legs
        </div>
        <ul className="ladder">
          {REGULARS.map((r, i) => {
            const beaten = i < pub.ladder
            const next = i === pub.ladder
            return (
              <li key={r.id} className={beaten ? 'beaten' : next ? 'next' : 'locked'}>
                <div>
                  <b>{beaten ? '✓ ' : next ? '' : '🔒 '}{r.name}</b> <span className="muted">“{r.nickname}” · ~{r.avg}</span>
                  <div className="small-text muted">{r.line}</div>
                </div>
                {(beaten || next) && <button className={`btn small ${next ? 'primary' : ''}`} onClick={() => play(r, 'ladder', `${pub.pubName}: ${next ? 'ladder challenge' : 'rematch'}`)}>{next ? 'Challenge' : 'Rematch'}</button>}
              </li>
            )
          })}
        </ul>
        {pub.ladder >= REGULARS.length && <p className="gold">You've beaten every regular. Time for the Tour!</p>}
      </div>
    </div>
  )
}
