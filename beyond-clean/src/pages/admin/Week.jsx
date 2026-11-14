import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { DAY_NAMES_LONG, formatPounds } from '../../../supabase/functions/_shared/pricing.js'
import { addDays, allJobs, mondayOf, todayUK } from '../../../supabase/functions/_shared/schedule.js'
import { CLEAN_TYPES, labelFor } from '../../lib/options.js'
import { ErrorNote, accessSummary, formatDate } from '../../components/ui.jsx'

/** Every clean in a week: plan visits plus booked one-offs, with who is doing it. */
export default function Week({ data, onChange }) {
  const [offset, setOffset] = useState(0)
  const [logs, setLogs] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const [error, setError] = useState('')
  const today = todayUK()
  const start = addDays(mondayOf(today), offset * 7)
  const end = addDays(start, 6)

  useEffect(() => { api.listLogs(start, end).then(setLogs).catch(() => {}) }, [start, end])

  const jobs = useMemo(() => allJobs(data, start, end), [data, start, end])
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    return { date, label: DAY_NAMES_LONG[i], jobs: jobs.filter((j) => j.date === date) }
  })
  const live = jobs.filter((j) => !j.skipped && !j.paused)
  const unassigned = live.filter((j) => !j.cleanerId).length
  const cleanerName = (id) => data.cleaners.find((c) => c.id === id)?.name
  const colour = (id) => data.cleaners.find((c) => c.id === id)?.colour || '#94a3b8'
  const logFor = (j) => logs.find((l) => l.job_key === j.key)

  async function run(fn) {
    setError('')
    try { await fn(); onChange() } catch (e) { setError(e.message) }
  }

  function assign(j, cleanerId) {
    if (j.type === 'oneoff') return run(() => api.updateEnquiry(j.enquiryId, { cleaner_id: cleanerId || null }))
    // Plan clean: cover for this clean only (the regular cleaner is set on the Plans tab).
    const existing = data.changes.find((c) => c.kind === 'cover' && c.subscription_id === j.planId && c.visit_date === j.originalDate && c.visit_start === j.originalStart)
    if (existing) return run(() => (cleanerId && cleanerId !== j.plan.cleaner_id ? api.updateChange(existing.id, { cleaner_id: cleanerId }) : api.deleteChange(existing.id)))
    return run(() => api.addChange({ subscription_id: j.planId, kind: 'cover', visit_date: j.originalDate, visit_start: j.originalStart, cleaner_id: cleanerId || null }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setOffset(offset - 1)} aria-label="Previous week">←</button>
        <div className="flex-1 text-center font-extrabold">
          Week of {formatDate(start, { day: 'numeric', month: 'long' })} <span className="text-slate-500 font-semibold">· {live.length} cleans</span>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => setOffset(offset + 1)} aria-label="Next week">→</button>
      </div>
      {offset !== 0 && <div className="text-center"><button className="btn-ghost btn-sm" onClick={() => setOffset(0)}>Back to this week</button></div>}
      {unassigned > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-semibold">⚠️ {unassigned} clean{unassigned > 1 ? 's have' : ' has'} no cleaner yet. Tap a clean to assign.</div>}
      <ErrorNote>{error}</ErrorNote>

      <div className="grid md:grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.date} className={`card p-2 min-h-24 ${d.date === today ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="text-xs font-extrabold text-slate-500 uppercase px-0.5">{d.label.slice(0, 3)} {formatDate(d.date, { day: 'numeric' })}</div>
            {!d.jobs.length && <div className="text-xs text-slate-400 mt-1 px-0.5">—</div>}
            <ul className="mt-1.5 space-y-1.5">
              {d.jobs.map((j) => {
                const who = j.plan || j.enquiry
                const log = logFor(j)
                const off = j.skipped || j.paused
                return (
                  <li key={j.key}>
                    <button onClick={() => setOpenKey(openKey === j.key ? null : j.key)}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-xs border-l-4 ${off ? 'bg-slate-50 opacity-60' : j.type === 'plan' ? 'bg-brand-50' : 'bg-leaf-100'}`}
                      style={{ borderLeftColor: off ? '#cbd5e1' : colour(j.cleanerId) }}>
                      <div className="font-extrabold flex items-center gap-1">
                        <span className={off ? 'line-through' : ''}>{j.start}{j.end ? `–${j.end}` : ''}</span>
                        {log?.clock_out && <span title="Done">✅</span>}
                        {log?.clock_in && !log.clock_out && <span title="In progress">🧽</span>}
                        {j.movePending && <span title="Move requested">↔️</span>}
                      </div>
                      <div className="font-semibold truncate">{who.name}</div>
                      <div className="text-slate-600 truncate">
                        {j.skipped ? 'Skipped' : j.paused ? 'Plan paused' : j.type === 'plan' ? 'Plan' : labelFor(CLEAN_TYPES, who.clean_type)} · {who.postcode}
                      </div>
                      <div className={`truncate font-bold ${j.cleanerId ? '' : 'text-amber-700'}`}>{cleanerName(j.cleanerId) || 'Unassigned'}</div>
                    </button>
                    {openKey === j.key && (
                      <div className="mt-1 rounded-lg border border-slate-200 bg-white p-2 space-y-2 text-xs">
                        <div>{who.address}, {who.postcode} · <a className="underline" href={`tel:${who.phone}`}>{who.phone}</a></div>
                        {accessSummary(who.access) && <div>🔑 {accessSummary(who.access)}</div>}
                        {j.extras?.length > 0 && <div>➕ {j.extras.map((e) => e.extra_id).join(', ')}</div>}
                        {j.type === 'oneoff' && who.quote_pence && <div>💷 {formatPounds(who.quote_pence)} (paid {formatPounds(who.paid_pence || 0)})</div>}
                        {log && <div>🕒 {log.clock_in ? new Date(log.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–'} to {log.clock_out ? new Date(log.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '…'}{log.notes ? ` · “${log.notes}”` : ''}</div>}
                        {!off && (
                          <label className="block font-bold">Cleaner{j.type === 'plan' ? ' (this clean)' : ''}
                            <select className="field !py-1 !text-xs mt-0.5" value={j.cleanerId || ''} onChange={(e) => assign(j, e.target.value)}>
                              <option value="">Unassigned</option>
                              {data.cleaners.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </label>
                        )}
                        {j.type === 'plan' && !j.paused && (
                          j.skipped
                            ? <button className="btn-secondary btn-sm w-full" onClick={() => {
                              const s = data.changes.find((c) => c.kind === 'skip' && c.subscription_id === j.planId && c.visit_date === j.originalDate && c.visit_start === j.originalStart)
                              if (s?.credit_pence && !confirm(`The customer was credited ${formatPounds(s.credit_pence)} for this skip. Undo it here and charge that back in Stripe if needed. Continue?`)) return
                              if (s) run(() => api.deleteChange(s.id))
                            }}>Put clean back on</button>
                            : <button className="btn-secondary btn-sm w-full" onClick={() => confirm('Skip this clean? No credit is added automatically when you skip it.') && run(() => api.addChange({ subscription_id: j.planId, kind: 'skip', visit_date: j.originalDate, visit_start: j.originalStart, note: 'Skipped by Beyond Clean' }))}>Skip this clean</button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {data.cleaners.filter((c) => c.active).map((c) => <span key={c.id}><span className="inline-block size-2.5 rounded-sm align-middle mr-1" style={{ background: c.colour }} />{c.name}</span>)}
        <span>· blue = plan visit, green = one-off · ✅ done · 🧽 in progress</span>
      </div>
    </div>
  )
}
