import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEMO, api } from '../../lib/api.js'
import { addDays, oneOffJobs, planVisits, todayUK } from '../../../supabase/functions/_shared/schedule.js'
import { AREAS, CLEAN_TYPES, EXTRAS, PROPERTY_TYPES, labelFor } from '../../lib/options.js'
import { DemoBanner, ErrorNote, Logo, PhotoPicker, Spinner, accessSummary, formatDate } from '../../components/ui.jsx'

export default function CleanerApp({ settings }) {
  const [sched, setSched] = useState(undefined)
  const load = useCallback(() => api.cleanerSchedule().then(setSched).catch(() => setSched(null)), [])
  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen">
      {DEMO && <DemoBanner />}
      <header className="bg-brand-900 text-white sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-2">
          <Logo size={34} />
          <span className="font-extrabold flex-1">Beyond Clean <span className="font-semibold opacity-70">· {sched?.me?.name || 'Team'}</span></span>
          {sched && <button className="text-sm opacity-80" onClick={async () => { await api.signOut(); setSched(null) }}>Sign out</button>}
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-4">
        {sched === undefined ? <Spinner /> : sched ? <Jobs sched={sched} settings={settings} reload={load} /> : <CleanerSignIn onIn={load} />}
      </main>
    </div>
  )
}

function CleanerSignIn({ onIn }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [team, setTeam] = useState([])
  useEffect(() => { if (DEMO) api.listCleaners().then(setTeam) }, [])

  async function go(fn) {
    setError('')
    try { await fn() } catch (e) { setError(e.message) }
  }

  if (DEMO) {
    return (
      <div className="card p-5 space-y-3">
        <h1 className="font-extrabold text-xl">Cleaner sign in</h1>
        <p className="text-sm text-slate-600">Demo mode: choose who you are.</p>
        {team.map((c) => <button key={c.id} className="btn-secondary w-full" onClick={() => go(async () => { await api.signIn(c.id); onIn() })}>{c.name}</button>)}
      </div>
    )
  }
  return (
    <div className="card p-5 space-y-4">
      <h1 className="font-extrabold text-xl">Cleaner sign in</h1>
      {!sent ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(async () => { await api.sendCode(email.trim()); setSent(true) }) }}>
          <label className="block"><span className="label">Your email</span>
            <input type="email" required className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn-primary w-full">Email me a code</button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(async () => { await api.verifyCode(email.trim(), code.trim()); onIn() }) }}>
          <label className="block"><span className="label">6-digit code sent to {email}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field text-center text-xl tracking-[.4em] font-bold" value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <button className="btn-primary w-full">Sign in</button>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
      <p className="text-xs text-slate-500">Use the email address Beyond Clean has for you. If it says you're not set up, ask the office to add you on the Team page.</p>
    </div>
  )
}

