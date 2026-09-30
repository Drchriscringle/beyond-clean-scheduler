import { useState } from 'react'
import { COMPETITIONS, TV_EVENTS } from '../career/data/competitions.js'
import { threeDartAverage } from '../engine/match.js'
import { money, playerLabel } from './common.jsx'

const MAJOR_ORDER = ['worlds', 'matchplay', 'grandprix', 'ukopen', 'masters', 'eurochamp', 'grandslam', 'pcfinals', 'plPlayoffs', 'worldcup', 'wsfinals']
const label = (key) => (key === 'plPlayoffs' ? 'Premier League' : COMPETITIONS[key]?.name ?? key)

export default function Honours({ career }) {
  const [view, setView] = useState('me')
  return (
    <div className="tab-body">
      <div className="btn-row tight">
        <button className={`btn small ${view === 'me' ? 'primary' : ''}`} onClick={() => setView('me')}>My roll of honour</button>
        <button className={`btn small ${view === 'roll' ? 'primary' : ''}`} onClick={() => setView('roll')}>Competition rolls of honour</button>
      </div>
      {view === 'me' ? <MyHonours career={career} /> : <RollOfHonour career={career} />}
    </div>
  )
}

function Rec({ title, rec, fmt = (v) => v }) {
  return (
    <div className="record">
      <b>{rec ? fmt(rec.value) : '–'}</b>
      <span>{title}</span>
      {rec && <small className="muted">{rec.event} {rec.year}</small>}
    </div>
  )
}

