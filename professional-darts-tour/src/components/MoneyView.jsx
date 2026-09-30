import { marketValue, SLOTS } from '../career/finance.js'
import { money } from './common.jsx'

export default function MoneyView({ career, onAction }) {
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
        <div className="card-label">Your market value</div>
        <p>A main shirt deal is worth about <b>{money(marketValue(career))}</b> a month to you right now ({Object.entries(SLOTS).filter(([k]) => k !== 'shirt').map(([k, sl]) => `${sl.label.toLowerCase()} ~${money(marketValue(career) * SLOTS[k].factor)}`).join(', ')}). It rises as you climb the Order of Merit and win titles, and sponsors come to you with better offers.</p>
      </div>
      {Object.values(career.offers).length > 0 && (
        <div className="card">
          <div className="card-label">Offers on the table</div>
          {Object.values(career.offers).map((o) => {
            const mail = career.inbox.find((m) => m.key?.startsWith(`offer-${o.id}-`) && !m.resolved)
            return (
              <div key={o.id} className="offer">
                <p><b>{o.brand}</b> · {SLOTS[o.slot].label}: {money(o.monthly)}/month for {o.months} months, {money(o.titleBonus)} per title</p>
                {mail && <div className="btn-row tight">{mail.actions.map((a, i) => <button key={a.label} className={`btn small ${i === 0 ? 'primary' : ''}`} onClick={() => onAction(mail.id, a.action, a.payload)}>{a.label}</button>)}</div>}
              </div>
            )
          })}
        </div>
      )}
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
