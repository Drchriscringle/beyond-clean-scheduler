import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../hooks/useToast.jsx'
import { copyToClipboard } from '../lib/format.js'

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-10 text-slate-500 ${className}`} role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function Badge({ children, className = '' }) {
  return <span className={`badge border ${className}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900',
    good: 'text-green-700',
    bad: 'text-red-700',
    warn: 'text-yellow-700',
    info: 'text-blue-700',
  }
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 truncate">{sub}</p>}
    </div>
  )
}

export function SummaryGrid({ children }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{children}</div>
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${sizes[size]}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="btn-ghost btn-sm -mr-2 text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">{message}</p>
    </Modal>
  )
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 ${
        checked ? 'bg-green-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

export function YesNo({ value }) {
  return value ? (
    <span className="font-semibold text-green-700">✓</span>
  ) : (
    <span className="font-semibold text-red-600">✗</span>
  )
}

export function CopyButton({ text, className = 'btn-secondary btn-sm', label = 'Copy' }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await copyToClipboard(text || '')
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } else {
          toast.error('Could not copy to clipboard.')
        }
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

/**
 * Sortable, filterable table that collapses to cards on small screens.
 * columns: [{ key, label, render?(row), sortValue?(row), className?, hideOnCard? }]
 */
export function DataTable({ columns, rows, rowKey = (r) => r.id, defaultSort, emptyMessage = 'Nothing here yet.', cardTitle }) {
  const [sort, setSort] = useState(defaultSort || { key: null, dir: 'asc' })

  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const col = columns.find((c) => c.key === sort.key)
    const getter = col?.sortValue || ((r) => r[sort.key])
    const list = [...rows]
    list.sort((a, b) => {
      const av = getter(a)
      const bv = getter(b)
      if (av === bv) return 0
      if (av === null || av === undefined || av === '') return 1
      if (bv === null || bv === undefined || bv === '') return -1
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, sort, columns])

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  if (!rows.length) return <div className="card p-6 text-center text-sm text-slate-500">{emptyMessage}</div>

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`table-th ${c.className || ''}`}>
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="text-[10px] text-slate-400">{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className={`table-td ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Sort:</span>
          <select className="input min-h-[36px]! w-auto! py-1! text-xs" value={sort.key || ''} onChange={(e) => setSort({ key: e.target.value || null, dir: 'asc' })}>
            <option value="">Default</option>
            {columns.filter((c) => c.sortable !== false).map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
            {sort.dir === 'asc' ? '▲ asc' : '▼ desc'}
          </button>
        </div>
        {sorted.map((row) => (
          <MobileCard key={rowKey(row)} row={row} columns={columns} title={cardTitle} />
        ))}
      </div>
    </>
  )
}

function MobileCard({ row, columns, title }) {
  const [open, setOpen] = useState(false)
  const primary = columns[0]
  const actions = columns.find((c) => c.key === 'actions')
  const rest = columns.filter((c) => c !== primary && c !== actions && !c.hideOnCard)
  const preview = rest.slice(0, 3)
  const more = rest.slice(3)
  return (
    <div className="card p-4">
      <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1 text-base font-semibold text-slate-900">
          {title ? title(row) : primary.render ? primary.render(row) : row[primary.key]}
        </div>
        {more.length > 0 && <span className="text-slate-400">{open ? '▲' : '▼'}</span>}
      </button>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {(open ? rest : preview).map((c) => (
          <div key={c.key} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</dt>
            <dd className="truncate text-slate-800">{c.render ? c.render(row) : row[c.key]}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{actions.render(row)}</div>}
    </div>
  )
}

export function FilterBar({ children }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2 no-print">{children}</div>
}

export function Select({ value, onChange, options, className = '', ...rest }) {
  return (
    <select className={`input ${className}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
