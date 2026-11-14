import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { formatPounds } from '../../supabase/functions/_shared/pricing.js'
import { ENQUIRY_STATUS } from '../lib/options.js'
import { Badge, ErrorNote, Spinner, formatDate } from '../components/ui.jsx'
import { Summary } from './Enquire.jsx'

export default function EnquiryStatus() {
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

  async function respond(accept) {
    setBusy(true); setError('')
    try { setE(await api.respondToQuote(token, accept)) } catch (err) { setError(err.message) }
    setBusy(false)
  }

  if (e === undefined) return <Spinner />
  if (!e) return <div className="card p-6 text-center">We couldn't find that enquiry. <Link className="underline" to="/enquire">Start a new one</Link>.</div>

  const status = ENQUIRY_STATUS[e.status] || ENQUIRY_STATUS.new
  return (
    <div className="space-y-4">
      {params.get('new') && (
        <div className="card p-5 text-center bg-leaf-100 border-leaf-500/40">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-extrabold text-brand-900 mt-1">Thanks {e.name.split(' ')[0]}, we've got it</h1>
          <p className="text-slate-700 mt-1">We'll be in touch with a price and a time soon. Bookmark this page to see our reply here too.</p>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-lg">Your enquiry</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-sm text-slate-500">Sent {formatDate(e.created_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>

        {e.status === 'new' && (
          <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-3 text-sm">We're looking at your enquiry and will reply soon.</p>
        )}

        {['replied', 'booked', 'declined'].includes(e.status) && e.reply_message && (
          <div className="mt-4 rounded-2xl border-2 border-brand-100 bg-brand-50/60 p-4 space-y-3">
            <div className="text-sm font-bold text-brand-700">Reply from Beyond Clean</div>
            <p className="whitespace-pre-wrap">{e.reply_message}</p>
            {(e.quote_pence || e.booked_date) && (
              <div className="grid grid-cols-2 gap-2">
                {e.quote_pence != null && <Fact label="Price" value={formatPounds(e.quote_pence)} />}
                {e.booked_date && <Fact label="Date & time" value={`${formatDate(e.booked_date, { weekday: 'short', day: 'numeric', month: 'short' })}${e.booked_time ? ` · ${e.booked_time}` : ''}`} />}
              </div>
            )}
            {e.status === 'replied' && e.quote_pence != null && (
              <div className="flex gap-2">
                <button className="btn-leaf flex-1" disabled={busy} onClick={() => respond(true)}>Accept & book</button>
                <button className="btn-secondary" disabled={busy} onClick={() => respond(false)}>No thanks</button>
              </div>
            )}
          </div>
        )}

        {e.status === 'booked' && (
          <p className="mt-3 rounded-xl bg-leaf-100 px-3.5 py-3 font-semibold">✓ You're booked in. We'll see you then!</p>
        )}
        {e.status === 'declined' && (
          <p className="mt-3 text-sm text-slate-600">This enquiry is closed. <Link to="/enquire" className="underline">Send a new one</Link> any time.</p>
        )}
        <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
      </div>

      <details className="card p-4">
        <summary className="font-bold cursor-pointer">What you asked for</summary>
        <div className="mt-3"><Summary f={{ ...e, areas: e.areas || [], extras: e.extras || [] }} /></div>
      </details>
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
