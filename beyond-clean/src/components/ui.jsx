import { Link } from 'react-router-dom'
import { DEMO } from '../lib/api.js'

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
          <nav className="ml-auto flex gap-1 text-sm font-bold">
            <Link to="/enquire" className="btn-ghost btn-sm">Get a quote</Link>
            <Link to="/plans" className="btn-ghost btn-sm hidden sm:inline-flex">Cleaning plans</Link>
          </nav>
        </div>
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-leaf-500" />
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-sm text-slate-500 py-6 px-4">
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
      <Link to="/admin" className="underline font-semibold">Open the owner inbox</Link>
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
