import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, usePosts, useProducts } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { useSettings } from '../hooks/useSettings.jsx'
import { PILLAR_LABELS, POST_STATUSES, POST_STATUS_STYLES, STATUS_LABELS } from '../lib/constants.js'
import { postEngagement } from '../lib/calc.js'
import { addDays, formatDate, todayISO } from '../lib/dates.js'
import { int, words } from '../lib/format.js'
import { Badge, ConfirmDialog, CopyButton, DataTable, ErrorBanner, FilterBar, Modal, PageHeader, Select, Spinner, Stat, SummaryGrid } from '../components/ui.jsx'
import PostModal, { PublishModal } from '../components/PostModal.jsx'

export default function InstagramTracker() {
  const toast = useToast()
  const { settings } = useSettings()
  const posts = usePosts()
  const products = useProducts()
  const today = todayISO(settings.timezone)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [caption, setCaption] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const all = posts.data || []
  const withEng = useMemo(() => all.map((p) => ({ ...p, engagement: postEngagement(p) })), [all])
  const filtered = filter === 'all' ? withEng : withEng.filter((p) => p.status === filter)
  const ready = filtered.filter((p) => p.status === 'ready' || p.status === 'scheduled' || p.status === 'draft')
  const archive = filtered.filter((p) => p.status === 'posted')

  const summary = useMemo(() => {
    const scheduled = all.filter((p) => p.status === 'scheduled' || p.status === 'ready').length
    const weekAgo = addDays(today, -7)
    const posted7 = all.filter((p) => p.status === 'posted' && (p.posted_date || p.post_date) >= weekAgo).length
    const posted = all.filter((p) => p.status === 'posted')
    const avg = posted.length ? posted.reduce((s, p) => s + postEngagement(p), 0) / posted.length : 0
    const best = [...posted].sort((a, b) => postEngagement(b) - postEngagement(a))[0]
    const byPillar = {}
    for (const p of posted) {
      if (!p.pillar) continue
      byPillar[p.pillar] = byPillar[p.pillar] || { n: 0, e: 0 }
      byPillar[p.pillar].n++
      byPillar[p.pillar].e += postEngagement(p)
    }
    const bestPillar = Object.entries(byPillar).sort((a, b) => b[1].e / b[1].n - a[1].e / a[1].n)[0]
    return { scheduled, posted7, avg, best, bestPillar: bestPillar ? PILLAR_LABELS[bestPillar[0]] : null }
  }, [all, today])

  const nextNumber = all.reduce((m, p) => Math.max(m, p.post_number || 0), 0) + 1

  function upsertLocal(saved) {
    const product = (products.data || []).find((p) => p.id === saved.product_id)
    const row = { ...saved, product: product ? { id: product.id, name: product.name } : null }
    posts.setData((list) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list]))
  }

  async function patch(p, changes) {
    try {
      const saved = await api.updatePost(p.id, changes)
      upsertLocal(saved)
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deletePost(deleting.id)
      posts.setData((list) => list.filter((x) => x.id !== deleting.id))
      toast.success('Post deleted.')
      setDeleting(null)
    } catch (e) {
      toast.error(`Failed to delete: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const base = [
    { key: 'post_number', label: '#', render: (p) => <span className="font-semibold">#{p.post_number}</span> },
    { key: 'post_date', label: 'Date', render: (p) => <span className={p.status !== 'posted' && p.post_date < today ? 'text-red-700' : ''}>{formatDate(p.post_date)}</span> },
    { key: 'product', label: 'Product', sortValue: (p) => p.product?.name || '', render: (p) => (p.product ? <Link to="/etsy" className="hover:underline">{p.product.name}</Link> : '—') },
    { key: 'pillar', label: 'Pillar', render: (p) => (p.pillar ? PILLAR_LABELS[p.pillar] : '—') },
    { key: 'hook', label: 'Hook', render: (p) => <span className="line-clamp-2 max-w-xs">{p.hook || <span className="text-slate-400">—</span>}</span> },
  ]

  const actionsCol = (extra) => ({
    key: 'actions',
    label: 'Actions',
    sortable: false,
    render: (p) => (
      <div className="flex flex-wrap gap-1">
        {extra?.(p)}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setCaption(p)}>
          View caption
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(p)}>
          Edit
        </button>
        <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setDeleting(p)}>
          Delete
        </button>
      </div>
    ),
  })

  const readyColumns = [
    ...base,
    { key: 'status', label: 'Status', render: (p) => <Badge className={POST_STATUS_STYLES[p.status]}>{STATUS_LABELS[p.status]}</Badge> },
    actionsCol((p) => (
      <button type="button" className="btn-primary btn-sm" onClick={() => setPublishing(p)}>
        Publish
      </button>
    )),
  ]

  const numCell = (key) => ({
    key,
    label: key === 'clicks_to_etsy' ? 'Clicks' : key[0].toUpperCase() + key.slice(1),
    className: 'text-right',
    render: (p) => <EditableNumber value={p[key]} onSave={(v) => patch(p, { [key]: v })} />,
  })

  const archiveColumns = [
    ...base,
    numCell('likes'),
    numCell('saves'),
    numCell('comments'),
    numCell('clicks_to_etsy'),
    numCell('conversions'),
    { key: 'engagement', label: 'Engagement', className: 'text-right', render: (p) => <span className="font-semibold">{int(p.engagement)}</span> },
    actionsCol(),
  ]

  return (
    <div>
      <PageHeader
        title="Instagram Tracker"
        subtitle="Ready-to-post queue and the posted archive with performance."
        actions={
          <>
            <Link to="/copy" className="btn-secondary">
              Copy library
            </Link>
            <button type="button" className="btn-primary" onClick={() => setEditing({})}>
              + New post
            </button>
          </>
        }
      />
      <ErrorBanner error={posts.error} onRetry={posts.reload} />

      <SummaryGrid>
        <Stat label="Ready / scheduled" value={summary.scheduled} tone="info" />
        <Stat label="Posted (7d)" value={summary.posted7} tone="good" />
        <Stat label="Avg engagement" value={summary.avg.toFixed(1)} sub="likes + saves + comments" />
        <Stat label="Best post" value={summary.best ? `#${summary.best.post_number}` : '—'} sub={summary.best ? `${postEngagement(summary.best)} engagement` : ''} />
        <Stat label="Best hook type" value={summary.bestPillar || '—'} />
      </SummaryGrid>

      <FilterBar>
        <Select className="w-auto!" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All statuses' }, ...POST_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} aria-label="Filter by status" />
      </FilterBar>

      {posts.loading && !posts.data ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Ready to post ({ready.length})</h2>
            <DataTable columns={readyColumns} rows={ready} defaultSort={{ key: 'post_date', dir: 'asc' }} emptyMessage="Nothing queued. Click “+ New post” to draft one." cardTitle={(p) => `#${p.post_number} · ${p.hook || 'Untitled'}`} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Posted archive ({archive.length})</h2>
            <p className="mb-2 text-xs text-slate-500 no-print">Click a number to edit it in place.</p>
            <DataTable columns={archiveColumns} rows={archive} defaultSort={{ key: 'post_date', dir: 'desc' }} emptyMessage="No posts published yet." cardTitle={(p) => `#${p.post_number} · ${p.hook || 'Untitled'}`} />
          </section>
        </div>
      )}

      <PostModal open={editing !== null} post={editing?.id ? editing : null} products={products.data || []} nextNumber={nextNumber} defaultDate={today} onClose={() => setEditing(null)} onSaved={upsertLocal} />
      <PublishModal open={!!publishing} post={publishing} today={today} onClose={() => setPublishing(null)} onSaved={upsertLocal} />

      <Modal open={!!caption} onClose={() => setCaption(null)} title={caption ? `Post #${caption.post_number} caption` : ''}>
        {caption && (
          <div className="space-y-3">
            {caption.hook && <p className="text-sm font-semibold text-slate-900">{caption.hook}</p>}
            <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
              <p className="whitespace-pre-wrap">{caption.caption_full || <span className="text-slate-400">No caption written yet.</span>}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {(caption.caption_full || '').length} characters · {words(caption.caption_full)} words
              </span>
              <CopyButton text={caption.caption_full} className="btn-primary btn-sm" label="Copy caption" />
            </div>
            {caption.product && (
              <p className="text-xs text-slate-500">
                Linked product: <Link to="/copy" className="font-semibold hover:underline">{caption.product.name}</Link>
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete post?" message={`This permanently deletes post #${deleting?.post_number}.`} />
    </div>
  )
}

function EditableNumber({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!editing)
    return (
      <button
        type="button"
        className="min-w-[2.5rem] rounded px-1 py-0.5 text-right hover:bg-slate-100"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        title="Click to edit"
      >
        {int(value)}
      </button>
    )
  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (!Number.isNaN(n) && n !== value) onSave(Math.max(0, Math.round(n)))
  }
  return (
    <input
      className="input min-h-[32px]! w-20 px-2! py-1! text-right"
      type="number"
      min="0"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}
