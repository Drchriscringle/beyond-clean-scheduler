import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { DEMO, api } from '../../lib/api.js'
import { DemoBanner, ErrorNote, Logo, Spinner } from '../../components/ui.jsx'
import Inbox from './Inbox.jsx'
import PlansAdmin from './PlansAdmin.jsx'
import Week from './Week.jsx'
import SettingsAdmin from './SettingsAdmin.jsx'
import Team from './Team.jsx'
import Reviews from './Reviews.jsx'
import Reports from './Reports.jsx'

// A short two-tone "ding" made in the browser, so there's no sound file to host.
export function ding() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.start(t); o.stop(t + 0.4)
    })
  } catch { /* no audio */ }
}

export default function Admin({ settings, onSettings }) {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    api.getSession().then(setSession)
    return api.onAuthChange(setSession)
  }, [])

  const [admin, setAdmin] = useState(undefined)
  useEffect(() => {
    if (session) api.isAdmin().then(setAdmin).catch(() => setAdmin(false))
    else setAdmin(undefined)
  }, [session])
  const out = () => api.signOut().then(() => setSession(null))

  if (session === undefined) return <Spinner />
  if (!session) return <Login onIn={() => api.getSession().then(setSession)} />
  if (admin === undefined) return <Spinner />
  if (!admin) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="card p-6 max-w-sm text-center space-y-3">
          <p>This account isn't set up as the Beyond Clean owner.</p>
          <button className="btn-primary" onClick={out}>Sign out</button>
        </div>
      </div>
    )
  }
  return <Owner settings={settings} onSettings={onSettings} onOut={out} />
}

function Login({ onIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await api.signIn(email, password); onIn() } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <div className="min-h-screen flex flex-col">
      {DEMO && <DemoBanner />}
      <div className="flex-1 grid place-items-center px-4">
        <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Logo size={88} />
            <h1 className="font-extrabold text-xl text-brand-900">Owner sign in</h1>
          </div>
          {DEMO ? (
            <p className="text-sm text-slate-600 text-center">Demo mode: no password needed. (Cleaners use <a className="underline" href="#/cleaner">the cleaner app</a>.)</p>
          ) : (
            <>
              <div><label className="label" htmlFor="em">Email</label>
                <input id="em" type="email" className="field" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><label className="label" htmlFor="pw">Password</label>
                <input id="pw" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            </>
          )}
          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  )
}

