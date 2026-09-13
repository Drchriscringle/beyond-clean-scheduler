import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useQuery } from '../hooks/useQuery.js'
import { api, useProducts } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { PRODUCT_STATUSES, STATUS_LABELS, STATUS_STYLES } from '../lib/constants.js'
import { productConversion, productRevenue } from '../lib/calc.js'
import { int, money, pct } from '../lib/format.js'
import { Badge, ConfirmDialog, DataTable, ErrorBanner, FilterBar, Modal, PageHeader, Select, Spinner, Stat, SummaryGrid, Toggle } from '../components/ui.jsx'
import ProductModal from '../components/ProductModal.jsx'

export default function EtsyTracker() {
  const toast = useToast()
  const products = useProducts()
  const counts = useQuery(async () => {
    const [pins, posts] = await Promise.all([
      supabase.from('pinterest_pins').select('product_id'),
      supabase.from('instagram_posts').select('product_id'),
    ])
    if (pins.error) return pins
    if (posts.error) return posts
    const tally = (rows) => rows.reduce((m, r) => ((m[r.product_id] = (m[r.product_id] || 0) + 1), m), {})
    return { data: { pins: tally(pins.data), posts: tally(posts.data) } }
  })

  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null) // null | {} (new) | product
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const list = (products.data || []).map((p) => ({
      ...p,
      revenue: productRevenue(p),
      conversion: productConversion(p),
      pinCount: counts.data?.pins?.[p.id] || 0,
      postCount: counts.data?.posts?.[p.id] || 0,
    }))
    return filter === 'all' ? list : list.filter((p) => p.status === filter)
  }, [products.data, counts.data, filter])

  const all = products.data || []
  const summary = useMemo(() => {
    const live = all.filter((p) => p.status === 'live').length
    const ready = all.filter((p) => p.status === 'ready').length
    const revenue = all.reduce((s, p) => s + productRevenue(p), 0)
    const byRevenue = [...all].sort((a, b) => productRevenue(b) - productRevenue(a))[0]
    const byConv = [...all].filter((p) => productConversion(p) !== null).sort((a, b) => productConversion(b) - productConversion(a))[0]
    return { live, ready, revenue, byRevenue, byConv }
  }, [all])

  async function patch(p, changes, label) {
    try {
      const saved = await api.updateProduct(p.id, changes)
      products.setData((list) => list.map((x) => (x.id === p.id ? { ...x, ...saved } : x)))
      if (label) toast.success(label)
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deleteProduct(deleting.id)
      products.setData((list) => list.filter((x) => x.id !== deleting.id))
      toast.success(`Deleted “${deleting.name}”.`)
      setDeleting(null)
    } catch (e) {
      toast.error(`Failed to delete: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (p) => (
        <button type="button" className="text-left font-semibold text-slate-900 hover:underline" onClick={() => setViewing(p)}>
          {p.name}
        </button>
      ),
    },
    { key: 'price', label: 'Price', sortValue: (p) => Number(p.price), render: (p) => money(p.price) },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <select
          className={`badge cursor-pointer border ${STATUS_STYLES[p.status]}`}
          value={p.status}
          onChange={(e) => patch(p, { status: e.target.value }, `“${p.name}” is now ${STATUS_LABELS[e.target.value]}.`)}
          aria-label="Change status"
        >
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      ),
    },
    { key: 'etsy_views_30d', label: 'Views (30d)', sortValue: (p) => p.etsy_views_30d, render: (p) => int(p.etsy_views_30d), className: 'text-right' },
    { key: 'etsy_sales_30d', label: 'Sales (30d)', sortValue: (p) => p.etsy_sales_30d, render: (p) => int(p.etsy_sales_30d), className: 'text-right' },
    { key: 'revenue', label: 'Revenue (30d)', sortValue: (p) => p.revenue, render: (p) => <span className="font-semibold">{money(p.revenue)}</span>, className: 'text-right' },
    {
      key: 'images_ready',
      label: 'Images',
      sortValue: (p) => (p.images_ready ? 1 : 0),
      render: (p) => <Toggle checked={p.images_ready} label="Images ready" onChange={(v) => patch(p, { images_ready: v })} />,
    },
    {
      key: 'copy_ready',
      label: 'Copy',
      sortValue: (p) => (p.copy_ready ? 1 : 0),
      render: (p) => <Toggle checked={p.copy_ready} label="Copy ready" onChange={(v) => patch(p, { copy_ready: v })} />,
    },
    { key: 'pinCount', label: 'Pins', sortValue: (p) => p.pinCount, render: (p) => <Link to="/pinterest" className="hover:underline">{p.pinCount}</Link>, className: 'text-right' },
    { key: 'postCount', label: 'Posts', sortValue: (p) => p.postCount, render: (p) => <Link to="/instagram" className="hover:underline">{p.postCount}</Link>, className: 'text-right' },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (p) => (
        <div className="flex gap-1">
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
        title="Etsy Tracker"
        subtitle="Every product, its 30-day numbers and readiness."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing({})}>
            + Add new product
          </button>
        }
      />
      <ErrorBanner error={products.error} onRetry={products.reload} />

      <SummaryGrid>
        <Stat label="Live products" value={summary.live} tone="good" />
        <Stat label="Ready to upload" value={summary.ready} tone="info" />
        <Stat label="Revenue (30d)" value={money(summary.revenue)} />
        <Stat label="Best by revenue" value={summary.byRevenue ? money(productRevenue(summary.byRevenue)) : '—'} sub={summary.byRevenue?.name} />
        <Stat label="Best by conversion" value={summary.byConv ? pct(productConversion(summary.byConv)) : '—'} sub={summary.byConv?.name} />
      </SummaryGrid>

      <FilterBar>
        <Select
          className="w-auto!"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All statuses' }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          aria-label="Filter by status"
        />
        <span className="text-sm text-slate-500">
          {rows.length} of {all.length}
        </span>
      </FilterBar>

      {products.loading && !products.data ? (
        <Spinner />
      ) : (
        <DataTable columns={columns} rows={rows} defaultSort={{ key: 'name', dir: 'asc' }} emptyMessage="No products yet. Click “+ Add new product” to get started." />
      )}

      <div className="mt-4 no-print">
        <button type="button" className="btn-primary" onClick={() => setEditing({})}>
          + Add new product
        </button>
      </div>

      <ProductModal
        open={editing !== null}
        product={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={(saved) =>
          products.setData((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]))
        }
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name} size="md">
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_STYLES[viewing.status]}>{STATUS_LABELS[viewing.status]}</Badge>
              <span className="font-semibold">{money(viewing.price)}</span>
              {viewing.etsy_url && (
                <a className="text-blue-700 underline" href={viewing.etsy_url} target="_blank" rel="noreferrer">
                  Open on Etsy ↗
                </a>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Item label="Views (30d)" value={int(viewing.etsy_views_30d)} />
              <Item label="Sales (30d)" value={int(viewing.etsy_sales_30d)} />
              <Item label="Revenue (30d)" value={money(productRevenue(viewing))} />
              <Item label="Conversion" value={pct(productConversion(viewing))} />
              <Item label="Images ready" value={viewing.images_ready ? 'Yes' : 'No'} />
              <Item label="Copy ready" value={viewing.copy_ready ? 'Yes' : 'No'} />
              <Item label="Linked pins" value={viewing.pinCount} />
              <Item label="Linked posts" value={viewing.postCount} />
            </dl>
            {viewing.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">{viewing.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link to="/pipeline" className="btn-secondary btn-sm">
                Pipeline
              </Link>
              <Link to="/copy" className="btn-secondary btn-sm">
                Copy library
              </Link>
              <button
                type="button"
                className="btn-primary btn-sm"
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

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete product?"
        message={`This permanently deletes “${deleting?.name}” along with its pins, pipeline row and copy. Instagram posts stay but lose the link.`}
      />
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
