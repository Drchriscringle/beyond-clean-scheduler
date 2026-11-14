import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { formatPounds, planVisitValue } from '../../../supabase/functions/_shared/pricing.js'
import { allJobs, todayUK } from '../../../supabase/functions/_shared/schedule.js'
import { CLEAN_TYPES, labelFor } from '../../lib/options.js'

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`]
}
function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
const hoursBetween = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 36e5) : 0)

/** Income, wages and profit for a month, by cleaner and by type of clean. */
export default function Reports({ data }) {
  const [ym, setYm] = useState(todayUK().slice(0, 7))
  const [from, to] = monthRange(ym)
  const [logs, setLogs] = useState([])
  useEffect(() => { api.listLogs(from, to).then(setLogs).catch(() => {}) }, [from, to])

  const r = useMemo(() => {
    const jobs = allJobs(data, from, to).filter((j) => !j.skipped && !j.paused && !(j.type === 'oneoff' && j.status === 'cancelled'))
    const wage = (id) => data.cleaners.find((c) => c.id === id)?.hourly_wage_pence || 0
    const rows = jobs.map((j) => {
      const log = logs.find((l) => l.job_key === j.key)
      const worked = log?.clock_out ? hoursBetween(log.clock_in, log.clock_out) : j.hours || 0
      const value = j.type === 'plan' ? planVisitValue(j.plan) + (j.extras || []).reduce((s, e) => s + (e.amount_pence || 0), 0) : j.enquiry.quote_pence || 0
      const cleanerId = log?.cleaner_id || j.cleanerId
      return { ...j, worked, logged: !!log?.clock_out, value, cleanerId, wagePence: Math.round(worked * wage(cleanerId)), type: j.type, cleanType: j.type === 'plan' ? 'plan' : j.enquiry.clean_type }
    })
    const credits = data.changes.filter((c) => c.kind === 'skip' && c.visit_date >= from && c.visit_date <= to).reduce((s, c) => s + (c.credit_pence || 0), 0)
    const sum = (list, k) => list.reduce((s, x) => s + x[k], 0)
    const group = (key, label) => Object.values(rows.reduce((acc, x) => {
      const k = x[key] || 'none'
      acc[k] = acc[k] || { key: k, label: label(k), jobs: 0, hours: 0, value: 0, wages: 0 }
      acc[k].jobs += 1; acc[k].hours += x.worked; acc[k].value += x.value; acc[k].wages += x.wagePence
      return acc
    }, {})).sort((a, b) => b.value - a.value)
    const income = sum(rows, 'value')
    const wages = sum(rows, 'wagePence')
    return {
      jobs: rows.length, logged: rows.filter((x) => x.logged).length, income, credits, wages,
      profit: income - wages, hours: sum(rows, 'worked'),
      byCleaner: group('cleanerId', (k) => data.cleaners.find((c) => c.id === k)?.name || 'Unassigned'),
      byType: group('cleanType', (k) => (k === 'plan' ? 'Regular plans' : labelFor(CLEAN_TYPES, k))),
      newPlans: data.plans.filter((p) => p.created_at?.slice(0, 10) >= from && p.created_at?.slice(0, 10) <= to && p.status !== 'pending_payment').length,
      enquiries: data.enquiries.filter((e) => e.created_at.slice(0, 10) >= from && e.created_at.slice(0, 10) <= to),
    }
  }, [data, logs, from, to])

  const won = r.enquiries.filter((e) => ['booked', 'completed', 'awaiting_deposit'].includes(e.status)).length
  const monthName = new Date(from + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Previous month">←</button>
        <div className="flex-1 text-center font-extrabold text-lg">{monthName}</div>
        <button className="btn-secondary btn-sm" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Next month">→</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Income from cleans" value={formatPounds(r.income)} />
        <Kpi label="Wages" value={formatPounds(r.wages)} />
        <Kpi label="Profit after wages" value={formatPounds(r.profit)} tone={r.profit >= 0 ? 'text-leaf-600' : 'text-red-700'} />
        <Kpi label="Margin" value={r.income ? `${Math.round((r.profit / r.income) * 100)}%` : '–'} />
        <Kpi label="Cleans" value={r.jobs} />
        <Kpi label="Hours" value={Math.round(r.hours * 10) / 10} />
        <Kpi label="New plans" value={r.newPlans} />
        <Kpi label="Enquiries won" value={`${won} / ${r.enquiries.length}`} />
      </div>
      <p className="text-xs text-slate-500">
        Plan cleans are valued at their share of the monthly price; one-offs at the quoted price. Wages use clocked hours from the cleaner app
        ({r.logged} of {r.jobs} cleans logged) and scheduled hours where a clean wasn't logged. Skip credits this month: {formatPounds(r.credits)}.
        For your accounts, use the payouts in Stripe.
      </p>

      <Table title="By cleaner" rows={r.byCleaner} />
      <Table title="By type of clean" rows={r.byType} />
    </div>
  )
}

function Table({ title, rows }) {
  return (
    <section className="card p-4 overflow-x-auto">
      <h2 className="font-extrabold mb-2">{title}</h2>
      <table className="w-full text-sm whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3">
        <thead><tr className="text-left text-slate-500"><th className="py-1">Name</th><th>Cleans</th><th>Hours</th><th>Income</th><th>Wages</th><th>Profit</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.key} className="border-t border-slate-100">
              <td className="py-1.5 font-bold">{x.label}</td><td>{x.jobs}</td><td>{Math.round(x.hours * 10) / 10}</td>
              <td>{formatPounds(x.value)}</td><td>{formatPounds(x.wages)}</td><td className="font-bold">{formatPounds(x.value - x.wages)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-3 text-slate-500">No cleans this month.</td></tr>}
        </tbody>
      </table>
    </section>
  )
}

function Kpi({ label, value, tone = 'text-brand-700' }) {
  return <div className="card p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className={`text-xl font-extrabold ${tone}`}>{value}</div></div>
}