function Jobs({ sched, settings, reload }) {
  const [logs, setLogs] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const loadLogs = useCallback(() => api.myLogs().then(setLogs).catch(() => {}), [])
  useEffect(() => { loadLogs() }, [loadLogs])

  const today = todayUK()
  const jobs = useMemo(() => {
    const from = addDays(today, -1)
    const to = addDays(today, 13)
    const list = []
    for (const p of sched.plans) {
      if (p.status === 'paused') continue
      for (const v of planVisits(p, sched.changes.filter((c) => c.subscription_id === p.id), from, to)) {
        if (!v.skipped && v.cleanerId === sched.me.id) list.push({ ...v, who: p, cleanType: 'regular' })
      }
    }
    for (const j of oneOffJobs(sched.enquiries, from, to)) {
      const e = sched.enquiries.find((x) => x.id === j.enquiryId)
      list.push({ ...j, who: e, cleanType: e.clean_type })
    }
    return list.sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
  }, [sched, today])

  const open = jobs.find((j) => j.key === openKey)
  if (open) return <JobDetail job={open} me={sched.me} settings={settings} log={logs.find((l) => l.job_key === open.key)} onBack={() => setOpenKey(null)} onSaved={() => { loadLogs(); reload() }} />

  const byDay = jobs.reduce((acc, j) => { (acc[j.date] = acc[j.date] || []).push(j); return acc }, {})
  return (
    <div className="space-y-4">
      {!jobs.length && <div className="card p-6 text-center text-slate-500">No cleans booked for you in the next two weeks.</div>}
      {Object.entries(byDay).map(([date, list]) => (
        <section key={date}>
          <h2 className={`font-extrabold mb-1.5 ${date === today ? 'text-brand-700' : ''}`}>
            {date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
          <ul className="space-y-2">
            {list.map((j) => {
              const log = logs.find((l) => l.job_key === j.key)
              return (
                <li key={j.key}>
                  <button className="card w-full text-left p-3 flex items-center gap-3 hover:border-brand-500" onClick={() => setOpenKey(j.key)}>
                    <div className="text-center w-14 shrink-0">
                      <div className="font-extrabold">{j.start || '—'}</div>
                      <div className="text-xs text-slate-500">{j.end || ''}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{j.who.name}</div>
                      <div className="text-sm text-slate-600 truncate">{j.who.address}, {j.who.postcode}</div>
                      <div className="text-xs text-slate-500">{j.type === 'plan' ? 'Regular clean' : labelFor(CLEAN_TYPES, j.cleanType)}{j.extras?.length ? ` + ${j.extras.length} extra` : ''}</div>
                    </div>
                    <span className="text-xl">{log?.clock_out ? '✅' : log?.clock_in ? '🧽' : '›'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function JobDetail({ job, me, settings, log, onBack, onSaved }) {
  const who = job.who
  const items = [...(settings.checklists[job.cleanType] || settings.checklists.regular || []),
    ...(job.extras || []).map((e) => `Extra: ${labelFor(EXTRAS, e.extra_id)}`),
    ...(job.type === 'oneoff' ? (who.extras || []).map((x) => `Extra: ${labelFor(EXTRAS, x)}`) : [])].filter(Boolean)
  const [checklist, setChecklist] = useState(log?.checklist || {})
  const [notes, setNotes] = useState(log?.notes || '')
  const [before, setBefore] = useState([])
  const [after, setAfter] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const access = accessSummary(who.access)

  useEffect(() => {
    const toPreview = (paths) => Promise.all((paths || []).map(async (p) => ({ path: p, preview: await api.photoUrl('job-photos', p) })))
    toPreview(log?.photos_before).then(setBefore)
    toPreview(log?.photos_after).then(setAfter)
  }, [log])

  async function save(patch = {}) {
    setBusy(true); setError('')
    try {
      await api.saveLog({
        job_key: job.key, job_date: job.date, cleaner_id: me.id,
        subscription_id: job.type === 'plan' ? job.planId : null, enquiry_id: job.type === 'oneoff' ? job.enquiryId : null,
        checklist, notes, photos_before: before.map((p) => p.path), photos_after: after.map((p) => p.path),
        clock_in: log?.clock_in || null, clock_out: log?.clock_out || null, ...patch,
      })
      onSaved()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const done = items.filter((i) => checklist[i]).length
  const upload = (name) => (blob) => api.uploadJobPhoto(blob, job.key, name)

  return (
    <div className="space-y-3">
      <button className="btn-ghost btn-sm -ml-2" onClick={onBack}>← My cleans</button>
      <div className="card p-4 space-y-2">
        <div className="text-sm font-bold text-brand-700">{formatDate(job.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {job.start}{job.end ? `–${job.end}` : ''}</div>
        <h1 className="text-xl font-extrabold">{who.name}</h1>
        <p>{who.address}, {who.postcode}</p>
        <div className="grid grid-cols-2 gap-2">
          <a className="btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(`${who.address}, ${who.postcode}`)}`}>🗺️ Directions</a>
          <a className="btn-secondary btn-sm" href={`tel:${who.phone}`}>📞 Call</a>
        </div>
        {access && <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm"><b>🔑 Access:</b> {access}</div>}
        {who.notes && <p className="text-sm rounded-xl bg-slate-50 px-3 py-2"><b>Notes:</b> {who.notes}</p>}
        {job.type === 'oneoff' && (
          <p className="text-sm text-slate-600">
            {labelFor(CLEAN_TYPES, who.clean_type)} · {labelFor(PROPERTY_TYPES, who.property_type)} · {who.bedrooms} bed · {who.bathrooms} bath<br />
            Areas: {(who.areas || []).map((a) => labelFor(AREAS, a)).join(', ')}
          </p>
        )}
      </div>

      <div className="card p-4 flex items-center gap-3">
        {!log?.clock_in && <button className="btn-leaf flex-1" disabled={busy} onClick={() => save({ clock_in: new Date().toISOString() })}>▶ Start clean</button>}
        {log?.clock_in && !log.clock_out && (
          <>
            <span className="text-sm flex-1">Started {new Date(log.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <button className="btn-primary" disabled={busy} onClick={() => (done < items.length && !confirm(`${items.length - done} checklist item(s) not ticked. Finish anyway?`) ? null : save({ clock_out: new Date().toISOString() }))}>■ Finish</button>
          </>
        )}
        {log?.clock_out && (
          <span className="font-semibold text-leaf-600">✅ Done {new Date(log.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–{new Date(log.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      <div className="card p-4 space-y-2">
        <div className="flex items-center"><h2 className="font-extrabold flex-1">Checklist</h2><span className="text-sm text-slate-500">{done}/{items.length}</span></div>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i}>
              <label className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <input type="checkbox" className="size-6 accent-leaf-600" checked={!!checklist[i]} onChange={(e) => setChecklist({ ...checklist, [i]: e.target.checked })} />
                <span className={checklist[i] ? 'line-through text-slate-400' : ''}>{i}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4 space-y-3">
        <div><h2 className="font-extrabold mb-1">Before photos</h2><PhotoPicker value={before} onChange={setBefore} upload={upload('before')} max={6} /></div>
        <div><h2 className="font-extrabold mb-1">After photos</h2><PhotoPicker value={after} onChange={setAfter} upload={upload('after')} max={6} /></div>
        <label className="block"><span className="label">Notes for the office</span>
          <textarea rows={2} className="field" placeholder="Anything broken, low on supplies, customer requests…" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full sticky bottom-3 shadow-lg" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
  )
}
