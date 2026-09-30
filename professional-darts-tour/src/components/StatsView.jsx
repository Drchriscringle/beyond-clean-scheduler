import { threeDartAverage } from '../engine/match.js'
import { money, playerLabel } from './common.jsx'

export default function StatsView({ career }) {
  const s = career.stats
  const user = career.players.user
  const avg = threeDartAverage(s)
  const items = [
    ['Matches won', `${s.won} / ${s.played + s.simulated}`],
    ['Played on the oche', s.played],
    ['Career average', avg ? avg.toFixed(2) : '–'],
    ['Best match average', s.bestAvg || '–'],
    ['180s', s.s180],
    ['140+', s.s140],
    ['100+', s.s100],
    ['Highest checkout', s.highCheckout || '–'],
    ['Checkout %', s.dartsAtDouble ? `${((s.trackedCheckouts / s.dartsAtDouble) * 100).toFixed(1)}%` : '–'],
    ['Legs', `${s.legsWon} won · ${s.legsLost} lost`],
    ['Nine-darters', s.nineDarters],
    ['Career prize money', money(Object.values(user.earn).reduce((t, e) => t + (e.total ?? 0), 0))],
  ]
  const doubles = Object.entries(s.doubles).sort((a, b) => b[1] - a[1])
  const maxD = doubles[0]?.[1] ?? 1
  const h2h = Object.entries(career.h2h).sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l)).slice(0, 10)
  const rivals = h2h.filter(([, r]) => r.w + r.l >= 3 && Math.abs(r.w - r.l) <= 1)

  return (
    <div className="tab-body">
      <div className="card"><div className="stats-grid">{items.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div></div>
      <div className="card">
        <div className="card-label">Favourite doubles (checkouts)</div>
        {doubles.length ? doubles.map(([d, n]) => (
          <div key={d} className="bar-row"><span>{d === 'DB' ? 'Bull' : d}</span><div className="bar"><i style={{ width: `${(n / maxD) * 100}%` }} /></div><span>{n}</span></div>
        )) : <p className="muted">Tell the app which double you finish on after each checkout and it builds up here.</p>}
      </div>
      <div className="card">
        <div className="card-label">Rivals & head to head</div>
        {rivals.length > 0 && <p className="small-text">Rivalries: {rivals.map(([id]) => career.players[id]?.name).join(', ')}</p>}
        {h2h.length ? (
          <table className="rank-table"><tbody>
            {h2h.map(([id, r]) => <tr key={id}><td>{playerLabel(career, id)}</td><td className="num">{r.w}–{r.l}</td><td className="muted small-text">{r.meetings[0]?.event}</td></tr>)}
          </tbody></table>
        ) : <p className="muted">No matches yet.</p>}
      </div>
      <div className="card">
        <div className="card-label">Titles</div>
        {user.titles.length ? <ul className="plain">{user.titles.map((t, i) => <li key={i}>🏆 {t}</li>)}</ul> : <p className="muted">None yet.</p>}
      </div>
      {career.seasons.length > 0 && (
        <div className="card">
          <div className="card-label">Seasons</div>
          <ul className="plain">{career.seasons.map((x) => <li key={x.year}><b>{x.year}</b> · {x.outcome} · {money(x.money)}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
