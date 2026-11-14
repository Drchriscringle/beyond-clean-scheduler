import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { formatPounds } from '../../supabase/functions/_shared/pricing.js'
import { hoursUntil } from '../../supabase/functions/_shared/schedule.js'
import { ENQUIRY_STATUS } from '../lib/options.js'
import { AccessFields, Badge, ErrorNote, Spinner, accessSummary, formatDate } from '../components/ui.jsx'
import { Summary } from './Enquire.jsx'

export default function EnquiryStatus({ settings }) {
  const { token } = useParams()
  const [params] = useSearchParams()
  const [e, setE] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.getEnquiry(token).then(setE).catch((err) => setError(err.message)), [token])
  useEffect(() => {
    load()
    const t = setInterval(load, 30000) // pick up the owner's reply without a refresh
    return () => clearInterval(t)
  }, [load])

  async function run(fn) {
    setBusy(true); setError('')
    try { const r = await fn(); if (r) setE(r) } catch (err) { setError(err.message) }
    setBusy(false)
  }

  if (e === undefined) return <Spinner />
  if (!e) return <div className="card p-6 text-center">We couldn't find that enquiry. <Link className="underline" to="/enquire">Start a new one</Link>.</div>

  const status = ENQUIRY_STATUS[e.status] || ENQUIRY_STATUS.new
  const owed = (e.quote_pence || 0) - (e.paid_pence || 0)
  const depositDue = e.status === 'awaiting_deposit' ? e.deposit_pence - e.paid_pence : 0
  const upcoming = ['booked', 'awaiting_deposit'].includes(e.status)
  const lateCancel = upcoming && e.booked_date && hoursUntil(e.booked_date, e.booked_time || '09:00') < settings.cancelNoticeHours

  return (
    <div className="space-y-4">
      {params.get('new') && (
        <div className="card p-5 text-center bg-leaf-100 border-leaf-500/40">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-extrabold text-brand-900 mt-1">Thanks {e.name.split(' ')[0]}, we've got it</h1>
          <p className="text-slate-700 mt-1">We'll be in touch with a price and a time soon. We've emailed you a link to this page.</p>
        </div>
      )}
      {params.get('paid') && <div role="status" className="card p-4 bg-leaf-100 font-semibold">✓ Payment received, thank you!</div>}

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-lg">Your {upcoming || e.status === 'completed' ? 'booking' : 'enquiry'}</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-sm text-slate-500">Sent {formatDate(e.created_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>

        {e.status === 'new' && (
          <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-3 text-sm">
            We're looking at your enquiry and will reply soon.
            {e.estimate_low_pence ? <> Your estimate was <b>{formatPounds(e.estimate_low_pence)}–{formatPounds(e.estimate_high_pence)}</b>.</> : null}
          </p>
        )}

        {e.reply_message && e.status !== 'new' && (
          <div className="mt-4 rounded-2xl border-2 border-brand-100 bg-brand-50/60 p-4 space-y-3">
            <div className="text-sm font-bold text-brand-700">Reply from Beyond Clean</div>
            <p className="whitespace-pre-wrap">{e.reply_message}</p>
            {(e.quote_pence != null || e.booked_date) && (
              <div className="grid grid-cols-2 gap-2">
                {e.quote_pence != null && <Fact label="Price" value={formatPounds(e.quote_pence)} />}
                {e.booked_date && <Fact label="Date & time" value={`${formatDate(e.booked_date)}${e.booked_time ? ` · ${e.booked_time}` : ''}`} />}
              </div>
            )}
            {e.status === 'replied' && e.deposit_pence > 0 && (
              <p className="text-sm">A <b>{formatPounds(e.deposit_pence)}</b> card deposit secures the date. It comes off the price.</p>
            )}
            {e.status === 'replied' && e.quote_pence != null && (
              <div className="flex gap-2">
                <button className="btn-leaf flex-1" disabled={busy} onClick={() => run(() => api.respondToQuote(token, true))}>
                  {e.deposit_pence > 0 ? 'Accept' : 'Accept & book'}
                </button>
                <button className="btn-secondary" disabled={busy} onClick={() => run(() => api.respondToQuote(token, false))}>No thanks</button>
              </div>
            )}
          </div>
        )}

        {depositDue > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2">
            <p className="font-semibold">Last step: pay the {formatPounds(depositDue)} deposit to secure your date.</p>
            <button className="btn-leaf w-full" disabled={busy} onClick={() => run(() => api.payQuote(token))}>Pay {formatPounds(depositDue)} deposit</button>
            <p className="text-xs text-slate-600">🔒 Secure card payment by Stripe.</p>
          </div>
        )}
        {e.status === 'booked' && (
          <p className="mt-3 rounded-xl bg-leaf-100 px-3.5 py-3 font-semibold">
            ✓ You're booked in for {formatDate(e.booked_date, { weekday: 'long', day: 'numeric', month: 'long' })}{e.booked_time ? ` at ${e.booked_time}` : ''}.
            {e.paid_pence > 0 && <span className="block text-sm font-normal">Paid so far: {formatPounds(e.paid_pence)} of {formatPounds(e.quote_pence)}</span>}
          </p>
        )}
        {e.status === 'completed' && (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl bg-leaf-100 px-3.5 py-3 font-semibold">✓ All done. Thank you for choosing Beyond Clean!</p>
            {owed > 0 && <button className="btn-leaf w-full" disabled={busy} onClick={() => run(() => api.payQuote(token))}>Pay balance of {formatPounds(owed)}</button>}
            <Link to={`/review/${token}`} className="btn-secondary w-full">⭐ Rate your clean</Link>
          </div>
        )}
        {e.status === 'cancelled' && (
          <p className="mt-3 text-sm text-slate-600">
            This booking was cancelled{e.late_cancel ? ` with less than ${settings.cancelNoticeHours} hours' notice, so a late-cancellation charge may apply` : ''}. <Link to="/enquire" className="underline">Book again</Link>.
          </p>
        )}
        {e.status === 'declined' && (
          <p className="mt-3 text-sm text-slate-600">This enquiry is closed. <Link to="/enquire" className="underline">Send a new one</Link> any time.</p>
        )}
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
      </div>

      {['new', 'replied', 'awaiting_deposit', 'booked'].includes(e.status) && (
        <AccessCard token={token} access={e.access} onSaved={(access) => setE({ ...e, access })} />
      )}

      {upcoming && (
        <div className="card p-4 text-sm space-y-2">
          <div className="font-bold">Need to cancel?</div>
          <p className="text-slate-600">
            Free with {settings.cancelNoticeHours} hours' notice. Later than that, {settings.lateCancelPercent}% of the price may be charged. <Link to="/policies" className="underline">Policies</Link>
          </p>
          <button className="btn-danger btn-sm" disabled={busy} onClick={() => {
            if (confirm(lateCancel ? `It's less than ${settings.cancelNoticeHours} hours until your clean, so a late-cancellation charge may apply. Cancel anyway?` : 'Cancel this booking?')) {
              run(() => api.cancelBooking(token))
            }
          }}>Cancel booking</button>
        </div>
      )}

      <details className="card p-4">
        <summary className="font-bold cursor-pointer">What you asked for</summary>
        <div className="mt-3"><Summary f={{ ...e, areas: e.areas || [], extras: e.extras || [] }} /></div>
        {['completed', 'booked', 'declined', 'cancelled'].includes(e.status) && (
          <Link to={`/enquire?from=${token}`} className="btn-secondary btn-sm mt-3">Book this again</Link>
        )}
      </details>
    </div>
  )
}

export function AccessCard({ token, access, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(access || {})
  const [busy, setBusy] = useState(false)
  const summary = accessSummary(access)
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold">🔑 Access, pets & parking</div>
        {!editing && <button className="btn-secondary btn-sm" onClick={() => { setValue(access || {}); setEditing(true) }}>{summary ? 'Edit' : 'Add'}</button>}
      </div>
      {!editing && <p className="text-sm text-slate-600">{summary || 'Not added yet. Tell us how to get in so we can get straight to work.'}</p>}
      {editing && (
        <>
          <AccessFields value={value} onChange={setValue} />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={async () => {
              setBusy(true)
              await api.updateAccess(token, value)
              onSaved(value); setEditing(false); setBusy(false)
            }}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="font-extrabold text-brand-900">{value}</div>
    </div>
  )
}