function Owner({ settings, onSettings, onOut }) {
  const [data, setData] = useState(null)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')
  const toastTimer = useRef()

  const reload = useCallback(async () => {
    try {
      const [enquiries, plans, changes, cleaners, reviews] = await Promise.all([
        api.listEnquiries(), api.listPlans(), api.listChanges(), api.listCleaners(), api.listReviews(),
      ])
      setData({ enquiries, plans, changes, cleaners, reviews })
    } catch (err) { setError(err.message) }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Live feed: ping when a customer sends an enquiry, accepts a quote or starts a plan.
  useEffect(() => api.watch((evt) => {
    reload()
    const r = evt.record || {}
    let msg = ''
    if (evt.table === 'enquiries' && evt.type === 'INSERT') msg = `New enquiry from ${r.name}`
    if (evt.byOwner) return
    if (evt.table === 'enquiries' && evt.type === 'UPDATE' && r.status === 'booked' && r.accepted_at) msg = `${r.name} is booked in`
    if (evt.table === 'enquiries' && evt.type === 'UPDATE' && r.status === 'awaiting_deposit') msg = `${r.name} accepted your quote`
    if (evt.table === 'enquiries' && evt.type === 'UPDATE' && r.status === 'cancelled') msg = `${r.name} cancelled their booking`
    if (evt.table === 'plan_changes' && evt.type === 'INSERT' && r.made_by === 'customer') {
      msg = { skip: 'A customer skipped a clean', move: 'A customer wants to move a clean', extra: 'A customer added an extra' }[r.kind] || ''
    }
    if (evt.table === 'reviews' && evt.type === 'INSERT') msg = r.fix_requested ? `⚠️ ${r.name} wants us to put something right` : `New ${r.rating}★ review from ${r.name}`
    if (evt.table === 'enquiries' && evt.type === 'UPDATE' && r.status === 'declined' && r.customer_declined) msg = `${r.name} declined your quote`
    if (evt.table === 'subscriptions' && (evt.type === 'INSERT' || evt.type === 'UPDATE') && r.status === 'active' && !r.owner_seen) msg = `New cleaning plan: ${r.name}`
    if (!msg) return
    ding()
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('Beyond Clean', { body: msg, icon: './icons/icon-192.png' }) } catch { /* ignore */ }
    }
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }), [reload])

  const newCount = (data?.enquiries || []).filter((e) => e.status === 'new').length
  useEffect(() => {
    document.title = newCount ? `(${newCount}) Beyond Clean – Owner` : 'Beyond Clean – Owner'
  }, [newCount])

  const tabs = [
    ['', 'Enquiries', newCount],
    ['plans', 'Plans', (data?.plans || []).filter((p) => p.status === 'active' && !p.owner_seen).length
      + (data?.changes || []).filter((c) => c.kind === 'move' && c.status === 'requested').length],
    ['week', 'Week', 0],
    ['team', 'Team', 0],
    ['reviews', 'Reviews', (data?.reviews || []).filter((r) => r.fix_status === 'open' || !r.seen).length],
    ['reports', 'Reports', 0],
    ['settings', 'Settings', 0],
  ]

  return (
    <div className="min-h-screen">
      {DEMO && <DemoBanner />}
      <header className="bg-brand-900 text-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-2">
          <Logo size={36} />
          <span className="font-extrabold">Beyond Clean <span className="font-semibold opacity-70">· Owner</span></span>
          <a href="#/" className="ml-auto text-sm opacity-80 hover:opacity-100 hidden sm:inline">Customer app ↗</a>
          <button className="text-sm opacity-80 hover:opacity-100 ml-3 sm:ml-0" onClick={onOut}>Sign out</button>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-1 px-2 overflow-x-auto">
          {tabs.map(([to, label, count]) => (
            <NavLink key={to} to={`/admin/${to}`} end
              className={({ isActive }) => `px-3 py-2.5 text-sm font-bold border-b-[3px] whitespace-nowrap ${isActive ? 'border-leaf-500 text-white' : 'border-transparent text-white/70'}`}>
              {label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-leaf-500 text-brand-900 text-xs px-1.5 py-0.5">{count}</span>}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <ErrorNote>{error}</ErrorNote>
        <NotifyPrompt />
        {data === null ? <Spinner /> : (
          <Routes>
            <Route index element={<Inbox data={data} settings={settings} onChange={reload} />} />
            <Route path="plans" element={<PlansAdmin data={data} onChange={reload} />} />
            <Route path="week" element={<Week data={data} settings={settings} onChange={reload} />} />
            <Route path="team" element={<Team data={data} onChange={reload} />} />
            <Route path="reviews" element={<Reviews data={data} onChange={reload} />} />
            <Route path="reports" element={<Reports data={data} />} />
            <Route path="settings" element={<SettingsAdmin settings={settings} onSaved={onSettings} />} />
          </Routes>
        )}
      </main>

      {toast && (
        <div role="status" className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:w-96 z-30 rounded-2xl bg-brand-900 text-white shadow-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🔔</span><span className="font-bold flex-1">{toast}</span>
          <button className="opacity-70" onClick={() => setToast(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
    </div>
  )
}

function NotifyPrompt() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported')
  if (perm !== 'default') return null
  return (
    <div className="card p-3 mb-4 flex items-center gap-3 text-sm">
      <span className="text-xl">🔔</span>
      <span className="flex-1">Turn on alerts to get a pop-up when a new enquiry arrives while this page is open.</span>
      <button className="btn-primary btn-sm" onClick={() => { ding(); Notification.requestPermission().then(setPerm) }}>Turn on</button>
    </div>
  )
}
