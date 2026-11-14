import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { addHours, formatPounds, frequencyLabel, planVisitValue, slotLabel } from '../../supabase/functions/_shared/pricing.js'
import { addDays, hoursUntil, planVisits, todayUK } from '../../supabase/functions/_shared/schedule.js'
import { EXTRAS, SUB_STATUS, labelFor } from '../lib/options.js'
import { Badge, ErrorNote, Spinner, formatDate } from '../components/ui.jsx'
import { AccessCard } from './EnquiryStatus.jsx'

export default function PlanStatus({ settings }) {
  const { token } = useParams()
  const [params] = useSearchParams()
  const [p, setP] = useState(undefined)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function act(req) {
    setBusy(true); setError(''); setNote('')
    try {
      const r = await api.planAction(token, req)
      setP(r.plan); setNote(r.message)
      return true
    } catch (e) { setError(e.message); return false } finally { setBusy(false) }
  }

  const today = todayUK()
  const visits = useMemo(() => (p ? planVisits(p, p.changes || [], addDays(today, -7), addDays(today, 56)) : []), [p, today])

  if (p === undefined) return <Spinner />
  if (!p) return <div className="card p-6 text-center">We couldn't find that plan. <Link className="underline" to="/plans">See plans</Link>.</div>

  const status = SUB_STATUS[p.status] || SUB_STATUS.pending_payment
  const justPaid = params.get('paid') && p.status === 'active'
  const live = ['active', 'past_due'].includes(p.status)
  const upcoming = visits.filter((v) => v.date >= today)
  const lastDone = [...visits].reverse().find((v) => v.date < today && !v.skipped)

  return (
    <div className="space-y-4">
      {justPaid && (
        <div className="card p-5 text-center bg-leaf-100 border-leaf-500/40">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-extrabold text-brand-900 mt-1">You're all set, {p.name.split(' ')[0]}</h1>
          <p className="text-slate-700 mt-1">Your cleaning plan is active. Add your access details below so we can get straight to work.</p>
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
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Monthly" value={formatPounds(p.monthly_pence)} />
          <Stat label="How often" value={frequencyLabel(p.visits_per_week, true)} />
          <Stat label="Each clean" value={`${p.hours_per_visit} hrs`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(p.slots || []).map((s) => (
            <span key={`${s.day}-${s.start}`} className="rounded-lg bg-brand-50 text-brand-700 font-bold text-sm px-2.5 py-1">
              {slotLabel(s, true)}–{addHours(s.start, p.hours_per_visit)}
            </span>
          ))}
        </div>
        {p.status === 'past_due' && <ErrorNote>Your last payment didn't go through. Please update your card so your cleans can continue.</ErrorNote>}
        {p.current_period_end && p.status === 'active' && (
          <p className="text-sm text-slate-600">Next payment: {formatDate(p.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
        {p.status !== 'pending_payment' && (
          <button className="btn-secondary w-full sm:w-auto" onClick={() => api.openBillingPortal(token).catch((e) => setError(e.message))}>
            💳 Update card, invoices or cancel
          </button>
        )}
      </div>

      {(note || error) && (
        <div className="sticky top-2 z-10">
          {note && <div role="status" className="rounded-xl bg-leaf-100 border border-leaf-500/40 px-3.5 py-2.5 font-semibold shadow">{note}</div>}
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {live && (
        <div className="card p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="font-extrabold text-lg">Upcoming cleans</h2>
            <p className="text-sm text-slate-600">
              Skip with {settings.skipNoticeHours} hours' notice and {formatPounds(planVisitValue(p))} comes off your next bill.
            </p>
          </div>
          <ul className="space-y-2">
            {upcoming.slice(0, 8).map((v) => <VisitRow key={v.key} v={v} busy={busy} act={act} settings={settings} />)}
          </ul>
          <PauseForm busy={busy} act={act} />
        </div>
      )}

      {p.status !== 'pending_payment' && <AccessCard token={token} access={p.access} onSaved={(access) => setP({ ...p, access })} />}

      {lastDone && (
        <Link to={`/review/${token}?date=${lastDone.date}`} className="card p-4 flex items-center gap-3 hover:border-brand-500">
          <span className="text-2xl">⭐</span>
          <span className="flex-1"><b>How was your clean on {formatDate(lastDone.date)}?</b><br /><span className="text-sm text-slate-600">Not perfect? We'll come back and put it right within 24 hours.</span></span>
          <span aria-hidden>›</span>
        </Link>
      )}

      {p.referral_code && p.status !== 'pending_payment' && <ReferralCard code={p.referral_code} reward={settings.referralRewardPence} />}

      <p className="text-xs text-slate-500 text-center">Bookmark this page, or find it any time in <Link to="/account" className="underline">My account</Link>.</p>
    </div>
  )
}

function VisitRow({ v, busy, act, settings }) {
  const [mode, setMode] = useState('')
  const [newDate, setNewDate] = useState(addDays(v.originalDate, 1))
  const [newTime, setNewTime] = useState(v.start)
  const [extra, setExtra] = useState('')
  const [why, setWhy] = useState('')
  const soon = hoursUntil(v.date, v.start) < 24
  const base = { date: v.originalDate, start: v.originalStart }
  const done = (ok) => ok && setMode('')

  return (
    <li className={`rounded-xl border px-3 py-2.5 ${v.skipped ? 'border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className={`font-bold ${v.skipped ? 'line-through text-slate-400' : ''}`}>
            {formatDate(v.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {v.start}–{v.end}
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {v.skipped && <Badge tone="bg-slate-200 text-slate-700">Skipped</Badge>}
            {v.moved && <Badge tone="bg-brand-100 text-brand-700">Moved from {formatDate(v.originalDate)}</Badge>}
            {v.movePending && <Badge tone="bg-amber-100 text-amber-800">Move to {formatDate(v.movePending.new_date)} requested</Badge>}
            {v.extras.map((e) => <Badge key={e.extra_id} tone="bg-leaf-100 text-leaf-600">+ {labelFor(EXTRAS, e.extra_id)}</Badge>)}
          </div>
        </div>
        {v.skipped
          ? !soon && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => act({ action: 'unskip', ...base })}>Undo</button>
          : !soon && (
            <select aria-label="Change this clean" className="field !w-auto !py-1.5 !text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Change…</option>
              <option value="skip">Skip</option>
              {!v.movePending && <option value="move">Move</option>}
              <option value="extra">Add extra</option>
            </select>
          )}
      </div>

      {mode === 'skip' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="field flex-1 !py-1.5 text-sm" placeholder="Reason (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={busy} onClick={async () => done(await act({ action: 'skip', note: why, ...base }))}>Skip this clean</button>
        </div>
      )}
      {mode === 'move' && (
        <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
          <input type="date" aria-label="New date" className="field !py-1.5" min={todayUK()} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <input type="time" aria-label="New time" className="field !py-1.5" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          <input className="field !py-1.5 text-sm col-span-2" placeholder="Note (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn-primary btn-sm col-span-2" disabled={busy} onClick={async () => done(await act({ action: 'move', ...base, newDate, newTime, note: why }))}>
            Ask to move
          </button>
          <p className="text-xs text-slate-500 col-span-2">We'll confirm by email. Until then your clean stays where it is.</p>
        </div>
      )}
      {mode === 'extra' && (
        <ExtraPicker settings={settings} busy={busy} value={extra} onChange={setExtra} onAdd={async () => done(await act({ action: 'extra', ...base, extraId: extra, extraLabel: labelFor(EXTRAS, extra) }))} />
      )}
    </li>
  )
}

function ExtraPicker({ settings, value, onChange, onAdd, busy }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select aria-label="Extra" className="field flex-1 !py-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an extra…</option>
        {EXTRAS.filter((x) => settings.extras[x.id]).map((x) => (
          <option key={x.id} value={x.id}>{x.label} · {formatPounds(settings.extras[x.id])}</option>
        ))}
      </select>
      <button className="btn-primary btn-sm" disabled={busy || !value} onClick={onAdd}>Add to next bill</button>
    </div>
  )
}

function PauseForm({ busy, act }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(addDays(todayUK(), 7))
  const [to, setTo] = useState(addDays(todayUK(), 14))
  if (!open) return <button className="btn-secondary w-full" onClick={() => setOpen(true)}>🏖️ Going away? Pause your cleans</button>
  return (
    <div className="rounded-xl bg-brand-50 p-3 space-y-2">
      <div className="font-bold">Pause for a holiday</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">First day away<input type="date" className="field mt-1" min={todayUK()} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm font-semibold">Last day away<input type="date" className="field mt-1" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={async () => { if (await act({ action: 'pause', from, to })) setOpen(false) }}>Pause these dates</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function ReferralCard({ code, reward }) {
  const [copied, setCopied] = useState(false)
  const text = `I use Beyond Clean for my cleaning. Use my code ${code} for ${formatPounds(reward)} off your first month: ${window.location.href.split('#')[0]}#/plans`
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setCopied(true) }
    } catch { /* cancelled */ }
  }
  return (
    <div className="card p-4 space-y-2">
      <div className="font-extrabold">🎁 Give {formatPounds(reward)}, get {formatPounds(reward)}</div>
      <p className="text-sm text-slate-600">When a friend starts a plan with your code, they get {formatPounds(reward)} off and you get {formatPounds(reward)} off your next bill.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-xl bg-slate-100 px-3 py-2 font-extrabold text-lg tracking-wider text-center">{code}</code>
        <button className="btn-leaf" onClick={share}>{copied ? 'Copied ✓' : 'Share'}</button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="font-extrabold text-brand-900">{value}</div>
    </div>
  )
}