function MyHonours({ career }) {
  const user = career.players.user
  const s = career.stats
  const r = career.records ?? { bestIn: {} }
  const titles = user.titles
  const majors = career.honours.filter((h) => h.winner === 'user' && (TV_EVENTS.includes(h.key) || h.key === 'worldcup'))
  const earnings = Object.values(user.earn).reduce((t, e) => t + (e.total ?? 0), 0)
  const cardSeasons = career.seasons.filter((x) => x.tour === 'pro').length + (user.tour === 'pro' ? 1 : 0)
  const best = Object.entries(r.bestIn).sort((a, b) => a[1].rank - b[1].rank || a[1].name.localeCompare(b[1].name))
  return (
    <>
      <div className="card">
        <div className="stats-grid">
          <div><b>{titles.length}</b><span>Titles</span></div>
          <div><b>{majors.length}</b><span>TV titles</span></div>
          <div><b>{r.peakRank ? `#${r.peakRank.rank}` : '–'}</b><span>Highest ranking{r.peakRank ? ` (${r.peakRank.date})` : ''}</span></div>
          <div><b>{money(earnings)}</b><span>Career prize money</span></div>
          <div><b>{cardSeasons}</b><span>Seasons with a Tour Card</span></div>
          <div><b>{s.won}</b><span>Matches won</span></div>
        </div>
      </div>
      <div className="card">
        <div className="card-label">Records (matches played on the oche)</div>
        <div className="records">
          <Rec title="Best match average" rec={r.bestAverage} fmt={(v) => v.toFixed(2)} />
          <Rec title="Lowest leg (darts)" rec={r.lowestLeg} />
          <Rec title="Highest checkout" rec={r.highestCheckout} />
          <Rec title="Most 180s in a match" rec={r.most180s} />
        </div>
        <div className="stats-grid totals">
          <div><b>{s.s180}</b><span>180s</span></div>
          <div><b>{s.s140}</b><span>140+</span></div>
          <div><b>{s.s100}</b><span>100+</span></div>
          <div><b>{s.checkouts}</b><span>Checkouts</span></div>
          <div><b>{threeDartAverage(s) ? threeDartAverage(s).toFixed(2) : '–'}</b><span>Career average</span></div>
          <div><b>{s.nineDarters}</b><span>Nine-darters</span></div>
        </div>
      </div>
      <div className="card">
        <div className="card-label">Best performance in each competition</div>
        {best.length ? (
          <table className="rank-table"><tbody>
            {best.map(([k, b]) => (
              <tr key={k} className={b.rank === 0 ? 'me' : ''}>
                <td>{b.name}</td>
                <td>{b.rank === 0 ? `🏆 Winner${b.times > 1 ? ` ×${b.times}` : ''}` : b.text}</td>
                <td className="num muted">{b.year}</td>
              </tr>
            ))}
          </tbody></table>
        ) : <p className="muted">Your best finish in every event you play will be recorded here.</p>}
      </div>
      <div className="card">
        <div className="card-label">Titles</div>
        {titles.length ? <ul className="plain">{[...titles].reverse().map((t, i) => <li key={i}>🏆 {t}</li>)}</ul> : <p className="muted">None yet.</p>}
      </div>
      {career.seasons.length > 0 && (
        <div className="card">
          <div className="card-label">Season by season</div>
          <table className="rank-table"><thead><tr><th>Year</th><th>Ranking</th><th>Earnings</th><th>Titles</th></tr></thead><tbody>
            {[...career.seasons].reverse().map((x) => (
              <tr key={x.year}><td>{x.year}</td><td>{x.oomRank && x.tour === 'pro' ? `#${x.oomRank}` : x.ctRank ? `CT #${x.ctRank}` : '–'}</td><td className="num">{money(x.money)}</td><td className="num">{x.titles.length}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </>
  )
}

function RollOfHonour({ career }) {
  const [key, setKey] = useState('worlds')
  const byName = (k) => [...new Set(career.calendar.filter((e) => e.key === k).map((e) => e.name))]
  const matches = (h) => (key.startsWith('name:') ? h.name === key.slice(5) : h.key === key)
  const list = career.honours.filter(matches).slice().reverse()
  const counts = {}
  for (const h of list) counts[h.winner] = (counts[h.winner] ?? 0) + 1
  const leaders = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const many = ['pc', 'ct', 'dt'].includes(key)
  return (
    <>
      <select value={key} onChange={(e) => setKey(e.target.value)}>
        <optgroup label="Majors and televised events">{MAJOR_ORDER.map((k) => <option key={k} value={k}>{label(k)}</option>)}</optgroup>
        <optgroup label="European Tour">{byName('et').map((n) => <option key={n} value={`name:${n}`}>{n}</option>)}</optgroup>
        <optgroup label="World Series">{byName('ws').map((n) => <option key={n} value={`name:${n}`}>{n}</option>)}</optgroup>
        <optgroup label="Tours">{['pc', 'ct', 'dt'].map((k) => <option key={k} value={k}>{COMPETITIONS[k].name} (all events)</option>)}</optgroup>
      </select>
      {leaders.length > 0 && (
        <div className="card">
          <div className="card-label">Most titles</div>
          <ul className="plain">{leaders.map(([id, n]) => <li key={id} className={id === 'user' ? 'gold' : ''}>{playerLabel(career, id)}: {n}</li>)}</ul>
        </div>
      )}
      <div className="card">
        <div className="card-label">Roll of honour</div>
        {list.length ? (
          <table className="rank-table roll"><tbody>
            {list.slice(0, 200).map((h, i) => (
              <tr key={i} className={h.winner === 'user' || h.runnerUp === 'user' ? 'me' : ''}>
                <td className="muted">{h.year}{many ? ` · ${h.name.replace(/^\D+/, '#')}` : ''}</td>
                <td><b>{playerLabel(career, h.winner)}</b><br /><small className="muted">beat {playerLabel(career, h.runnerUp)}{h.score ? ` ${h.score[0]}–${h.score[1]}${h.sets ? ' (sets)' : ''}` : ''}</small></td>
              </tr>
            ))}
          </tbody></table>
        ) : <p className="muted">Not played yet in this career.</p>}
      </div>
    </>
  )
}
