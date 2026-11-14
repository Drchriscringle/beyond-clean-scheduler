import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { DAY_NAMES_LONG, FORTNIGHTLY, estimateOneOff, formatPounds, frequencyLabel, planPrice } from '../../../supabase/functions/_shared/pricing.js'
import { CLEAN_TYPES, EXTRAS } from '../../lib/options.js'
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
      const num = (v) => Number(v) || 0
      const clean = {
        ...s, hourlyRate: num(s.hourlyRate), slotCapacity: Math.max(1, num(s.slotCapacity)),
        depositPercent: num(s.depositPercent), cancelNoticeHours: num(s.cancelNoticeHours), lateCancelPercent: num(s.lateCancelPercent),
        skipNoticeHours: num(s.skipNoticeHours), referralRewardPence: num(s.referralRewardPence),
        serviceAreas: (typeof s.serviceAreas === 'string' ? s.serviceAreas.split(',') : s.serviceAreas).map((a) => a.trim().toUpperCase()).filter(Boolean),
        oneOff: { ...s.oneOff, hourlyRate: num(s.oneOff.hourlyRate), minimumPence: num(s.oneOff.minimumPence), baseHours: num(s.oneOff.baseHours),
          perBedroomHours: num(s.oneOff.perBedroomHours), perBathroomHours: num(s.oneOff.perBathroomHours),
          multipliers: Object.fromEntries(Object.entries(s.oneOff.multipliers).map(([k, v]) => [k, num(v)])) },
        extras: Object.fromEntries(Object.entries(s.extras).map(([k, v]) => [k, num(v)])),
      }
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
          <Field label="Google review link" value={s.googleReviewUrl} onChange={(v) => set({ googleReviewUrl: v })} />
          <Field label="Postcode areas you cover (comma separated)" value={Array.isArray(s.serviceAreas) ? s.serviceAreas.join(', ') : s.serviceAreas}
            onChange={(v) => set({ serviceAreas: v })} />
        </div>
        <p className="text-xs text-slate-500">Postcode areas: "KA" covers all of KA; "KA7, KA8" covers just those districts. Leave empty to accept anywhere. Happy customers (4–5 stars) are offered the Google review link.</p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-extrabold text-lg">Plan pricing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="£ per hour" type="number" value={s.hourlyRate} onChange={(v) => set({ hourlyRate: v })} />
          {s.visitsPerWeekOptions.map((v) => (
            <Field key={v} label={`${frequencyLabel(v, true)} discount %`} type="number" value={s.discounts[v] ?? 0}
              onChange={(x) => set({ discounts: { ...s.discounts, [v]: Number(x) || 0 } })} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Monthly price</th>{s.hoursPerVisitOptions.map((h) => <th key={h}>{h} hrs</th>)}</tr></thead>
            <tbody>
              {s.visitsPerWeekOptions.map((v) => (
                <tr key={v} className="border-t border-slate-100">
                  <td className="py-1.5 font-bold">{frequencyLabel(v, true)}</td>
                  {s.hoursPerVisitOptions.map((h) => <td key={h}>{formatPounds(planPrice({ ...s, hourlyRate: Number(s.hourlyRate) }, v, h).monthlyPence)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-brand-600" checked={s.visitsPerWeekOptions.includes(FORTNIGHTLY)}
            onChange={(e) => set({ visitsPerWeekOptions: e.target.checked ? [FORTNIGHTLY, ...s.visitsPerWeekOptions.filter((v) => v !== FORTNIGHTLY)] : s.visitsPerWeekOptions.filter((v) => v !== FORTNIGHTLY) })} />
          Offer fortnightly plans
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Skip notice (hours) for a credit" type="number" value={s.skipNoticeHours} onChange={(v) => set({ skipNoticeHours: v })} />
          <Field label="Referral reward £ (each side)" type="number" value={s.referralRewardPence / 100} onChange={(v) => set({ referralRewardPence: Math.round(parseFloat(v) * 100) || 0 })} />
          <label className="flex items-center gap-2 text-sm font-semibold mt-6">
            <input type="checkbox" className="size-5 accent-brand-600" checked={s.skipCredit} onChange={(e) => set({ skipCredit: e.target.checked })} /> Credit skipped cleans
          </label>
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

      <OneOffPricing s={s} set={set} />

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

      <Checklists s={s} set={set} />

      <ErrorNote>{error}</ErrorNote>
      {msg && <div role="status" className="rounded-xl bg-leaf-100 px-3 py-2 text-sm font-semibold">{msg}</div>}
      <div className="flex gap-2 sticky bottom-3">
        <button className="btn-primary flex-1 shadow-lg" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button>
        <button className="btn-secondary" onClick={ding}>Test alert sound</button>
      </div>

      <Codes />
    </div>
  )
}

function OneOffPricing({ s, set }) {
  const o = s.oneOff
  const setO = (patch) => set({ oneOff: { ...o, ...patch } })
  const sample = estimateOneOff({ ...s, oneOff: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? v : Number(v)])) },
    { property_type: 'house', clean_type: 'regular', bedrooms: 3, bathrooms: 1, extras: [] })
  return (
    <section className="card p-4 space-y-3">
      <h2 className="font-extrabold text-lg">One-off prices (instant estimate)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="£ per hour" type="number" value={o.hourlyRate} onChange={(v) => setO({ hourlyRate: v })} />
        <Field label="Minimum charge £" type="number" value={o.minimumPence / 100} onChange={(v) => setO({ minimumPence: Math.round(parseFloat(v) * 100) || 0 })} />
        <Field label="Base hours" type="number" value={o.baseHours} onChange={(v) => setO({ baseHours: v })} />
        <Field label="Hours per bedroom" type="number" value={o.perBedroomHours} onChange={(v) => setO({ perBedroomHours: v })} />
        <Field label="Hours per bathroom" type="number" value={o.perBathroomHours} onChange={(v) => setO({ perBathroomHours: v })} />
      </div>
      <div>
        <div className="label">How much longer than a standard clean (× hours, 0 = always quote by hand)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CLEAN_TYPES.map((c) => (
            <Field key={c.id} label={c.label} type="number" value={o.multipliers[c.id] ?? 0} onChange={(v) => setO({ multipliers: { ...o.multipliers, [c.id]: v } })} />
          ))}
        </div>
      </div>
      <div>
        <div className="label">Extras £ (one-offs and added to plan cleans)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EXTRAS.map((x) => (
            <Field key={x.id} label={x.label} type="number" value={(s.extras[x.id] ?? 0) / 100} onChange={(v) => set({ extras: { ...s.extras, [x.id]: Math.round(parseFloat(v) * 100) || 0 } })} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Deposit % (0 = none)" type="number" value={s.depositPercent} onChange={(v) => set({ depositPercent: v })} />
        <Field label="Free cancellation (hours' notice)" type="number" value={s.cancelNoticeHours} onChange={(v) => set({ cancelNoticeHours: v })} />
        <Field label="Late cancellation charge %" type="number" value={s.lateCancelPercent} onChange={(v) => set({ lateCancelPercent: v })} />
      </div>
      {sample && <p className="text-sm text-slate-600">Example: a standard clean of a 3-bed, 1-bath house shows <b>{formatPounds(sample.lowPence)}–{formatPounds(sample.highPence)}</b> (about {sample.hours} hrs).</p>}
    </section>
  )
}

function Checklists({ s, set }) {
  const [type, setType] = useState('regular')
  const list = s.checklists[type] || []
  return (
    <section className="card p-4 space-y-3">
      <h2 className="font-extrabold text-lg">Cleaner checklists</h2>
      <p className="text-sm text-slate-600">What your cleaners tick off in the cleaner app. Regular plan cleans use the standard list.</p>
      <select className="field !w-auto" value={type} onChange={(e) => setType(e.target.value)}>
        {CLEAN_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <textarea className="field" rows={Math.max(4, list.length + 1)} value={list.join('\n')}
        onChange={(e) => set({ checklists: { ...s.checklists, [type]: e.target.value.split('\n') } })} aria-label="Checklist, one item per line" />
      <p className="text-xs text-slate-500">One item per line.</p>
    </section>
  )
}

const NEW_CODE = { code: '', description: '', kind: 'percent', amount: 10, applies_to: 'any', first_payment_only: true, max_uses: '', active: true }

function Codes() {
  const [codes, setCodes] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const load = () => api.listCodes().then(setCodes).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function save() {
    const code = form.code.trim().toUpperCase().replace(/\s+/g, '')
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) return setError('Codes are 3–20 letters or numbers.')
    if (!(Number(form.amount) > 0)) return setError('Add an amount.')
    setError('')
    try {
      await api.saveCode({
        code, description: form.description || null, applies_to: form.applies_to, first_payment_only: form.first_payment_only, active: form.active,
        percent_off: form.kind === 'percent' ? Math.round(Number(form.amount)) : null,
        amount_off_pence: form.kind === 'amount' ? Math.round(Number(form.amount) * 100) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
      })
      setForm(null); load()
    } catch (e) { setError(e.message) }
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center">
        <h2 className="font-extrabold text-lg flex-1">Discount codes</h2>
        <button className="btn-secondary btn-sm" onClick={() => setForm(NEW_CODE)}>+ New code</button>
      </div>
      <p className="text-sm text-slate-600">Share codes on flyers, Facebook or with landlords. Plan customers also get their own referral code automatically.</p>
      <ul className="divide-y divide-slate-100">
        {codes.map((c) => (
          <li key={c.code} className={`py-2 flex items-center gap-2 ${c.active ? '' : 'opacity-50'}`}>
            <code className="font-extrabold">{c.code}</code>
            <span className="text-sm flex-1">{c.percent_off ? `${c.percent_off}% off` : formatPounds(c.amount_off_pence) + ' off'} · {c.applies_to === 'any' ? 'all' : c.applies_to === 'plan' ? 'plans' : 'one-offs'} · used {c.uses}{c.max_uses ? `/${c.max_uses}` : ''}</span>
            <button className="btn-ghost btn-sm" onClick={() => api.saveCode({ ...c, active: !c.active }).then(load)}>{c.active ? 'Turn off' : 'Turn on'}</button>
          </li>
        ))}
      </ul>
      {form && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Field label="Description (optional)" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <label className="block"><span className="label">Type</span>
              <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="percent">% off</option><option value="amount">£ off</option>
              </select></label>
            <Field label={form.kind === 'percent' ? 'Percent' : 'Pounds'} type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            <label className="block"><span className="label">For</span>
              <select className="field" value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })}>
                <option value="any">Everything</option><option value="plan">Plans only</option><option value="oneoff">One-offs only</option>
              </select></label>
            <Field label="Max uses (optional)" type="number" value={form.max_uses} onChange={(v) => setForm({ ...form, max_uses: v })} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-brand-600" checked={form.first_payment_only} onChange={(e) => setForm({ ...form, first_payment_only: e.target.checked })} />
            Plans: first month only (untick for every month)
          </label>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={save}>Save code</button><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </section>
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
