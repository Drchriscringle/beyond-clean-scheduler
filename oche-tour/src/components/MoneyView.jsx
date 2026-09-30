import { money } from './common.jsx'

export default function MoneyView({ career }) {
  const f = career.finance
  const y = career.year
  const e = career.players.user.earn[y] ?? {}
  return (
    <div className="tab-body">
      <div className="card">
        <div className="stats-grid">
          <div><b>{money(f.bank)}</b><span>Bank balance</span></div>
          <div><b>{money(e.total)}</b><span>Prize money {y}</span></div>
          <div><b>{money(e.ranked)}</b><span>Ranking prize money {y}</span></div>
          <div><b>{money(career.sponsors.reduce((s, x) => s + x.monthly, 0))}</b><span>Sponsorship per month</span></div>
        </div>
        {f.bank < 0 && <p className="error">You're overdrawn: prize money and sponsors will clear it.</p>}
      </div>
      <div className="card">
        <div className="card-label">Sponsors</div>
        {career.sponsors.length ? (
          <ul className="plain">{career.sponsors.map((s) => <li key={s.slot}><b>{s.brand}</b> ({s.slot}): {money(s.monthly)}/month, {money(s.titleBonus)} per title, {s.monthsLeft} months left</li>)}</ul>
        ) : <p className="muted">No sponsors yet. Win your Tour Card, win titles and climb the rankings and offers will arrive in your inbox.</p>}
      </div>
      <div className="card">
        <div className="card-label">Statement</div>
        <table className="rank-table"><tbody>
          {f.ledger.slice(0, 80).map((l, i) => <tr key={i}><td className="muted small-text">{l.date}</td><td>{l.text}</td><td className={`num ${l.amount < 0 ? 'neg' : 'pos'}`}>{money(l.amount)}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}
