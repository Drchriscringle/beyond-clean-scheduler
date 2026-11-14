import { useEffect, useState } from 'react'
import { DEMO, api } from '../../lib/api.js'
import { formatPounds } from '../../../supabase/functions/_shared/pricing.js'
import { ErrorNote } from '../../components/ui.jsx'

const COLOURS = ['#2a7fc4', '#6fa52a', '#d97706', '#9333ea', '#db2777', '#0d9488', '#475569']
const EMPTY = { name: '', phone: '', email: '', hourly_wage_pence: 1250, colour: COLOURS[0], active: true }

export default function Team({ data, onChange }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [links, setLinks] = useState(null)
  useEffect(() => { api.calendarLinks().then(setLinks).catch(() => {}) }, [data.cleaners])

  async function save() {
    if (!editing.name.trim()) return setError('Add a name.')
    setError('')
    try {
      await api.saveCleaner({ ...editing, email: editing.email?.trim().toLowerCase() || null, hourly_wage_pence: Math.round(Number(editing.hourly_wage_pence)) || 0 })
      setEditing(null); onChange()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <section className="card p-4 space-y-3">
        <div className="flex items-center">
          <h2 className="font-extrabold text-lg flex-1">Cleaners</h2>
          <button className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY, colour: COLOURS[data.cleaners.length % COLOURS.length] })}>+ Add cleaner</button>
        </div>
        {!data.cleaners.length && <p className="text-sm text-slate-600">Add your team so you can assign cleans and see who's doing what.</p>}
        <ul className="divide-y divide-slate-100">
          {data.cleaners.map((c) => (
            <li key={c.id} className={`py-2.5 flex items-center gap-3 ${c.active ? '' : 'opacity-50'}`}>
              <span className="size-4 rounded" style={{ background: c.colour }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold">{c.name}{!c.active && ' (inactive)'}</div>
                <div className="text-sm text-slate-500 truncate">{[c.phone, c.email, `${formatPounds(c.hourly_wage_pence)}/hr`].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
            </li>
          ))}
        </ul>
        {editing && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Mobile" value={editing.phone || ''} onChange={(v) => setEditing({ ...editing, phone: v })} />
              <Field label="Email (they sign in to the cleaner app with this)" value={editing.email || ''} onChange={(v) => setEditing({ ...editing, email: v })} />
              <Field label="Wage £/hour" value={String((editing.hourly_wage_pence || 0) / 100)} onChange={(v) => setEditing({ ...editing, hourly_wage_pence: Math.round(parseFloat(v) * 100) || 0 })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Colour</span>
              {COLOURS.map((col) => (
                <button key={col} aria-label={col} aria-pressed={editing.colour === col} onClick={() => setEditing({ ...editing, colour: col })}
                  className={`size-7 rounded-full ${editing.colour === col ? 'ring-2 ring-offset-2 ring-brand-900' : ''}`} style={{ background: col }} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-brand-600" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active
            </label>
            <ErrorNote>{error}</ErrorNote>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={save}>Save</button>
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-2 text-sm">
        <h2 className="font-extrabold text-lg">📱 Cleaner app</h2>
        <p>Each cleaner opens <b>{window.location.href.split('#')[0]}#/cleaner</b> on their phone, signs in with their email (we email them a code), and adds it to their home screen.</p>
        <p>They see their own cleans only: address, access and key safe code, pets, the checklist for the job, and they clock in and out and take before and after photos. They never see prices.</p>
      </section>

      <section className="card p-4 space-y-2 text-sm">
        <h2 className="font-extrabold text-lg">📅 Calendar feeds</h2>
        <p>Add these to Google Calendar (Other calendars → + → From URL) or your iPhone (Settings → Calendar → Accounts → Add subscribed calendar). Cleans appear automatically and stay up to date.</p>
        {DEMO && <p className="text-amber-800">Demo mode: real links appear once the app is connected to Supabase.</p>}
        {links?.error && <p className="text-red-700">{links.error}</p>}
        {links?.owner && <CopyRow label="Everything (you)" url={links.owner} />}
        {links?.cleaners?.map((c) => <CopyRow key={c.id} label={c.name} url={c.url} />)}
      </section>
    </div>
  )
}

function CopyRow({ label, url }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 font-bold">{label}</span>
      <input readOnly className="field !py-1.5 text-xs" value={url} onFocus={(e) => e.target.select()} />
      <button className="btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* ignore */ } }}>{copied ? '✓' : 'Copy'}</button>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return <label className="block"><span className="label">{label}</span><input className="field" value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
