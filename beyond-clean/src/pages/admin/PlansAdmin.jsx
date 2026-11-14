import { useState } from 'react'
import { api } from '../../lib/api.js'
import { addHours, formatPounds, frequencyLabel, slotLabel } from '../../../supabase/functions/_shared/pricing.js'
import { SUB_STATUS } from '../../lib/options.js'
import { Badge, ErrorNote, accessSummary, formatDate } from '../../components/ui.jsx'

export default function PlansAdmin({ data, onChange }) {
  const { plans, changes, cleaners } = data
  const [show, setShow] = useState('live')
  const [error, setError] = useState('')
  const live = plans.filter((p) => ['active', 'past_due', 'paused'].includes(p.status))
  const active = plans.filter((p) => p.status === 'active')
  const mrr = active.reduce((sum, p) => sum + (p.monthly_pence || 0), 0)
  const hours = active.reduce((sum, p) => sum + p.visits_per_week * p.hours_per_visit, 0)
  const list = show === 'live' ? live : plans
  const requests = changes.filter((c) => c.kind === 'move' && c.status === 'requested')
  const planOf = (id) => plans.find((p) => p.id === id)

  async function run(fn) {
    setError('')
    try { await fn(); onChange() } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Active plans" value={active.length} />
        <Kpi label="Monthly income" value={formatPounds(mrr)} />
        <Kpi label="Hours / week" value={Math.round(hours * 10) / 10} />
      </div>
      <ErrorNote>{error}</ErrorNote>

      {requests.length > 0 && (
        <section className="card p-4 space-y-2 ring-2 ring-amber-300">
          <h2 className="font-extrabold">↔️ Requests to move a clean</h2>
          {requests.map((c) => {
            const p = planOf(c.subscription_id)
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <b>{p?.name}</b>: {formatDate(c.visit_date)} {c.visit_start} → <b>{formatDate(c.new_date)}{c.new_time ? ` ${c.new_time}` : ''}</b>
                  {c.note && <div className="text-sm text-slate-600">“{c.note}”</div>}
                </div>
                <button className="btn-primary btn-sm" onClick={() => run(() => api.updateChange(c.id, { status: 'confirmed' }))}>Confirm</button>
                <button className="btn-danger btn-sm" onClick={() => run(() => api.updateChange(c.id, { status: 'declined' }))}>Can't do it</button>
              </div>
            )
          })}
          <p className="text-xs text-slate-500">The customer is emailed either way.</p>
        </section>
      )}

      <div className="flex gap-1.5">
        {[['live', `Current (${live.length})`], ['all', `All (${plans.length})`]].map(([id, l]) => (
          <button key={id} onClick={() => setShow(id)} className={`btn btn-sm ${show === id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}>{l}</button>
        ))}
      </div>
      {!list.length && <div className="card p-6 text-center text-slate-500">No plans yet. Share the “Cleaning plans” page with customers.</div>}
      <ul className="grid md:grid-cols-2 gap-3">
        {list.map((p) => {
          const st = SUB_STATUS[p.status] || SUB_STATUS.pending_payment
          const skips = changes.filter((c) => c.subscription_id === p.id && c.kind === 'skip').length
          return (
            <li key={p.id} className={`card p-4 space-y-2 ${p.status === 'active' && !p.owner_seen ? 'ring-2 ring-leaf-500' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-lg truncate">{p.name}</div>
                  <div className="text-sm text-slate-500 truncate">{p.address}, {p.postcode}</div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="text-sm"><b>{formatPounds(p.monthly_pence)}/month</b> · {p.hours_per_visit}h {frequencyLabel(p.visits_per_week)} · from {formatDate(p.start_date)}</div>
              <div className="flex flex-wrap gap-1.5">
                {(p.slots || []).map((s) => (
                  <span key={`${s.day}-${s.start}`} className="rounded-lg bg-brand-50 text-brand-700 text-xs font-bold px-2 py-1">{slotLabel(s)}–{addHours(s.start, p.hours_per_visit)}</span>
                ))}
              </div>
              {accessSummary(p.access) && <p className="text-sm text-slate-600">🔑 {accessSummary(p.access)}</p>}
              {p.notes && <p className="text-sm text-slate-600">“{p.notes}”</p>}
              <div className="text-xs text-slate-500">
                Code {p.referral_code || '—'}{p.referred_by_code ? ` · referred by ${p.referred_by_code}` : ''}{p.discount_code ? ` · used ${p.discount_code}` : ''}{skips ? ` · ${skips} skipped` : ''}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">Regular cleaner
                <select className="field !py-1.5 !w-auto" value={p.cleaner_id || ''} onChange={(e) => run(() => api.updatePlan(p.id, { cleaner_id: e.target.value || null }))}>
                  <option value="">Not assigned</option>
                  {cleaners.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <a className="btn-secondary btn-sm" href={`tel:${p.phone}`}>📞 {p.phone}</a>
                <a className="btn-secondary btn-sm" href={`mailto:${p.email}`}>✉️ Email</a>
                {p.stripe_subscription_id && (
                  <a className="btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://dashboard.stripe.com/subscriptions/${p.stripe_subscription_id}`}>Stripe ↗</a>
                )}
                {p.status === 'active' && !p.owner_seen && (
                  <button className="btn-primary btn-sm" onClick={() => run(() => api.updatePlan(p.id, { owner_seen: true }))}>Got it ✓</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500">
        Payments, refunds and cancellations are handled in Stripe; this list updates automatically when they change there.
        Skips, holiday pauses and extras that customers make are credited or charged on their next Stripe bill automatically.
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
