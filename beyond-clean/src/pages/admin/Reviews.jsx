import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Badge, ErrorNote, Stars, formatDate } from '../../components/ui.jsx'

export default function Reviews({ data, onChange }) {
  const { reviews } = data
  const [error, setError] = useState('')
  const fixes = reviews.filter((r) => r.fix_status && r.fix_status !== 'done')
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '–'

  // Opening this tab clears the "new review" badge.
  useEffect(() => {
    const unseen = reviews.filter((r) => !r.seen)
    if (unseen.length) Promise.all(unseen.map((r) => api.updateReview(r.id, { seen: true }))).then(onChange).catch(() => {})
  }, [reviews, onChange])

  async function patch(r, p) {
    setError('')
    try { await api.updateReview(r.id, p); onChange() } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Average" value={`${avg} ★`} />
        <Kpi label="Reviews" value={reviews.length} />
        <Kpi label="On your site" value={reviews.filter((r) => r.published).length} />
      </div>
      <ErrorNote>{error}</ErrorNote>

      {fixes.length > 0 && (
        <section className="card p-4 space-y-2 ring-2 ring-red-300">
          <h2 className="font-extrabold">⚠️ Put-it-right requests (24-hour guarantee)</h2>
          {fixes.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center gap-2"><b className="flex-1">{r.name}</b><Stars value={r.rating} size="text-base" /></div>
              {r.comment && <p className="text-sm">“{r.comment}”</p>}
              <div className="flex gap-2">
                <button className={`btn-sm btn border ${r.fix_status === 'booked' ? 'bg-brand-600 text-white' : 'bg-white border-slate-300'}`} onClick={() => patch(r, { fix_status: 'booked' })}>Return visit booked</button>
                <button className="btn-leaf btn-sm" onClick={() => patch(r, { fix_status: 'done' })}>Fixed ✓</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!reviews.length && <div className="card p-6 text-center text-slate-500">No reviews yet. Customers are asked automatically the day after each clean.</div>}
      <ul className="space-y-2">
        {reviews.map((r) => <ReviewRow key={r.id} r={r} patch={patch} />)}
      </ul>
    </div>
  )
}

function ReviewRow({ r, patch }) {
  const [reply, setReply] = useState(r.owner_reply || '')
  return (
    <li className="card p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <b>{r.name}</b>
        <Stars value={r.rating} size="text-base" />
        <span className="text-xs text-slate-500">{formatDate(r.created_at)}{r.visit_date ? ` · clean on ${formatDate(r.visit_date)}` : ''}</span>
        <span className="ml-auto">{r.published ? <Badge tone="bg-green-100 text-green-800">On your site</Badge> : <Badge tone="bg-slate-100 text-slate-700">Private</Badge>}</span>
      </div>
      {r.comment && <p>“{r.comment}”</p>}
      <div className="flex gap-2">
        <input className="field !py-1.5 text-sm" placeholder="Public reply (optional)" value={reply} onChange={(e) => setReply(e.target.value)} />
        {reply !== (r.owner_reply || '') && <button className="btn-secondary btn-sm" onClick={() => patch(r, { owner_reply: reply || null })}>Save</button>}
      </div>
      <button className={`btn-sm btn ${r.published ? 'btn-secondary' : 'btn-primary'}`} onClick={() => patch(r, { published: !r.published })}>
        {r.published ? 'Hide from site' : 'Show on site'}
      </button>
    </li>
  )
}

function Kpi({ label, value }) {
  return <div className="card p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="text-xl font-extrabold text-brand-700">{value}</div></div>
}
