import { useMemo, useState } from 'react'
import { api, usePipeline } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { useSettings } from '../hooks/useSettings.jsx'
import { PIPELINE_STEPS, PRODUCT_STATUSES, STATUS_LABELS, STATUS_STYLES } from '../lib/constants.js'
import { pipelineBottleneck, pipelineFullyReady, pipelineNextSteps, urgencyFor } from '../lib/calc.js'
import { formatDate, todayISO, weekEnd } from '../lib/dates.js'
import { Badge, DataTable, ErrorBanner, Field, FilterBar, Modal, PageHeader, Select, Spinner, Stat, SummaryGrid, YesNo } from '../components/ui.jsx'

const DUE_STYLES = {
  overdue: 'text-red-700 font-semibold',
  today: 'text-red-700 font-semibold',
  week: 'text-yellow-700 font-semibold',
  later: 'text-slate-700',
  none: 'text-slate-400',
}

export default function ContentPipeline() {
  const toast = useToast()
  const { settings } = useSettings()
  const pipeline = usePipeline()
  const today = todayISO(settings.timezone)
  const wEnd = weekEnd(today)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [dueDraft, setDueDraft] = useState('')
  const [mode, setMode] = useState('detail') // detail | notes | due

  const all = (pipeline.data || []).filter((r) => r.product)
  const rows = useMemo(() => {
    const list = all.map((r) => ({ ...r, done: PIPELINE_STEPS.filter((s) => r[s.key]).length, urgency: urgencyFor(r.due_date, today, wEnd) }))
    return filter === 'all' ? list : list.filter((r) => r.product.status === filter)
  }, [all, filter, today, wEnd])

  const summary = useMemo(() => {
    const count = (s) => all.filter((r) => r.product.status === s).length
    const unfinished = all.filter((r) => !r.fully_ready && r.product.status !== 'live')
    const bottleneck = pipelineBottleneck(unfinished, PIPELINE_STEPS)
    const overdue = all.filter((r) => r.due_date && r.due_date < today && !r.fully_ready).length
    return { live: count('live'), ready: count('ready'), production: count('production'), idea: count('idea'), bottleneck, overdue }
  }, [all, today])

  function applyLocal(saved, productPatch) {
    pipeline.setData((list) =>
      list.map((r) => (r.id === saved.id ? { ...r, ...saved, product: { ...r.product, ...productPatch } } : r)),
    )
    setSelected((s) => (s && s.id === saved.id ? { ...s, ...saved, product: { ...s.product, ...productPatch } } : s))
  }

  async function toggleStep(row, key) {
    const patch = { [key]: !row[key] }
    // Optimistic: fully_ready is computed in the database, so mirror it locally.
    const optimistic = { ...row, ...patch }
    applyLocal({ id: row.id, ...patch, fully_ready: pipelineFullyReady(optimistic) })
    try {
      const saved = await api.updatePipeline(row.id, patch)
      applyLocal(saved)
    } catch (e) {
      applyLocal({ id: row.id, [key]: row[key], fully_ready: row.fully_ready })
      toast.error(`Failed to save: ${e.message}`)
    }
  }

  async function saveNotes(row) {
    try {
      const saved = await api.updatePipeline(row.id, { notes: notesDraft.trim() || null })
      applyLocal(saved)
      toast.success('Notes saved.')
      setMode('detail')
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`)
    }
  }

  async function saveDue(row) {
    try {
      const saved = await api.updatePipeline(row.id, { due_date: dueDraft || null })
      applyLocal(saved)
      toast.success('Due date updated.')
      setMode('detail')
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`)
    }
  }

  async function moveToLive(row) {
    try {
      await api.updateProduct(row.product.id, { status: 'live' })
      applyLocal({ id: row.id }, { status: 'live' })
      toast.success(`“${row.product.name}” is now live.`)
    } catch (e) {
      toast.error(`Failed to update: ${e.message}`)
    }
  }

  function open(row, m = 'detail') {
    setSelected(row)
    setNotesDraft(row.notes || '')
    setDueDraft(row.due_date || '')
    setMode(m)
  }

  const stepCol = (s) => ({
    key: s.key,
    label: s.short,
    sortValue: (r) => (r[s.key] ? 1 : 0),
    className: 'text-center',
    render: (r) => (
      <button type="button" className="rounded px-2 py-1 hover:bg-slate-100" onClick={() => toggleStep(r, s.key)} aria-label={`Toggle ${s.label}`}>
        <YesNo value={r[s.key]} />
      </button>
    ),
  })

  const columns = [
    {
      key: 'name',
      label: 'Product',
      sortValue: (r) => r.product.name,
      render: (r) => (
        <button type="button" className="text-left font-semibold text-slate-900 hover:underline" onClick={() => open(r)}>
          {r.product.name}
        </button>
      ),
    },
    { key: 'status', label: 'Status', sortValue: (r) => PRODUCT_STATUSES.indexOf(r.product.status), render: (r) => <Badge className={STATUS_STYLES[r.product.status]}>{STATUS_LABELS[r.product.status]}</Badge> },
    ...PIPELINE_STEPS.map(stepCol),
    { key: 'done', label: 'Progress', className: 'text-center', render: (r) => <span className="text-xs text-slate-600">{r.done}/{PIPELINE_STEPS.length}</span> },
    { key: 'fully_ready', label: 'Fully ready', sortValue: (r) => (r.fully_ready ? 1 : 0), className: 'text-center', render: (r) => (r.fully_ready ? <Badge className="border-green-200 bg-green-100 text-green-800">Ready</Badge> : <YesNo value={false} />) },
    { key: 'due_date', label: 'Due', render: (r) => <span className={DUE_STYLES[r.urgency]}>{r.due_date ? formatDate(r.due_date) : 'No date'}</span> },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className="btn-secondary btn-sm" onClick={() => open(r, 'notes')}>
            Edit notes
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => open(r, 'due')}>
            Change due date
          </button>
          {r.fully_ready && r.product.status !== 'live' && (
            <button type="button" className="btn-primary btn-sm" onClick={() => moveToLive(r)}>
              Move to Live
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Content Pipeline" subtitle="Production status for every product. Click a tick to toggle it." />
      <ErrorBanner error={pipeline.error} onRetry={pipeline.reload} />

      <SummaryGrid>
        <Stat label="Live" value={summary.live} tone="good" />
        <Stat label="Ready" value={summary.ready} tone="info" />
        <Stat label="Production" value={summary.production} tone="warn" />
        <Stat label="Idea" value={summary.idea} />
        <Stat label="Overdue" value={summary.overdue} tone={summary.overdue ? 'bad' : 'default'} sub={summary.bottleneck ? `Bottleneck: ${summary.bottleneck.label} (${summary.bottleneck.count})` : 'No bottleneck'} />
      </SummaryGrid>

      <FilterBar>
        <Select className="w-auto!" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All statuses' }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} aria-label="Filter by status" />
        <span className="text-sm text-slate-500">
          {rows.length} of {all.length}
        </span>
      </FilterBar>

      {pipeline.loading && !pipeline.data ? (
        <Spinner />
      ) : (
        <DataTable columns={columns} rows={rows} defaultSort={{ key: 'due_date', dir: 'asc' }} emptyMessage="No products in the pipeline. Add products in the Etsy Tracker and they appear here automatically." cardTitle={(r) => r.product.name} />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.product?.name}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_STYLES[selected.product.status]}>{STATUS_LABELS[selected.product.status]}</Badge>
              {selected.fully_ready ? <Badge className="border-green-200 bg-green-100 text-green-800">Fully ready</Badge> : <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800">In progress</Badge>}
              <span className={DUE_STYLES[urgencyFor(selected.due_date, today, wEnd)]}>{selected.due_date ? `Due ${formatDate(selected.due_date, { year: true })}` : 'No due date'}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {PIPELINE_STEPS.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" className="h-5 w-5" checked={!!selected[s.key]} onChange={() => toggleStep(selected, s.key)} />
                  <span className={selected[s.key] ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}>{s.label}</span>
                </label>
              ))}
            </div>

            {mode === 'notes' ? (
              <Field label="Notes / blockers">
                <textarea className="input min-h-[110px]" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} autoFocus />
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => saveNotes(selected)}>
                    Save notes
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setMode('detail')}>
                    Cancel
                  </button>
                </div>
              </Field>
            ) : mode === 'due' ? (
              <Field label="Due date">
                <input className="input" type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} autoFocus />
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => saveDue(selected)}>
                    Save date
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setDueDraft('')}>
                    Clear
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setMode('detail')}>
                    Cancel
                  </button>
                </div>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label">Blockers / notes</p>
                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">{selected.notes || <span className="text-slate-400">No notes.</span>}</p>
                </div>
                <div>
                  <p className="label">What&apos;s needed next</p>
                  {pipelineNextSteps(selected, PIPELINE_STEPS).length === 0 ? (
                    <p className="rounded-lg bg-green-50 p-3 text-green-800">Everything is done. Move it to Live.</p>
                  ) : (
                    <ol className="list-decimal space-y-1 rounded-lg bg-slate-50 p-3 pl-7 text-slate-700">
                      {pipelineNextSteps(selected, PIPELINE_STEPS).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setMode('notes')}>
                Edit notes
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setMode('due')}>
                Change due date
              </button>
              {selected.fully_ready && selected.product.status !== 'live' && (
                <button type="button" className="btn-primary btn-sm" onClick={() => moveToLive(selected)}>
                  Move to Live
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
