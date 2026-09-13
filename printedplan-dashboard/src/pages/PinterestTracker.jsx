import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, usePins, useProducts } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { useSettings } from '../hooks/useSettings.jsx'
import { LOW_CTR_THRESHOLD, PIN_STATUSES, PIN_STATUS_STYLES, STATUS_LABELS } from '../lib/constants.js'
import { pinCtr, pinNeedsRedesign } from '../lib/calc.js'
import { addDays, formatDate, formatTime, todayISO } from '../lib/dates.js'
import { int, pct } from '../lib/format.js'
import { Badge, ConfirmDialog, CopyButton, DataTable, ErrorBanner, FilterBar, Modal, PageHeader, Select, Spinner, Stat, SummaryGrid } from '../components/ui.jsx'
import PinModal from '../components/PinModal.jsx'

export default function PinterestTracker() {
  const toast = useToast()
  const { settings } = useSettings()
  const pins = usePins()
  const products = useProducts()
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('table')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const today = todayISO(settings.timezone)

  const all = pins.data || []
  const rows = useMemo(() => {
    const list = all.map((p) => ({ ...p, ctr: pinCtr(p), needsRedesign: p.status === 'live' && pinNeedsRedesign(p, LOW_CTR_THRESHOLD) }))
    return filter === 'all' ? list : list.filter((p) => p.status === filter)
  }, [all, filter])

  const summary = useMemo(() => {
    const live = all.filter((p) => p.status === 'live' && pinCtr(p) !== null)
    const avg = live.length ? live.reduce((s, p) => s + pinCtr(p), 0) / live.length : null
    const top = [...live].sort((a, b) => pinCtr(b) - pinCtr(a))[0]
    const redesign = live.filter((p) => pinNeedsRedesign(p, LOW_CTR_THRESHOLD)).length
    const scheduled = all.filter((p) => p.status === 'scheduled').length
    return { total: all.length, avg, top, redesign, scheduled }
  }, [all])

  const timeline = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    return days.map((d) => ({
      date: d,
      pins: all.filter((p) => p.scheduled_date === d).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '')),
    }))
  }, [all, today])

  function upsertLocal(saved) {
    const product = (products.data || []).find((p) => p.id === saved.product_id)
    const row = { ...saved, product: product ? { id: product.id, name: product.name } : null }
    pins.setData((list) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row]))
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deletePin(deleting.id)
      pins.setData((list) => list.filter((x) => x.id !== deleting.id))
      toast.success('Pin deleted.')
      setDeleting(null)
    } catch (e) {
      toast.error(`Failed to delete: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function markLive(pin) {
    try {
      const saved = await api.updatePin(pin.id, { status: 'live' })
      upsertLocal(saved)
      toast.success(`“${pin.pin_name}” marked live.`)
      setViewing(null)
    } catch (e) {
      toast.error(`Failed to update: ${e.message}`)
    }
  }

  const columns = [
    {
      key: 'pin_name',
      label: 'Pin',
      render: (p) => (
        <button type="button" className="text-left font-semibold text-slate-900 hover:underline" onClick={() => setViewing(p)}>
          {p.pin_name}
          {p.needsRedesign && <span className="ml-2 badge border border-red-200 bg-red-100 text-red-800">Needs redesign</span>}
        </button>
      ),
    },
    {
      key: 'product',
      label: 'Product',
      sortValue: (p) => p.product?.name || '',
      render: (p) => (
        <Link to="/etsy" className="hover:underline">
          {p.product?.name || '—'}
        </Link>
      ),
    },
    { key: 'board', label: 'Board' },
    {
      key: 'scheduled_date',
      label: 'Scheduled',
      sortValue: (p) => (p.scheduled_date ? `${p.scheduled_date} ${p.scheduled_time || ''}` : ''),
      render: (p) =>
        p.status === 'live' ? (
          <span className="font-semibold text-blue-700">LIVE</span>
        ) : p.scheduled_date ? (
          <span className={p.scheduled_date < today ? 'text-red-700' : ''}>
            {formatDate(p.scheduled_date)}
            {p.scheduled_time ? ` ${formatTime(p.scheduled_time)}` : ''}
          </span>
        ) : (
          <span className="text-slate-400">Not scheduled</span>
        ),
    },
    { key: 'status', label: 'Status', render: (p) => <Badge className={PIN_STATUS_STYLES[p.status]}>{STATUS_LABELS[p.status]}</Badge> },
    { key: 'clicks_7d', label: 'Clicks', render: (p) => int(p.clicks_7d), className: 'text-right' },
    { key: 'impressions_7d', label: 'Impr.', render: (p) => int(p.impressions_7d), className: 'text-right' },
    { key: 'saves_7d', label: 'Saves', render: (p) => int(p.saves_7d), className: 'text-right' },
    {
      key: 'ctr',
      label: 'CTR',
      sortValue: (p) => (p.status === 'live' ? p.ctr : null),
      render: (p) =>
        p.status === 'live' && p.ctr !== null ? (
          <span className={`font-semibold ${p.ctr < LOW_CTR_THRESHOLD ? 'text-red-700' : 'text-green-700'}`}>{pct(p.ctr)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      className: 'text-right',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (p) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setViewing(p)}>
            View
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(p)}>
            Edit
          </button>
          <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setDeleting(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pinterest Tracker"
        subtitle="What's scheduled, what's live, and what needs a redesign."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing({})}>
            + New pin
          </button>
        }
      />
      <ErrorBanner error={pins.error} onRetry={pins.reload} />

      <SummaryGrid>
        <Stat label="Total pins" value={summary.total} sub={`${summary.scheduled} scheduled`} />
        <Stat label="Avg CTR (live)" value={summary.avg === null ? '—' : pct(summary.avg)} tone={summary.avg !== null && summary.avg < LOW_CTR_THRESHOLD ? 'bad' : 'good'} />
        <Stat label="Top performer" value={summary.top ? pct(pinCtr(summary.top)) : '—'} sub={summary.top?.pin_name} tone="info" />
        <Stat label="Needs redesign" value={summary.redesign} sub={`CTR under ${LOW_CTR_THRESHOLD}%`} tone={summary.redesign ? 'bad' : 'default'} />
        <Stat label="Live pins" value={all.filter((p) => p.status === 'live').length} tone="info" />
      </SummaryGrid>

      <FilterBar>
        <div className="hidden overflow-hidden rounded-lg border border-slate-300 md:inline-flex">
          {['table', 'timeline'].map((v) => (
            <button key={v} type="button" className={`px-3 py-2 text-sm ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`} onClick={() => setView(v)}>
              {v === 'table' ? 'Table' : 'Timeline'}
            </button>
          ))}
        </div>
        <Select
          className="w-auto!"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All statuses' }, ...PIN_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          aria-label="Filter by status"
        />
        <span className="text-sm text-slate-500">
          {rows.length} of {all.length}
        </span>
      </FilterBar>

      {pins.loading && !pins.data ? (
        <Spinner />
      ) : view === 'timeline' ? (
        <div className="card hidden overflow-x-auto p-3 md:block">
          <div className="flex min-w-max gap-2">
            {timeline.map((day) => (
              <div key={day.date} className={`w-40 shrink-0 rounded-lg border p-2 ${day.date === today ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-bold ${day.date === today ? 'text-red-700' : 'text-slate-700'}`}>{formatDate(day.date)}</p>
                <div className="mt-2 space-y-1">
                  {day.pins.length === 0 ? (
                    <p className="text-xs text-slate-400">—</p>
                  ) : (
                    day.pins.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setViewing(p)}
                        className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs hover:opacity-80 ${PIN_STATUS_STYLES[p.status]}`}
                      >
                        <span className="block font-semibold">{p.scheduled_time ? formatTime(p.scheduled_time) : 'any time'}</span>
                        <span className="block truncate">{p.pin_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} defaultSort={{ key: 'scheduled_date', dir: 'asc' }} emptyMessage="No pins yet. Click “+ New pin” to schedule one." />
      )}

      <PinModal open={editing !== null} pin={editing?.id ? editing : null} products={products.data || []} onClose={() => setEditing(null)} onSaved={upsertLocal} />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.pin_name}>
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={PIN_STATUS_STYLES[viewing.status]}>{STATUS_LABELS[viewing.status]}</Badge>
              {viewing.needsRedesign && <Badge className="border-red-200 bg-red-100 text-red-800">Needs redesign</Badge>}
              <span className="text-slate-600">Board: {viewing.board || '—'}</span>
              {viewing.pinterest_url && (
                <a className="text-blue-700 underline" href={viewing.pinterest_url} target="_blank" rel="noreferrer">
                  Open pin ↗
                </a>
              )}
            </div>
            <p className="text-slate-600">
              Product: <Link to="/etsy" className="font-semibold hover:underline">{viewing.product?.name || '—'}</Link> · Scheduled:{' '}
              {viewing.scheduled_date ? `${formatDate(viewing.scheduled_date)} ${formatTime(viewing.scheduled_time)}` : 'not set'}
            </p>
            <div className="rounded-lg bg-slate-900 p-3 text-slate-100">
              <p className="whitespace-pre-wrap">{viewing.caption || <span className="text-slate-400">No caption yet.</span>}</p>
              <div className="mt-2 flex justify-end">
                <CopyButton text={viewing.caption} className="btn-secondary btn-sm" label="Copy caption" />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Item label="Clicks (7d)" value={int(viewing.clicks_7d)} />
              <Item label="Impressions (7d)" value={int(viewing.impressions_7d)} />
              <Item label="Saves (7d)" value={int(viewing.saves_7d)} />
              <Item label="CTR" value={viewing.status === 'live' ? pct(viewing.ctr) : '—'} />
            </dl>
            {viewing.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">{viewing.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {viewing.status !== 'live' && (
                <button type="button" className="btn-primary btn-sm" onClick={() => markLive(viewing)}>
                  Mark as live
                </button>
              )}
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setEditing(viewing)
                  setViewing(null)
                }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete pin?" message={`This permanently deletes “${deleting?.pin_name}”.`} />
    </div>
  )
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}
