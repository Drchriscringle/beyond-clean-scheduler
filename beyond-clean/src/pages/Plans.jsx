import { useEffect, useMemo, useState } from 'react'
import { DEMO, api } from '../lib/api.js'
import {
  DAY_NAMES_LONG, FORTNIGHTLY, WEEKS_PER_MONTH, addHours, applyDiscount, formatPounds, frequencyLabel, inServiceArea, planPrice, slotKey, slotLabel,
  slotsNeeded, validatePlan,
} from '../../supabase/functions/_shared/pricing.js'
import { AccessFields, Choice, CodeField, ErrorNote, Stepper, accessSummary, formatDate } from '../components/ui.jsx'
import { Link } from 'react-router-dom'

const STEPS = ['Your plan', 'Your times', 'Your details', 'Pay']

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Plans({ settings }) {
  const [step, setStep] = useState(0)
  const [visits, setVisits] = useState(settings.visitsPerWeekOptions.includes(1) ? 1 : settings.visitsPerWeekOptions[0])
  const [hours, setHours] = useState(settings.hoursPerVisitOptions[0])
  const [slots, setSlots] = useState([])
  const [availability, setAvailability] = useState(null)
  const minStart = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 3); return isoDate(d) }, [])
  const [d, setD] = useState({ name: '', email: '', phone: '', address: '', postcode: '', notes: '', startDate: minStart, agree: false, access: {}, code: null })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (step === 1) api.getSlotAvailability(settings).then(setAvailability).catch((e) => setError(e.message))
  }, [step, settings])

  const price = planPrice(settings, visits, hours)
  const setDetail = (patch) => { setError(''); setD((x) => ({ ...x, ...patch })) }

  function chooseVisits(v) {
    setVisits(v)
    setSlots((s) => s.slice(0, slotsNeeded(v)))
  }

  function toggleSlot(slot) {
    setError('')
    const on = slots.find((s) => slotKey(s) === slotKey(slot))
    if (on) return setSlots(slots.filter((s) => s !== on))
    const sameDay = slots.find((s) => s.day === slot.day)
    if (sameDay) return setSlots(slots.map((s) => (s === sameDay ? { day: slot.day, start: slot.start } : s)))
    if (slots.length >= slotsNeeded(visits)) {
      // Replace the oldest pick so tapping always does something.
      return setSlots([...slots.slice(1), { day: slot.day, start: slot.start }])
    }
    setSlots([...slots, { day: slot.day, start: slot.start }].sort((a, b) => a.day - b.day))
  }

  function next() {
    let p = ''
    if (step === 1) {
      p = validatePlan(settings, availability || [], { visitsPerWeek: visits, hoursPerVisit: hours, slots })[0] || ''
      if (!p && (!d.startDate || d.startDate < minStart)) p = 'Choose a start date at least 3 days from now.'
    }
    if (step === 2) {
      if (!d.name.trim()) p = 'Please add your name.'
      else if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) p = 'Please add a valid email address.'
      else if (d.phone.replace(/\D/g, '').length < 10) p = 'Please add a phone number we can reach you on.'
      else if (!d.address.trim() || !d.postcode.trim()) p = 'Please add the address and postcode.'
      else if (!inServiceArea(settings, d.postcode)) p = `Sorry, ${d.postcode.toUpperCase()} is outside the area we cover for regular plans. Send us an enquiry and we'll see what we can do.`
    }
    setError(p)
    if (!p) { setStep(step + 1); window.scrollTo(0, 0) }
  }

  async function pay() {
    if (!d.agree) return setError('Please tick to agree to the plan terms.')
    setBusy(true); setError('')
    try {
      const { url } = await api.startPlan({
        visitsPerWeek: visits, hoursPerVisit: hours, slots,
        name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), address: d.address.trim(),
        postcode: d.postcode.toUpperCase().trim(), notes: d.notes.trim(), startDate: d.startDate,
        access: d.access, discountCode: d.code?.code || null,
      })
      window.location.href = url
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const byDay = useMemo(() => {
    const m = new Map()
    for (const a of availability || []) m.set(a.day, [...(m.get(a.day) || []), a])
    return [...m.entries()]
  }, [availability])

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900 mb-1">Regular cleaning plans</h1>
      <p className="text-slate-600 mb-5 text-sm">The same times every week or every 2 weeks. One simple monthly payment. Skip, pause or cancel from your phone.</p>
      <Stepper steps={STEPS} current={step} />

      <div className="card p-4 sm:p-5 space-y-5">
        {step === 0 && (
          <>
            <section>
              <h2 className="label">How often?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {settings.visitsPerWeekOptions.map((v) => {
                  const disc = Number(settings.discounts[v]) || 0
                  return (
                    <Choice key={v} on={visits === v} onClick={() => chooseVisits(v)} className="text-center !px-2">
                      <div className="text-2xl font-extrabold text-brand-900">{v === FORTNIGHTLY ? '2 wks' : `${v}×`}</div>
                      <div className="text-sm font-semibold">{v === FORTNIGHTLY ? 'every 2 weeks' : 'per week'}</div>
                      {disc > 0 && <div className="mt-1 inline-block rounded-full bg-leaf-100 text-leaf-600 text-xs font-extrabold px-2 py-0.5">Save {disc}%</div>}
                    </Choice>
                  )
                })}
              </div>
            </section>
            <section>
              <h2 className="label">How long is each clean?</h2>
              <div className="grid grid-cols-3 gap-2">
                {settings.hoursPerVisitOptions.map((h) => (
                  <Choice key={h} on={hours === h} onClick={() => setHours(h)} className="text-center !px-2">
                    <div className="text-xl font-extrabold text-brand-900">{h} hrs</div>
                    <div className="text-xs text-slate-500">{h <= 2 ? 'Flat / small home' : h === 3 ? '2–3 bed home' : 'Larger home'}</div>
                  </Choice>
                ))}
              </div>
            </section>
            <PriceBox price={price} visits={visits} hours={hours} />
          </>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <h2 className="label mb-0">Pick {slotsNeeded(visits)} time{slotsNeeded(visits) > 1 ? 's' : ''} {visits === FORTNIGHTLY ? 'for your fortnightly clean' : 'each week'}</h2>
              <p className="text-sm text-slate-600">Your cleaner comes at {slotsNeeded(visits) > 1 ? 'these times' : 'this time'} {frequencyLabel(visits)}. Each clean lasts {hours} hours.</p>
            </div>
            {!availability ? <div className="text-slate-500 py-6 text-center">Checking availability…</div> : (
              <div className="space-y-2">
                {byDay.map(([day, daySlots]) => (
                  <div key={day} className="flex items-center gap-2">
                    <div className="w-24 shrink-0 font-bold text-sm">{DAY_NAMES_LONG[day - 1]}</div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => {
                        const on = !!slots.find((x) => slotKey(x) === slotKey(s))
                        const full = s.remaining < 1
                        return (
                          <button key={s.start} type="button" disabled={full && !on} aria-pressed={on} onClick={() => toggleSlot(s)}
                            className={`tile !py-1.5 !px-3 text-sm ${on ? '!bg-brand-600 !border-brand-600 text-white' : ''} ${full ? 'opacity-40 line-through !cursor-not-allowed' : ''}`}>
                            {on && '✓ '}
                            <b>{s.start}–{addHours(s.start, hours)}</b>
                            {!full && s.remaining === 1 && <span className={`ml-1.5 text-xs font-bold ${on ? 'text-white' : 'text-amber-700'}`}>last one</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <b>Chosen:</b> {slots.length ? slots.map((s) => slotLabel(s)).join(', ') : 'none yet'} ({slots.length}/{slotsNeeded(visits)})
            </div>
            <div className="w-56">
              <label className="label" htmlFor="start">First week starting</label>
              <input id="start" type="date" className="field" min={minStart} value={d.startDate} onChange={(e) => setDetail({ startDate: e.target.value })} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="grid gap-3">
            <div><label className="label" htmlFor="pname">Your name</label>
              <input id="pname" className="field" autoComplete="name" value={d.name} onChange={(e) => setDetail({ name: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label" htmlFor="pphone">Mobile</label>
                <input id="pphone" type="tel" className="field" autoComplete="tel" value={d.phone} onChange={(e) => setDetail({ phone: e.target.value })} /></div>
              <div><label className="label" htmlFor="pemail">Email</label>
                <input id="pemail" type="email" className="field" autoComplete="email" value={d.email} onChange={(e) => setDetail({ email: e.target.value })} /></div>
            </div>
            <div><label className="label" htmlFor="paddr">Address to be cleaned</label>
              <input id="paddr" className="field" autoComplete="street-address" value={d.address} onChange={(e) => setDetail({ address: e.target.value })} /></div>
            <div className="w-40"><label className="label" htmlFor="ppc">Postcode</label>
              <input id="ppc" className="field uppercase" autoComplete="postal-code" value={d.postcode} onChange={(e) => setDetail({ postcode: e.target.value })} /></div>
            <div><label className="label" htmlFor="pnotes">Access, pets, priorities <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea id="pnotes" rows={3} className="field" value={d.notes} onChange={(e) => setDetail({ notes: e.target.value })} /></div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="font-bold mb-2">🔑 Access, pets & parking <span className="font-normal text-slate-500 text-sm">(optional, you can add this later)</span></div>
              <AccessFields value={d.access} onChange={(access) => setDetail({ access })} />
            </div>
            <CodeField kind="plan" applied={d.code} onApplied={(code) => setDetail({ code })} />
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="font-extrabold text-lg">Your plan</h2>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[15px]">
              {[
                ['Cleans', `${hours} hours, ${frequencyLabel(visits)}`],
                ['Times', slots.map((s) => `${slotLabel(s, true)} ${s.start}–${addHours(s.start, hours)}`).join(' · ')],
                ['Starting', formatDate(d.startDate, { weekday: 'long', day: 'numeric', month: 'long' })],
                ['Address', `${d.address}, ${d.postcode.toUpperCase()}`],
                ['Contact', `${d.name} · ${d.phone} · ${d.email}`],
                ...(accessSummary(d.access) ? [['Access', accessSummary(d.access)]] : []),
                ...(d.code ? [['Code', `${d.code.code}: ${d.code.description}${d.code.first_payment_only ? ' (first month)' : ''}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 px-3 py-2">
                  <dt className="text-slate-500 text-sm font-semibold">{k}</dt><dd>{v}</dd>
                </div>
              ))}
            </dl>
            <PriceBox price={price} visits={visits} hours={hours} />
            {d.code && (
              <p className="rounded-xl bg-leaf-100 px-3 py-2 text-sm font-semibold">
                🏷️ With {d.code.code}, your {d.code.first_payment_only ? 'first month' : 'monthly price'} is {formatPounds(applyDiscount(price.monthlyPence, d.code))}.
              </p>
            )}
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="size-5 mt-0.5 accent-brand-600" checked={d.agree} onChange={(e) => setDetail({ agree: e.target.checked })} />
              <span>
                I agree to pay {formatPounds(price.monthlyPence)} every month until I cancel. I can cancel any time and it stops at the end of the month I've paid for.
                Cleans skipped with {settings.skipNoticeHours} hours' notice come off my next bill. <Link to="/policies" className="underline" target="_blank">Policies</Link>
              </span>
            </label>
            {DEMO && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">Demo mode: no card is needed and nothing is charged.</p>}
          </section>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-2 pt-1">
          {step > 0 && <button type="button" className="btn-secondary" onClick={() => { setError(''); setStep(step - 1) }}>Back</button>}
          {step < STEPS.length - 1
            ? <button type="button" className="btn-primary flex-1" onClick={next}>Continue</button>
            : <button type="button" className="btn-leaf flex-1" disabled={busy} onClick={pay}>{busy ? 'Opening secure payment…' : `Pay ${formatPounds(price.monthlyPence)} / month`}</button>}
        </div>
        {step === 3 && <p className="text-xs text-center text-slate-500">🔒 Card payments are handled securely by Stripe.</p>}
      </div>
    </div>
  )
}

function PriceBox({ price, visits, hours }) {
  return (
    <div className="rounded-2xl bg-brand-900 text-white p-4 flex items-end justify-between gap-3">
      <div>
        <div className="text-sm opacity-80">Monthly price</div>
        <div className="text-3xl font-extrabold">{formatPounds(price.monthlyPence)}<span className="text-base font-bold opacity-80"> /month</span></div>
        <div className="text-xs opacity-80 mt-0.5">
          {hours} hrs {frequencyLabel(visits)} · about {formatPounds(price.effectivePerVisitPence)} per clean
        </div>
      </div>
      {price.savingPence > 0 && (
        <div className="rounded-xl bg-leaf-500 text-brand-900 px-2.5 py-1.5 text-center text-xs font-extrabold leading-tight">
          You save<br /><span className="text-base">{formatPounds(price.savingPence)}</span>/mo
        </div>
      )}
      <span className="sr-only">Billed monthly, averaged over {WEEKS_PER_MONTH.toFixed(2)} weeks per month.</span>
    </div>
  )
}
