import { useState } from 'react'
import { api } from '../../lib/api.js'
import { DAY_NAMES_LONG, formatPounds, planPrice } from '../../../supabase/functions/_shared/pricing.js'
import { ErrorNote } from '../../components/ui.jsx'
import { ding } from './Admin.jsx'

export default function SettingsAdmin({ settings, onSaved }) {
  const [s, setS] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [newTime, setNewTime] = useState({})
  const set = (patch) => { setS((x) => ({ ...x, ...patch })); setMsg('') }

  async function save() {
    setBusy(true); setError('')
    try {
      const clean = { ...s, hourlyRate: Number(s.hourlyRate) || 0, slotCapacity: Math.max(1, Number(s.slotCapacity) || 1) }
      await api.saveSettings(clean)
      onSaved(clean)
      setMsg('Saved. Customers see the new prices and times straight away.')
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  function addSlot(day) {
    const start = newTime[day]
    if (!start || s.slots.find((x) => x.day === day && x.start === start)) return
    set({ slots: [...s.slots, { day, start }] })
    setNewTime({ ...newTime, [day]: '' })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <section className="card p-4 space-y-3">
        <h2 className="font-extrabold text-lg">Business</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Business name" value={s.businessName} onChange={(v) => set({ businessName: v })} />
          <Field label="Area you cover" value={s.area} onChange={(v) => set({ area: v })} />
          <Field label="Phone (shown to customers)" value={s.phone} onChange={(v) => set({ phone: v })} />
          <Field label="Email (shown to customers)" value={s.email} onChange={(v) => set({ email: v })} />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-extrabold text-lg">Plan pricing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="£ per hour" type="number" value={s.hourlyRate} onChange={(v) => set({ hourlyRate: v })} />
          {s.visitsPerWeekOptions.map((v) => (
            <Field key={v} label={`${v}×/week discount %`} type="number" value={s.discounts[v] ?? 0}
              onChange={(x) => set({ discounts: { ...s.discounts, [v]: Number(x) || 0 } })} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Monthly price</th>{s.hoursPerVisitOptions.map((h) => <th key={h}>{h} hrs</th>)}</tr></thead>
            <tbody>
              {s.visitsPerWeekOptions.map((v) => (
                <tr key={v} className="border-t border-slate-100">
                  <td className="py-1.5 font-bold">{v}× a week</td>
                  {s.hoursPerVisitOptions.map((h) => <td key={h}>{formatPounds(planPrice({ ...s, hourlyRate: Number(s.hourlyRate) }, v, h).monthlyPence)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">New prices apply to new plans. Existing customers keep the price they signed up at.</p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-extrabold text-lg">Weekly plan times</h2>
        <div className="w-48"><Field label="Plans allowed per time slot" type="number" value={s.slotCapacity} onChange={(v) => set({ slotCapacity: v })} /></div>
        <p className="text-sm text-slate-600">Set this to the number of cleaners or teams you have, so two customers can share 9am Monday if you have two teams.</p>
        <div className="divide-y divide-slate-100">
          {DAY_NAMES_LONG.map((name, i) => {
            const day = i + 1
            const times = s.slots.filter((x) => x.day === day).sort((a, b) => a.start.localeCompare(b.start))
            return (
              <div key={day} className="py-2 flex flex-wrap items-center gap-2">
                <div className="w-24 font-bold text-sm">{name}</div>
                {times.map((t) => (
                  <span key={t.start} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 text-brand-700 font-bold text-sm pl-2.5 pr-1 py-1">
                    {t.start}
                    <button className="px-1 opacity-60 hover:opacity-100" aria-label={`Remove ${name} ${t.start}`}
                      onClick={() => set({ slots: s.slots.filter((x) => !(x.day === day && x.start === t.start)) })}>✕</button>
                  </span>
                ))}
                <input type="time" aria-label={`New ${name} time`} className="field !w-28 !py-1 !px-2 text-sm" value={newTime[day] || ''} onChange={(e) => setNewTime({ ...newTime, [day]: e.target.value })} />
                <button className="btn-secondary btn-sm" onClick={() => addSlot(day)}>Add</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-extrabold text-lg">One-off enquiries</h2>
        <div className="label">Days customers can't choose</div>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES_LONG.map((name, i) => {
            const on = s.closedDays.includes(i + 1)
            return (
              <button key={name} aria-pressed={on} className={`btn btn-sm border ${on ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-300'}`}
                onClick={() => set({ closedDays: on ? s.closedDays.filter((d) => d !== i + 1) : [...s.closedDays, i + 1] })}>
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </section>

      <ErrorNote>{error}</ErrorNote>
      {msg && <div role="status" className="rounded-xl bg-leaf-100 px-3 py-2 text-sm font-semibold">{msg}</div>}
      <div className="flex gap-2 sticky bottom-3">
        <button className="btn-primary flex-1 shadow-lg" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button>
        <button className="btn-secondary" onClick={ding}>Test alert sound</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" type={type} inputMode={type === 'number' ? 'decimal' : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
