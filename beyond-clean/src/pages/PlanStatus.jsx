import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { addHours, formatPounds, slotLabel } from '../../supabase/functions/_shared/pricing.js'
import { SUB_STATUS } from '../lib/options.js'
import { Badge, ErrorNote, Spinner, formatDate } from '../components/ui.jsx'

export default function PlanStatus() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const [p, setP] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let tries = 0
    let timer
    const load = () => api.getPlan(token).then((row) => {
      setP(row)
      // Straight back from Stripe the webhook can take a few seconds to mark the plan active.
      if (row && row.status === 'pending_payment' && params.get('paid') && tries++ < 10) timer = setTimeout(load, 2000)
    }).catch((e) => setError(e.message))
    load()
    return () => clearTimeout(timer)
  }, [token, params])

  if (p === undefined) return <Spinner />
  if (!p) return <div className="card p-6 text-center">We couldn't find that plan. <Link className="underline" to="/plans">See plans</Link>.</div>

  const status = SUB_STATUS[p.status] || SUB_STATUS.pending_payment
  const justPaid = params.get('paid') && p.status === 'active'

  return (
    <div className="space-y-4">
      {justPaid && (
        <div className="card p-5 text-center bg-leaf-100 border-leaf-500/40">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-extrabold text-brand-900 mt-1">You're all set, {p.name.split(' ')[0]}</h1>
          <p className="text-slate-700 mt-1">Your cleaning plan is active. We'll be in touch before your first clean to sort out access.</p>
        </div>
      )}
      {p.status === 'pending_payment' && (
        <div className="card p-4 text-sm">
          {params.get('paid') ? 'Confirming your payment… this page will update in a moment.' : 'Payment for this plan has not been completed yet.'}
          {!params.get('paid') && <> <Link to="/plans" className="underline font-semibold">Start again</Link>.</>}
        </div>
      )}

      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-lg">Your cleaning plan</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Stat label="Monthly" value={formatPounds(p.monthly_pence)} />
          <Stat label="Cleans" value={`${p.visits_per_week}× a week`} />
          <Stat label="Starts" value={formatDate(p.start_date)} />
        </div>
        <div>
          <div className="label">Your weekly times</div>
          <ul className="space-y-1.5">
            {(p.slots || []).map((s) => (
              <li key={`${s.day}-${s.start}`} className="rounded-xl bg-brand-50 px-3 py-2 font-semibold">
                {slotLabel(s, true)}–{addHours(s.start, p.hours_per_visit)}
              </li>
            ))}
          </ul>
        </div>
        {p.current_period_end && p.status === 'active' && (
          <p className="text-sm text-slate-600">Next payment: {formatDate(p.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
        {p.status === 'past_due' && (
          <ErrorNote>Your last payment didn't go through. Please update your card so your cleans can continue.</ErrorNote>
        )}
        {p.status !== 'pending_payment' && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => api.openBillingPortal(token).catch((e) => setError(e.message))}>
              Update card, invoices or cancel
            </button>
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
        <p className="text-xs text-slate-500">Bookmark this page to manage your plan. Need to change a time? Just get in touch.</p>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="font-extrabold text-brand-900 text-lg">{value}</div>
    </div>
  )
}
