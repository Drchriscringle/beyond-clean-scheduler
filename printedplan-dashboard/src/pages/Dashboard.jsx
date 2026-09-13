import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useQuery } from '../hooks/useQuery.js'
import { useSettings } from '../hooks/useSettings.jsx'
import { APP_NAME } from '../lib/constants.js'
import { addDays, formatDate, formatLongDate, formatTime, minutesUntil, todayISO, weekDays, weekEnd } from '../lib/dates.js'
import { urgencyFor } from '../lib/calc.js'
import { int, money } from '../lib/format.js'
import { ErrorBanner, Spinner, EmptyState } from '../components/ui.jsx'

const URGENCY_STYLES = {
  overdue: 'border-l-4 border-red-800 bg-red-50',
  today: 'border-l-4 border-red-500 bg-red-50',
  week: 'border-l-4 border-yellow-400 bg-yellow-50',
  later: 'border-l-4 border-green-500 bg-green-50',
  none: 'border-l-4 border-slate-300 bg-white',
}

const URGENCY_LABEL = { overdue: 'Overdue', today: 'Today', week: 'This week', later: 'On track', none: '' }

function completedKey(today) {
  return `ppc_done_${today}`
}

function loadCompleted(today) {
  try {
    return JSON.parse(localStorage.getItem(completedKey(today)) || '[]')
  } catch {
    return []
  }
}

