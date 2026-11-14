import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO, api } from '../lib/api.js'
import { formatPounds, frequencyLabel } from '../../supabase/functions/_shared/pricing.js'
import { CLEAN_TYPES, ENQUIRY_STATUS, PROPERTY_TYPES, SUB_STATUS, labelFor } from '../lib/options.js'
import { AccessFields, Badge, Choice, Counter, ErrorNote, Spinner, accessSummary, formatDate } from '../components/ui.jsx'

export default function Account() {
  const [acc, setAcc] = useState(undefined)
  const load = useCallback(() => api.getAccount().then(setAcc).catch(() => setAcc(null)), [])
  useEffect(() => { load() }, [load])

  if (acc === undefined) return <Spinner />
  if (!acc) return <SignIn onIn={load} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-extrabold text-brand-900 flex-1">My account</h1>
        <button className="btn-ghost btn-sm" onClick={async () => { await api.signOut(); setAcc(null) }}>Sign out</button>
      </div>
      <p className="text-sm text-slate-600 -mt-3">{acc.email}</p>

      <section className="card p-4 space-y-2">
        <h2 className="font-extrabold">Cleaning plans</h2>
        {!acc.plans.length && <p className="text-sm text-slate-600">No plans yet. <Link to="/plans" className="underline">See plans</Link></p>}
        {acc.plans.map((p) => (
          <Link key={p.token} to={`/plan/${p.token}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-brand-500">
            <span className="flex-1"><b>{p.address}</b><br /><span className="text-sm text-slate-600">{p.hours_per_visit} hrs {frequencyLabel(p.visits_per_week)} · {formatPounds(p.monthly_pence)}/month</span></span>
            <Badge tone={SUB_STATUS[p.status]?.tone}>{SUB_STATUS[p.status]?.label}</Badge>
          </Link>
        ))}
      </section>

      <Properties acc={acc} onChange={load} />

      <section className="card p-4 space-y-2">
        <h2 className="font-extrabold">Bookings & quotes</h2>
        {!acc.enquiries.length && <p className="text-sm text-slate-600">Nothing yet. <Link to="/enquire" className="underline">Get a quote</Link></p>}
        {acc.enquiries.map((e) => (
          <div key={e.token} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <Link to={`/enquiry/${e.token}`} className="flex-1 min-w-0">
              <b>{labelFor(CLEAN_TYPES, e.clean_type)}</b> · <span className="text-sm">{e.address}</span>
              <div className="text-sm text-slate-600">{e.booked_date ? formatDate(e.booked_date) : `Sent ${formatDate(e.created_at)}`}</div>
            </Link>
            <Badge tone={ENQUIRY_STATUS[e.status]?.tone}>{ENQUIRY_STATUS[e.status]?.label}</Badge>
            <Link to={`/enquire?from=${e.token}`} className="btn-secondary btn-sm" aria-label="Book again">↻</Link>
          </div>
        ))}
      </section>
    </div>
  )
}

function SignIn({ onIn }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message) }
    setBusy(false)
  }
  return (
    <div className="card p-5 space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">My account</h1>
        <p className="text-slate-600 text-sm">See all your bookings and plans, save your properties and rebook in seconds. No password needed.</p>
      </div>
      {!sent ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(async () => { await api.sendCode(email.trim()); setSent(true) }) }}>
          <div><label className="label" htmlFor="ae">Your email</label>
            <input id="ae" type="email" required className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>Email me a sign-in code</button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(async () => { await api.verifyCode(email.trim(), code.trim()); onIn() }) }}>
          <p className="text-sm">We've emailed a 6-digit code to <b>{email}</b>.{DEMO && ' (Demo mode: use 123456.)'}</p>
          <div><label className="label" htmlFor="ac">Code</label>
            <input id="ac" inputMode="numeric" autoComplete="one-time-code" className="field tracking-[.4em] text-center text-xl font-bold" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>Sign in</button>
          <button type="button" className="btn-ghost btn-sm w-full" onClick={() => setSent(false)}>Use a different email</button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  )
}

const EMPTY_PROPERTY = { label: '', address: '', postcode: '', property_type: 'holiday_let', bedrooms: 2, bathrooms: 1, access: {} }

function Properties({ acc, onChange }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch) => setEditing((x) => ({ ...x, ...patch }))

  async function save() {
    setBusy(true); setError('')
    try { await api.saveProperty(editing); setEditing(null); onChange() } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <section className="card p-4 space-y-2">
      <div className="flex items-center">
        <h2 className="font-extrabold flex-1">Saved properties</h2>
        {!editing && <button className="btn-secondary btn-sm" onClick={() => setEditing(EMPTY_PROPERTY)}>+ Add</button>}
      </div>
      {!acc.properties.length && !editing && (
        <p className="text-sm text-slate-600">Landlord, Airbnb host or just more than one home? Save each property once, then book a clean for it in two taps.</p>
      )}
      {acc.properties.map((p) => (
        <div key={p.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <b>{p.label}</b>
              <div className="text-sm text-slate-600">{p.address}, {p.postcode} · {labelFor(PROPERTY_TYPES, p.property_type)}{p.bedrooms != null ? ` · ${p.bedrooms} bed` : ''}</div>
              {accessSummary(p.access) && <div className="text-xs text-slate-500 truncate">{accessSummary(p.access)}</div>}
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button>
          </div>
          <Link to={`/enquire?property=${p.id}`} className="btn-primary btn-sm w-full mt-2">Book a clean here</Link>
        </div>
      ))}
      {editing && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
          <div><label className="label" htmlFor="pl">Name</label>
            <input id="pl" className="field" placeholder="e.g. Shore Road flat" value={editing.label} onChange={(e) => set({ label: e.target.value })} /></div>
          <div><label className="label" htmlFor="pa">Address</label>
            <input id="pa" className="field" value={editing.address} onChange={(e) => set({ address: e.target.value })} /></div>
          <div className="w-40"><label className="label" htmlFor="pp">Postcode</label>
            <input id="pp" className="field uppercase" value={editing.postcode} onChange={(e) => set({ postcode: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            {PROPERTY_TYPES.map((t) => <Choice key={t.id} on={editing.property_type === t.id} onClick={() => set({ property_type: t.id })} className="!py-2 text-sm font-bold">{t.icon} {t.label}</Choice>)}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Counter label="Bedrooms" value={Number(editing.bedrooms) || 0} onChange={(v) => set({ bedrooms: v })} max={10} />
            <Counter label="Bathrooms" value={Number(editing.bathrooms) || 1} onChange={(v) => set({ bathrooms: v })} min={1} max={6} />
          </div>
          <AccessFields value={editing.access} onChange={(access) => set({ access })} />
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={save}>Save property</button>
            {editing.id && <button className="btn-danger" disabled={busy} onClick={async () => { if (confirm('Remove this property?')) { await api.deleteProperty(editing.id); setEditing(null); onChange() } }}>Remove</button>}
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}
