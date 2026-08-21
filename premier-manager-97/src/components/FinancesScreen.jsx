import { Money } from './shared.jsx'
import { formatMoneyFull } from '../utils/format.js'
import { squadValue, stadiumValue } from '../state/finance.js'

export default function FinancesScreen({ state }) {
  const club = state.clubs[state.playerClubId]
  const squad = state.squads[state.playerClubId]
  const ledger = club.ledger

  const seasonLedger = ledger.filter((e) => e.season === state.season)
  const totals = seasonLedger.reduce(
    (acc, e) => {
      acc.matchday += e.income.matchday
      acc.tv += e.income.tv
      acc.sponsorship += e.income.sponsorship
      acc.wages += e.expenditure.wages
      acc.staff += e.expenditure.staff
      acc.maintenance += e.expenditure.maintenance
      acc.construction += e.expenditure.construction
      acc.interest += e.expenditure.interest ?? 0
      acc.net += e.net
      return acc
    },
    { matchday: 0, tv: 0, sponsorship: 0, wages: 0, staff: 0, maintenance: 0, construction: 0, interest: 0, net: 0 },
  )

  const chartData = [...ledger].slice(0, 12).reverse()
  const maxAbs = Math.max(1, ...chartData.map((e) => Math.abs(e.balance)))

  const sqValue = squadValue(squad)
  const stValue = stadiumValue(club)
  const debt = club.bankBalance < 0 ? Math.abs(club.bankBalance) : 0

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">CLUB FINANCES — {club.name.toUpperCase()}</div>
        <p>
          Bank balance: <Money value={club.bankBalance} /> &nbsp; Transfer budget: <Money value={club.budget} />
        </p>

        <div className="grid-2">
          <div className="panel-inset">
            <h3>Season {state.season}/{String(state.season + 1).slice(2)} P&amp;L</h3>
            <table className="pm-table">
              <tbody>
                <tr>
                  <td>Matchday income</td>
                  <td>{formatMoneyFull(totals.matchday)}</td>
                </tr>
                <tr>
                  <td>TV / broadcast</td>
                  <td>{formatMoneyFull(totals.tv)}</td>
                </tr>
                <tr>
                  <td>Sponsorship</td>
                  <td>{formatMoneyFull(totals.sponsorship)}</td>
                </tr>
                <tr>
                  <td>Player wages</td>
                  <td>-{formatMoneyFull(totals.wages)}</td>
                </tr>
                <tr>
                  <td>Staff wages</td>
                  <td>-{formatMoneyFull(totals.staff)}</td>
                </tr>
                <tr>
                  <td>Stadium maintenance</td>
                  <td>-{formatMoneyFull(totals.maintenance)}</td>
                </tr>
                <tr>
                  <td>Construction</td>
                  <td>-{formatMoneyFull(totals.construction)}</td>
                </tr>
                <tr>
                  <td>Loan interest</td>
                  <td>-{formatMoneyFull(totals.interest)}</td>
                </tr>
                <tr>
                  <td><strong>Net</strong></td>
                  <td><Money value={totals.net} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel-inset">
            <h3>Balance Sheet</h3>
            <table className="pm-table">
              <tbody>
                <tr>
                  <td>Squad value (est.)</td>
                  <td>{formatMoneyFull(sqValue)}</td>
                </tr>
                <tr>
                  <td>Stadium value (est.)</td>
                  <td>{formatMoneyFull(stValue)}</td>
                </tr>
                <tr>
                  <td>Bank balance</td>
                  <td>{formatMoneyFull(club.bankBalance)}</td>
                </tr>
                <tr>
                  <td>Debt</td>
                  <td>{debt > 0 ? `-${formatMoneyFull(debt)}` : formatMoneyFull(0)}</td>
                </tr>
                <tr>
                  <td><strong>Net worth</strong></td>
                  <td>{formatMoneyFull(sqValue + stValue + Math.min(0, club.bankBalance))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-inset" style={{ marginTop: 10 }}>
          <h3>Balance Trend (last {chartData.length} weeks)</h3>
          <div className="bar-chart">
            {chartData.map((e, i) => (
              <div
                key={i}
                className={`bar-chart-col${e.balance < 0 ? ' negative' : ''}`}
                style={{ height: `${Math.max(4, (Math.abs(e.balance) / maxAbs) * 100)}%` }}
                title={`Wk${e.week}: ${formatMoneyFull(e.balance)}`}
              />
            ))}
          </div>
        </div>

        <div className="panel-inset" style={{ marginTop: 10 }}>
          <h3>Weekly Ledger</h3>
          <div className="scrollbox">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Wk</th>
                  <th>Matchday</th>
                  <th>TV</th>
                  <th>Sponsor</th>
                  <th>Wages</th>
                  <th>Staff</th>
                  <th>Maint.</th>
                  <th>Constr.</th>
                  <th>Net</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => (
                  <tr key={i}>
                    <td>{e.week}</td>
                    <td>{formatMoneyFull(e.income.matchday)}</td>
                    <td>{formatMoneyFull(e.income.tv)}</td>
                    <td>{formatMoneyFull(e.income.sponsorship)}</td>
                    <td>-{formatMoneyFull(e.expenditure.wages)}</td>
                    <td>-{formatMoneyFull(e.expenditure.staff)}</td>
                    <td>-{formatMoneyFull(e.expenditure.maintenance)}</td>
                    <td>-{formatMoneyFull(e.expenditure.construction)}</td>
                    <td><Money value={e.net} /></td>
                    <td>{formatMoneyFull(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
