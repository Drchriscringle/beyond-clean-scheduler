import { useMemo, useState } from 'react'
import { DAY_NAMES_LONG, addHours, formatPounds } from '../../../supabase/functions/_shared/pricing.js'
import { CLEAN_TYPES, labelFor } from '../../lib/options.js'
import { formatDate } from '../../components/ui.jsx'

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monday(offsetWeeks) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7)
  return d
}

/** Every clean in a week: recurring plan visits plus booked one-off jobs. */
export default function Week({ plans, enquiries }) {
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => {
    const start = monday(offset)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const date = iso(d)
      const jobs = []
      for (const p of plans || []) {
        if (!['active', 'past_due'].includes(p.status) || (p.start_date && p.start_date > date)) continue
        for (const s of p.slots || []) {
          if (s.day === i + 1) jobs.push({ key: p.id + s.start, time: s.start, end: addHours(s.start, p.hours_per_visit), who: p.name, where: p.postcode, kind: 'Plan', warn: p.status === 'past_due' })
        }
      }
      for (const e of enquiries || []) {
        if (e.status === 'booked' && e.booked_date === date) {
          jobs.push({ key: e.id, time: e.booked_time || '', who: e.name, where: e.postcode, kind: labelFor(CLEAN_TYPES, e.clean_type), price: e.quote_pence })
        }
      }
      jobs.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
      return { date, label: DAY_NAMES_LONG[i], jobs }
    })
  }, [offset, plans, enquiries])

  const total = days.reduce((n, d) => n + d.jobs.length, 0)
  const today = iso(new Date())

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setOffset(offset - 1)} aria-label="Previous week">←</button>
        <div className="flex-1 text-center font-extrabold">
          Week of {formatDate(days[0].date, { day: 'numeric', month: 'long' })} <span className="text-slate-500 font-semibold">· {total} cleans</span>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => setOffset(offset + 1)} aria-label="Next week">→</button>
      </div>
      {offset !== 0 && <div className="text-center"><button className="btn-ghost btn-sm" onClick={() => setOffset(0)}>Back to this week</button></div>}
      <div className="grid md:grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.date} className={`card p-2.5 min-h-24 ${d.date === today ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="text-xs font-extrabold text-slate-500 uppercase">{d.label.slice(0, 3)} {formatDate(d.date, { day: 'numeric' })}</div>
            {!d.jobs.length && <div className="text-xs text-slate-400 mt-1">—</div>}
            <ul className="mt-1.5 space-y-1.5">
              {d.jobs.map((j) => (
                <li key={j.key} className={`rounded-lg px-2 py-1.5 text-xs ${j.kind === 'Plan' ? 'bg-brand-50' : 'bg-leaf-100'} ${j.warn ? 'ring-1 ring-red-400' : ''}`}>
                  <div className="font-extrabold">{j.time}{j.end ? `–${j.end}` : ''}</div>
                  <div className="font-semibold truncate">{j.who}</div>
                  <div className="text-slate-600 truncate">{j.kind} · {j.where}{j.price ? ` · ${formatPounds(j.price)}` : ''}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500"><span className="inline-block size-2.5 rounded bg-brand-50 border border-brand-200 align-middle" /> Plan visit · <span className="inline-block size-2.5 rounded bg-leaf-100 border border-leaf-500 align-middle" /> One-off booking</p>
    </div>
  )
}