export default function Dashboard() {
  const { settings } = useSettings()
  const [now, setNow] = useState(() => new Date())
  const today = todayISO(settings.timezone, now)
  const yesterday = addDays(today, -1)
  const wEnd = weekEnd(today)
  const wDays = weekDays(today)
  const horizon = addDays(today, 7)

  // Tick every minute so "posting in X minutes" and the midnight reset stay accurate.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const [completed, setCompleted] = useState(() => loadCompleted(today))
  useEffect(() => {
    setCompleted(loadCompleted(today))
  }, [today])

  const pins = useQuery(
    () =>
      supabase
        .from('pinterest_pins')
        .select('id, pin_name, status, scheduled_date, scheduled_time, product:products(name)')
        .in('status', ['scheduled', 'in_design', 'needs_caption'])
        .lte('scheduled_date', wEnd)
        .order('scheduled_date')
        .order('scheduled_time'),
    [wEnd],
  )
  const posts = useQuery(
    () =>
      supabase
        .from('instagram_posts')
        .select('id, post_number, hook, status, post_date, product:products(name)')
        .in('status', ['ready', 'scheduled'])
        .lte('post_date', wEnd)
        .order('post_date'),
    [wEnd],
  )
  const pipeline = useQuery(
    () =>
      supabase
        .from('content_pipeline')
        .select('id, due_date, notes, fully_ready, product:products(id, name, status)')
        .lte('due_date', horizon)
        .order('due_date'),
    [horizon],
  )
  const perf = useQuery(
    () => supabase.from('daily_performance').select('*').eq('date', yesterday).maybeSingle(),
    [yesterday],
  )

  const loading = pins.loading || posts.loading || pipeline.loading || perf.loading
  const error = pins.error || posts.error || pipeline.error || perf.error

  const actions = useMemo(() => {
    const list = []
    for (const p of pins.data || []) {
      if (!p.scheduled_date) continue
      list.push({
        id: `pin-${p.id}`,
        date: p.scheduled_date,
        time: p.scheduled_time,
        kind: 'Pinterest',
        text:
          p.status === 'scheduled'
            ? `Post pin “${p.pin_name}”${p.product?.name ? ` (${p.product.name})` : ''}`
            : `Finish pin “${p.pin_name}” (${p.status === 'in_design' ? 'still in design' : 'needs caption'})`,
        to: '/pinterest',
      })
    }
    for (const p of posts.data || []) {
      list.push({
        id: `post-${p.id}`,
        date: p.post_date,
        time: null,
        kind: 'Instagram',
        text: `Publish Instagram post #${p.post_number}${p.hook ? `: “${p.hook}”` : ''}`,
        to: '/instagram',
      })
    }
    for (const r of pipeline.data || []) {
      if (!r.due_date || !r.product) continue
      if (r.product.status === 'ready') {
        list.push({
          id: `upload-${r.id}`,
          date: r.due_date,
          time: null,
          kind: 'Etsy',
          text: `Upload “${r.product.name}” to Etsy`,
          to: '/etsy',
        })
      } else if (!r.fully_ready && r.product.status !== 'live') {
        list.push({
          id: `prod-${r.id}`,
          date: r.due_date,
          time: null,
          kind: 'Production',
          text: `Production due: “${r.product.name}”`,
          to: '/pipeline',
        })
      }
    }
    list.sort((a, b) => (a.date === b.date ? (a.time || '99').localeCompare(b.time || '99') : a.date.localeCompare(b.date)))
    return list.map((a) => ({ ...a, urgency: urgencyFor(a.date, today, wEnd) }))
  }, [pins.data, posts.data, pipeline.data, today, wEnd])

  const open = actions.filter((a) => !completed.includes(a.id) && a.date <= today)
  const done = actions.filter((a) => completed.includes(a.id))
  const shown = open.slice(0, 5)

  function toggle(id) {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try {
        localStorage.setItem(completedKey(today), JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const weekCounts = useMemo(() => {
    const byDay = Object.fromEntries(wDays.map((d) => [d, { pins: 0, posts: 0, uploads: 0, production: 0 }]))
    for (const p of pins.data || []) if (byDay[p.scheduled_date] && p.status === 'scheduled') byDay[p.scheduled_date].pins++
    for (const p of posts.data || []) if (byDay[p.post_date]) byDay[p.post_date].posts++
    for (const r of pipeline.data || []) {
      if (!byDay[r.due_date] || !r.product) continue
      if (r.product.status === 'ready') byDay[r.due_date].uploads++
      else if (!r.fully_ready && r.product.status !== 'live') byDay[r.due_date].production++
    }
    return byDay
  }, [pins.data, posts.data, pipeline.data, wDays])

  const blockers = (pipeline.data || []).filter((r) => r.notes && r.notes.trim() && r.due_date && r.due_date <= horizon)

  const y = perf.data

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{formatLongDate(today)}</h1>
        <p className="text-sm text-slate-500">Here&apos;s your standup, Chris. Tick things off as you go.</p>
      </div>

      <ErrorBanner error={error} onRetry={() => [pins, posts, pipeline, perf].forEach((q) => q.reload())} />
      {loading && !pins.data ? (
        <Spinner />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Section 1: critical actions */}
          <section className="lg:col-span-2">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Today&apos;s critical actions</h2>
            {shown.length === 0 ? (
              <EmptyState
                title={done.length ? 'All caught up for today.' : 'Nothing urgent today.'}
                hint="Schedule pins, mark posts ready, or set pipeline due dates and they show up here."
                action={
                  <Link to="/pinterest" className="btn-secondary btn-sm">
                    Schedule a pin
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {shown.map((a) => (
                  <ActionRow key={a.id} action={a} timeZone={settings.timezone} now={now} onToggle={() => toggle(a.id)} />
                ))}
              </ul>
            )}
            {open.length > 5 && <p className="mt-2 text-xs text-slate-500">+{open.length - 5} more once these are done.</p>}
            {done.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">Completed today ({done.length})</summary>
                <ul className="mt-2 space-y-2">
                  {done.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 line-through">
                      <input type="checkbox" className="h-5 w-5" checked onChange={() => toggle(a.id)} aria-label="Mark not done" />
                      {a.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* Section 2: yesterday */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Yesterday&apos;s performance</h2>
            <div className="card p-4">
              <p className="mb-3 text-xs text-slate-500">{formatDate(yesterday, { year: true })}</p>
              {y ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Etsy revenue" value={money(y.etsy_revenue)} />
                    <Metric label="Etsy sales" value={int(y.etsy_sales)} />
                    <Metric label="Etsy views" value={int(y.etsy_views)} />
                    <Metric label="Pinterest clicks" value={int(y.pinterest_clicks)} />
                    <Metric label="Pin impressions" value={int(y.pinterest_impressions)} />
                    <Metric label="IG likes" value={int(y.instagram_likes)} />
                    <Metric label="IG saves" value={int(y.instagram_saves)} />
                    <Metric label="IG clicks" value={int(y.instagram_clicks)} />
                  </div>
                  <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
                    <Top label="🏆 Product" value={y.top_product_revenue} to="/etsy" />
                    <Top label="📌 Pin" value={y.top_pin_clicks} to="/pinterest" />
                    <Top label="📱 Post" value={y.top_post_engagement} to="/instagram" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No numbers logged for yesterday.{' '}
                  <Link to="/analytics" className="font-semibold text-slate-800 underline">
                    Log them
                  </Link>
                </p>
              )}
            </div>
          </section>

          {/* Section 3: this week */}
          <section className="lg:col-span-2">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">This week&apos;s deadlines</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {wDays.map((d) => {
                const c = weekCounts[d]
                const total = c.pins + c.posts + c.uploads + c.production
                const u = urgencyFor(d, today, wEnd)
                const tone =
                  d === today || d === addDays(today, 1)
                    ? 'border-red-300 bg-red-50'
                    : u === 'overdue'
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : 'border-yellow-200 bg-yellow-50'
                return (
                  <div key={d} className={`rounded-lg border p-3 ${total ? tone : 'border-slate-200 bg-white'}`}>
                    <p className={`text-xs font-bold ${d === today ? 'text-red-700' : 'text-slate-700'}`}>
                      {formatDate(d)}
                      {d === today && ' · today'}
                    </p>
                    {total === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">—</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                        {c.pins > 0 && <li>{c.pins} pin{c.pins > 1 ? 's' : ''} to post</li>}
                        {c.posts > 0 && <li>{c.posts} post{c.posts > 1 ? 's' : ''} ready</li>}
                        {c.uploads > 0 && <li>{c.uploads} product{c.uploads > 1 ? 's' : ''} to upload</li>}
                        {c.production > 0 && <li>{c.production} production task{c.production > 1 ? 's' : ''}</li>}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Section 4: blockers */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Blockers / notes</h2>
            {blockers.length === 0 ? (
              <div className="card p-4 text-sm text-slate-500">No pipeline notes due in the next 7 days.</div>
            ) : (
              <ul className="space-y-2">
                {blockers.map((r) => (
                  <li key={r.id} className="card p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link to="/pipeline" className="font-semibold text-slate-900 hover:underline">
                        {r.product?.name}
                      </Link>
                      <span className={`text-xs font-semibold ${r.due_date < today ? 'text-red-700' : 'text-slate-500'}`}>
                        due {formatDate(r.due_date)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{r.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function ActionRow({ action, timeZone, now, onToggle }) {
  const mins = minutesUntil(action.date, action.time, timeZone, now)
  const soon = mins !== null && mins >= 0 && mins <= 120
  return (
    <li className={`flex items-start gap-3 rounded-lg px-3 py-3 ${URGENCY_STYLES[action.urgency]}`}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer" onChange={onToggle} aria-label={`Mark done: ${action.text}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{action.text}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
          <span className="font-semibold">{action.kind}</span>
          <span>
            {formatDate(action.date)}
            {action.time ? ` at ${formatTime(action.time)}` : ''}
          </span>
          {URGENCY_LABEL[action.urgency] && (
            <span className={`font-semibold ${action.urgency === 'overdue' || action.urgency === 'today' ? 'text-red-700' : action.urgency === 'week' ? 'text-yellow-700' : 'text-green-700'}`}>
              {URGENCY_LABEL[action.urgency]}
            </span>
          )}
          {soon && <span className="font-bold text-red-700">⚠ POSTING IN {mins} MINUTES</span>}
          {mins !== null && mins < 0 && action.date === action.date && action.urgency === 'today' && (
            <span className="font-bold text-red-700">⚠ was due {Math.abs(mins)} min ago</span>
          )}
        </p>
      </div>
      <Link to={action.to} className="btn-secondary btn-sm shrink-0">
        View
      </Link>
    </li>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

function Top({ label, value, to }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      {value ? (
        <Link to={to} className="truncate font-semibold text-slate-800 hover:underline">
          {value}
        </Link>
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </p>
  )
}
