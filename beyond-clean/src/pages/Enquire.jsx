import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { AREAS, CLEAN_TYPES, EXTRAS, PROPERTY_TYPES, TIME_WINDOWS, labelFor } from '../lib/options.js'
import { Choice, Counter, ErrorNote, Stepper, formatDate } from '../components/ui.jsx'

const STEPS = ['Property', 'Type of clean', 'Dates', 'Your details', 'Check & send']
const MAX_PREFS = 3

function nextDays(n, closedDays) {
  const out = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  while (out.length < n) {
    d.setDate(d.getDate() + 1)
    const isoDay = d.getDay() === 0 ? 7 : d.getDay()
    if (!closedDays.includes(isoDay)) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
  }
  return out
}

const EMPTY = {
  property_type: '', bedrooms: 2, bathrooms: 1, areas: [], extras: [],
  clean_type: '', preferred: [], flexible: false,
  name: '', email: '', phone: '', address: '', postcode: '', contact_pref: 'phone', notes: '',
}

export default function Enquire({ settings }) {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [f, setF] = useState(EMPTY)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const days = useMemo(() => nextDays(28, settings.closedDays || []), [settings.closedDays])
  const set = (patch) => { setError(''); setF((x) => ({ ...x, ...patch })) }
  const toggle = (k, id) => set({ [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] })

  const problems = [
    () => (!f.property_type ? 'Choose the type of property.' : !f.areas.length ? 'Choose at least one area to clean.' : ''),
    () => (!f.clean_type ? 'Choose the type of clean.' : ''),
    () => (!f.flexible && !f.preferred.length ? 'Pick at least one date, or tick “I’m flexible”.' : ''),
    () => {
      if (!f.name.trim()) return 'Please add your name.'
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Please add a valid email address.'
      if (f.phone.replace(/\D/g, '').length < 10) return 'Please add a phone number we can reach you on.'
      if (!f.address.trim() || !f.postcode.trim()) return 'Please add the address and postcode.'
      return ''
    },
    () => '',
  ]

  function next() {
    const p = problems[step]()
    setError(p)
    if (!p) { setStep(step + 1); window.scrollTo(0, 0) }
  }

  async function submit() {
    setSending(true); setError('')
    try {
      const { token } = await api.submitEnquiry({ ...f, postcode: f.postcode.toUpperCase().trim() })
      nav(`/enquiry/${token}?new=1`)
    } catch (e) {
      setError(e.message)
      setSending(false)
    }
  }

  function togglePref(date, window) {
    const exists = f.preferred.find((p) => p.date === date && p.window === window)
    if (exists) return set({ preferred: f.preferred.filter((p) => p !== exists) })
    const sameDate = f.preferred.find((p) => p.date === date)
    if (sameDate) return set({ preferred: f.preferred.map((p) => (p === sameDate ? { date, window } : p)) })
    if (f.preferred.length >= MAX_PREFS) return setError(`You can pick up to ${MAX_PREFS} options. Remove one to add another.`)
    setError('')
    set({ preferred: [...f.preferred, { date, window }].sort((a, b) => a.date.localeCompare(b.date)) })
  }
  const [openDate, setOpenDate] = useState('')

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900 mb-1">Get a free quote</h1>
      <p className="text-slate-600 mb-5 text-sm">Takes about a minute. No payment needed.</p>
      <Stepper steps={STEPS} current={step} />

      <div className="card p-4 sm:p-5 space-y-5">
        {step === 0 && (
          <>
            <section>
              <h2 className="label">What kind of property is it?</h2>
              <div className="grid grid-cols-2 gap-2">
                {PROPERTY_TYPES.map((p) => (
                  <Choice key={p.id} on={f.property_type === p.id} onClick={() => set({ property_type: p.id })}>
                    <span className="text-xl mr-1.5">{p.icon}</span><span className="font-bold">{p.label}</span>
                  </Choice>
                ))}
              </div>
            </section>
            {f.property_type !== 'office' && (
              <section className="grid sm:grid-cols-2 gap-2">
                <Counter label="Bedrooms" value={f.bedrooms} onChange={(v) => set({ bedrooms: v })} max={8} />
                <Counter label="Bathrooms" value={f.bathrooms} onChange={(v) => set({ bathrooms: v })} min={1} max={6} />
              </section>
            )}
            <section>
              <h2 className="label">What would you like cleaned?</h2>
              <div className="grid grid-cols-2 gap-2">
                {AREAS.map((a) => (
                  <Choice key={a.id} on={f.areas.includes(a.id)} onClick={() => toggle('areas', a.id)}>
                    <span className="font-semibold">{f.areas.includes(a.id) ? '✓ ' : ''}{a.label}</span>
                  </Choice>
                ))}
              </div>
            </section>
            <section>
              <h2 className="label">Any extras? <span className="font-normal text-slate-500">(optional)</span></h2>
              <div className="flex flex-wrap gap-2">
                {EXTRAS.map((a) => (
                  <Choice key={a.id} className="!py-2 !px-3 text-sm" on={f.extras.includes(a.id)} onClick={() => toggle('extras', a.id)}>
                    {f.extras.includes(a.id) ? '✓ ' : '+ '}{a.label}
                  </Choice>
                ))}
              </div>
            </section>
          </>
        )}

        {step === 1 && (
          <section>
            <h2 className="label">What type of clean do you need?</h2>
            <div className="grid gap-2">
              {CLEAN_TYPES.map((c) => (
                <Choice key={c.id} on={f.clean_type === c.id} onClick={() => set({ clean_type: c.id })}>
                  <div className="font-bold">{c.label}</div>
                  <div className="text-sm text-slate-600">{c.desc}</div>
                </Choice>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-3">
              Want this every week? <a className="underline font-semibold text-brand-700" href="#/plans">See our regular cleaning plans</a>.
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <div>
              <h2 className="label mb-0">When would suit you?</h2>
              <p className="text-sm text-slate-600">Pick up to {MAX_PREFS} dates and a time of day for each. We'll confirm one with you.</p>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 px-1 snap-x">
              {days.map((d) => {
                const chosen = f.preferred.find((p) => p.date === d)
                const [wd, ...rest] = formatDate(d).split(' ')
                return (
                  <button key={d} type="button" onClick={() => setOpenDate(openDate === d ? '' : d)}
                    className={`snap-start shrink-0 w-16 rounded-xl border-2 py-2 text-center transition ${chosen ? 'border-brand-600 bg-brand-600 text-white' : openDate === d ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                    <div className="text-xs font-bold opacity-80">{wd.replace(',', '')}</div>
                    <div className="text-lg font-extrabold leading-tight">{rest[0]}</div>
                    <div className="text-xs">{rest[1]}</div>
                  </button>
                )
              })}
            </div>
            {openDate && (
              <div className="rounded-xl bg-brand-50 p-3">
                <div className="text-sm font-bold mb-2">{formatDate(openDate, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_WINDOWS.map((w) => {
                    const on = !!f.preferred.find((p) => p.date === openDate && p.window === w.id)
                    return (
                      <Choice key={w.id} on={on} onClick={() => togglePref(openDate, w.id)} className="!py-2 text-center">
                        <div className="font-bold text-sm">{w.label}</div>
                        <div className="text-xs text-slate-500">{w.hint}</div>
                      </Choice>
                    )
                  })}
                </div>
              </div>
            )}
            {f.preferred.length > 0 && (
              <div>
                <div className="label">Your choices</div>
                <ul className="space-y-1.5">
                  {f.preferred.map((p, i) => (
                    <li key={p.date} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <span><span className="text-slate-400 font-bold mr-2">{i + 1}.</span>
                        <b>{formatDate(p.date, { weekday: 'long', day: 'numeric', month: 'short' })}</b> · {labelFor(TIME_WINDOWS, p.window)}</span>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => togglePref(p.date, p.window)} aria-label="Remove">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-brand-600" checked={f.flexible} onChange={(e) => set({ flexible: e.target.checked })} />
              I'm flexible, any time in the next couple of weeks is fine
            </label>
          </section>
        )}

        {step === 3 && (
          <section className="grid gap-3">
            <div><label className="label" htmlFor="name">Your name</label>
              <input id="name" className="field" autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label" htmlFor="phone">Mobile</label>
                <input id="phone" className="field" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
              <div><label className="label" htmlFor="email">Email</label>
                <input id="email" className="field" type="email" autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
            </div>
            <div><label className="label" htmlFor="address">Address to be cleaned</label>
              <input id="address" className="field" autoComplete="street-address" value={f.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div className="w-40"><label className="label" htmlFor="postcode">Postcode</label>
              <input id="postcode" className="field uppercase" autoComplete="postal-code" value={f.postcode} onChange={(e) => set({ postcode: e.target.value })} /></div>
            <div>
              <span className="label">Best way to reach you</span>
              <div className="grid grid-cols-3 gap-2">
                {[['phone', 'Call'], ['text', 'Text / WhatsApp'], ['email', 'Email']].map(([id, l]) => (
                  <Choice key={id} on={f.contact_pref === id} onClick={() => set({ contact_pref: id })} className="!py-2 text-center text-sm font-bold">{l}</Choice>
                ))}
              </div>
            </div>
            <div><label className="label" htmlFor="notes">Anything else? <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea id="notes" rows={3} className="field" placeholder="Pets, parking, access, problem areas…" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-3 text-[15px]">
            <h2 className="font-extrabold text-lg">Check your enquiry</h2>
            <Summary f={f} />
            <p className="text-xs text-slate-500">
              By sending this you agree to Beyond Clean contacting you about this enquiry. We never share your details.
            </p>
          </section>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-2 pt-1">
          {step > 0 && <button type="button" className="btn-secondary" onClick={() => { setError(''); setStep(step - 1) }}>Back</button>}
          {step < STEPS.length - 1
            ? <button type="button" className="btn-primary flex-1" onClick={next}>Continue</button>
            : <button type="button" className="btn-leaf flex-1" disabled={sending} onClick={submit}>{sending ? 'Sending…' : 'Send enquiry'}</button>}
        </div>
      </div>
    </div>
  )
}

export function Summary({ f }) {
  const rows = [
    ['Property', `${labelFor(PROPERTY_TYPES, f.property_type)}${f.property_type !== 'office' ? ` · ${f.bedrooms} bed · ${f.bathrooms} bath` : ''}`],
    ['Areas', f.areas.map((a) => labelFor(AREAS, a)).join(', ')],
    ['Extras', f.extras.length ? f.extras.map((a) => labelFor(EXTRAS, a)).join(', ') : 'None'],
    ['Type of clean', labelFor(CLEAN_TYPES, f.clean_type)],
    ['Preferred times', [
      ...(f.preferred || []).map((p) => `${formatDate(p.date)} (${labelFor(TIME_WINDOWS, p.window).toLowerCase()})`),
      ...(f.flexible ? ['Flexible'] : []),
    ].join(' · ')],
    ['Name', f.name],
    ['Contact', `${f.phone} · ${f.email} (prefers ${f.contact_pref})`],
    ['Address', `${f.address}, ${String(f.postcode).toUpperCase()}`],
    ...(f.notes ? [['Notes', f.notes]] : []),
  ]
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
          <dt className="text-slate-500 text-sm font-semibold">{k}</dt><dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
