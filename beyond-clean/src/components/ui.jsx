import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO, api } from '../lib/api.js'
import { ACCESS_METHODS } from '../lib/options.js'
import { compressImage } from '../lib/photos.js'

export function Logo({ size = 44 }) {
  return <img src="./logo.jpg" alt="Beyond Clean Ltd" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
}

export function CustomerShell({ children, settings }) {
  return (
    <div className="min-h-screen flex flex-col">
      {DEMO && <DemoBanner />}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={46} />
            <span className="font-extrabold text-brand-900 text-lg tracking-tight">Beyond Clean</span>
          </Link>
          <nav className="ml-auto flex gap-0.5 text-sm font-bold">
            <Link to="/enquire" className="btn-ghost btn-sm !px-2.5">Quote</Link>
            <Link to="/plans" className="btn-ghost btn-sm !px-2.5">Plans</Link>
            <Link to="/account" className="btn-ghost btn-sm !px-2.5" aria-label="My account">👤</Link>
          </nav>
        </div>
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-leaf-500" />
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-sm text-slate-500 py-6 px-4 space-y-1">
        <div className="flex justify-center gap-4 font-semibold">
          <Link to="/policies" className="underline">Our promise & policies</Link>
          <Link to="/account" className="underline">My account</Link>
          {settings?.googleReviewUrl && <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer" className="underline">Find us on Google</a>}
        </div>
        {settings?.businessName || 'Beyond Clean Ltd'}
        {settings?.phone && <> · <a className="underline" href={`tel:${settings.phone}`}>{settings.phone}</a></>}
        {settings?.email && <> · <a className="underline" href={`mailto:${settings.email}`}>{settings.email}</a></>}
      </footer>
    </div>
  )
}

export function DemoBanner() {
  return (
    <div className="bg-amber-50 text-amber-900 text-xs sm:text-sm text-center px-3 py-1.5 border-b border-amber-200">
      Demo mode: data stays on this device and payments are simulated.{' '}
      <Link to="/admin" className="underline font-semibold">Owner inbox</Link> · <Link to="/cleaner" className="underline font-semibold">Cleaner app</Link>
    </div>
  )
}

export function Badge({ tone, children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${tone}`}>{children}</span>
}

export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center gap-1.5 mb-5" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= current ? 'bg-brand-600' : 'bg-slate-200'}`} />
          <div className={`mt-1.5 text-[11px] sm:text-xs font-bold truncate ${i === current ? 'text-brand-700' : 'text-slate-400'}`}>{s}</div>
        </li>
      ))}
    </ol>
  )
}

export function Choice({ on, onClick, children, className = '' }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`tile ${on ? 'tile-on' : ''} ${className}`}>
      {children}
    </button>
  )
}

export function Counter({ label, value, onChange, min = 0, max = 10 }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary btn-sm w-9 px-0" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="w-6 text-center font-extrabold text-lg" aria-live="polite">{value}</span>
        <button type="button" className="btn-secondary btn-sm w-9 px-0" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 text-sm">{children}</div>
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="py-16 text-center text-slate-500">{label}</div>
}

export function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
  return d.toLocaleDateString('en-GB', opts)
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return formatDate(iso)
}

export function Stars({ value, onChange, size = 'text-2xl' }) {
  return (
    <span className={`inline-flex ${size} leading-none`} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value || 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`px-0.5 ${n <= value ? 'text-amber-400' : 'text-slate-300'}`} onClick={() => onChange(n)}>★</button>
      ) : <span key={n} className={n <= value ? 'text-amber-400' : 'text-slate-300'}>★</span>)}
    </span>
  )
}

