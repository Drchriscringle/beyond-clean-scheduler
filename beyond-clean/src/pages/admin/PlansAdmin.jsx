import { useState } from 'react'
import { api } from '../../lib/api.js'
import { addHours, formatPounds, slotLabel } from '../../../supabase/functions/_shared/pricing.js'
import { SUB_STATUS } from '../../lib/options.js'
import { Badge, ErrorNote, formatDate } from '../../components/ui.jsx'

export default function PlansAdmin({ plans, onChange }) {
  const [show, setShow] = useState('live')
  const [error, setError] = useState('')
  const live = plans.filter((p) => ['active', 'past_due', 'paused'].includes(p.status))
  const active = plans.filter((p) => p.status === 'active')
  const mrr = active.reduce((sum, p) => sum + (p.monthly_pence || 0), 0)
  const hours = active.reduce((sum, p) => sum + p.visits_per_week * p.hours_per_visit, 0)
  const list = show === 'live' ? live : plans

  async function patch(p, change) {
    setError('')
    try { await api.updatePlan(p.id, change); onChange() } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Active plans" value={active.length} />
        <Kpi label="Monthly income" value={formatPounds(mrr)} />
        <Kpi label="Hours / week" value={hours} />
      </div>
      <div className="flex gap-1.5">
        {[['live', `Current (${live.length})`], ['all', `All (${plans.length})`]].map(([id, l]) => (
          <button key={id} onClick={() => setShow(id)} className={`btn btn-sm ${show === id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}>{l}</button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!list.length && <div className="card p-6 text-center text-slate-500">No plans yet. Share the “Cleaning plans” page with customers.</div>}
      <ul className="grid md:grid-cols-2 gap-3">
        {list.map((p) => {
          const st = SUB_STATUS[p.status] || SUB_STATUS.pending_payment
          return (
            <li key={p.id} className={`card p-4 space-y-2 ${p.status === 'active' && !p.owner_seen ? 'ring-2 ring-leaf-500' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-lg truncate">{p.name}</div>
                  <div className="text-sm text-slate-500 truncate">{p.address}, {p.postcode}</div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="text-sm"><b>{formatPounds(p.monthly_pence)}/month</b> · {p.visits_per_week}× {p.hours_per_visit}h a week · from {formatDate(p.start_date)}</div>
              <div className="flex flex-wrap gap-1.5">
                {(p.slots || []).map((s) => (
                  <span key={`${s.day}-${s.start}`} className="rounded-lg bg-brand-50 text-brand-700 text-xs font-bold px-2 py-1">{slotLabel(s)}–{addHours(s.start, p.hours_per_visit)}</span>
                ))}
              </div>
              {p.notes && <p className="text-sm text-slate-600">“{p.notes}”</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <a className="btn-secondary btn-sm" href={`tel:${p.phone}`}>📞 {p.phone}</a>
                <a className="btn-secondary btn-sm" href={`mailto:${p.email}`}>✉️ Email</a>
                {p.stripe_subscription_id && (
                  <a className="btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://dashboard.stripe.com/subscriptions/${p.stripe_subscription_id}`}>Stripe ↗</a>
                )}
                {p.status === 'active' && !p.owner_seen && (
                  <button className="btn-primary btn-sm" onClick={() => patch(p, { owner_seen: true })}>Got it ✓</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500">
        Payments, refunds, pauses and cancellations are handled in Stripe; this list updates automatically when they change there.
      </p>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="text-xl sm:text-2xl font-extrabold text-brand-700">{value}</div>
    </div>
  )
}