/** Key safe, pets, parking etc. value = access object. */
export function AccessFields({ value, onChange }) {
  const a = value || {}
  const set = (patch) => onChange({ ...a, ...patch })
  return (
    <div className="grid gap-3">
      <div>
        <span className="label">How will we get in?</span>
        <div className="flex flex-wrap gap-2">
          {ACCESS_METHODS.map((m) => (
            <Choice key={m.id} on={a.method === m.id} onClick={() => set({ method: m.id })} className="!py-2 !px-3 text-sm font-semibold">{m.label}</Choice>
          ))}
        </div>
      </div>
      {a.method === 'key_safe' && (
        <div className="w-48"><label className="label" htmlFor="ks">Key safe code</label>
          <input id="ks" className="field" autoComplete="off" value={a.key_safe_code || ''} onChange={(e) => set({ key_safe_code: e.target.value })} />
          <p className="text-xs text-slate-500 mt-1">Only shown to your cleaner.</p></div>
      )}
      {['neighbour', 'other'].includes(a.method) && (
        <div><label className="label" htmlFor="ad">Details</label>
          <input id="ad" className="field" value={a.details || ''} onChange={(e) => set({ details: e.target.value })} /></div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label" htmlFor="pets">Pets</label>
          <input id="pets" className="field" placeholder="e.g. friendly dog, cat stays in" value={a.pets || ''} onChange={(e) => set({ pets: e.target.value })} /></div>
        <div><label className="label" htmlFor="park">Parking</label>
          <input id="park" className="field" placeholder="e.g. driveway, permit needed" value={a.parking || ''} onChange={(e) => set({ parking: e.target.value })} /></div>
      </div>
      <div><label className="label" htmlFor="alarm">Alarm / anything else</label>
        <input id="alarm" className="field" autoComplete="off" value={a.alarm || ''} onChange={(e) => set({ alarm: e.target.value })} /></div>
    </div>
  )
}

export function accessSummary(a) {
  if (!a) return ''
  const m = ACCESS_METHODS.find((x) => x.id === a.method)
  return [m && `${m.label}${a.key_safe_code ? ` (code ${a.key_safe_code})` : ''}${a.details ? `: ${a.details}` : ''}`,
    a.pets && `Pets: ${a.pets}`, a.parking && `Parking: ${a.parking}`, a.alarm && `Alarm/other: ${a.alarm}`].filter(Boolean).join(' · ')
}

/** Discount or referral code box. onApplied(codeInfo | null). */
export function CodeField({ kind, applied, onApplied }) {
  const [code, setCode] = useState(applied?.code || '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function apply() {
    if (!code.trim()) return
    setBusy(true); setMsg('')
    try {
      const r = await api.checkDiscount(code, kind)
      if (r.valid) onApplied({ ...r, code: r.code || code.trim().toUpperCase() })
      else { setMsg(r.message); onApplied(null) }
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  if (applied) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-leaf-100 px-3 py-2 text-sm">
        <span>🏷️ <b>{applied.code}</b>: {applied.description}</span>
        <button type="button" className="ml-auto underline" onClick={() => { onApplied(null); setCode('') }}>Remove</button>
      </div>
    )
  }
  return (
    <div>
      <label className="label" htmlFor={`code-${kind}`}>Discount or friend's code <span className="font-normal text-slate-500">(optional)</span></label>
      <div className="flex gap-2">
        <input id={`code-${kind}`} className="field uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={apply}>Apply</button>
      </div>
      {msg && <p className="text-sm text-red-700 mt-1">{msg}</p>}
    </div>
  )
}

/** Up to `max` photos, compressed and uploaded. value = array of { path, preview }. */
export function PhotoPicker({ value, onChange, upload, max = 4 }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function add(files) {
    setBusy(true); setError('')
    const next = [...value]
    try {
      for (const f of [...files].slice(0, max - value.length)) {
        const blob = await compressImage(f)
        const path = await upload(blob, next.length)
        next.push({ path, preview: URL.createObjectURL(blob) })
      }
    } catch (e) { setError(e.message) }
    onChange(next)
    setBusy(false)
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={i} className="relative">
            <img src={p.preview} alt={`Photo ${i + 1}`} className="size-20 rounded-xl object-cover border border-slate-200" />
            <button type="button" aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-white border border-slate-300 text-xs"
              onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {value.length < max && (
          <label className={`size-20 rounded-xl border-2 border-dashed border-slate-300 grid place-items-center text-center text-xs font-bold text-slate-500 cursor-pointer ${busy ? 'opacity-50' : ''}`}>
            <span>📷<br />{busy ? 'Adding…' : 'Add photo'}</span>
            <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => add(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
    </div>
  )
}
