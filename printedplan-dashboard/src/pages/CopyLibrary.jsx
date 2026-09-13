import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useQuery } from '../hooks/useQuery.js'
import { api, useCopyLibrary } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { words } from '../lib/format.js'
import { CopyButton, ErrorBanner, Field, FilterBar, Modal, PageHeader, Select, Spinner } from '../components/ui.jsx'

// The table stores three numbered variants per channel plus a JSON list for
// the rest. These helpers turn that into a plain ordered array and back.
function readVariants(row, prefix, extraKey) {
  const fixed = [1, 2, 3].map((i) => row?.[`${prefix}_${i}`]).filter((v) => v !== null && v !== undefined && v !== '')
  const extra = Array.isArray(row?.[extraKey]) ? row[extraKey] : []
  return [...fixed, ...extra]
}

function writeVariants(list, prefix, extraKey) {
  const patch = {}
  for (let i = 1; i <= 3; i++) patch[`${prefix}_${i}`] = list[i - 1] ?? null
  patch[extraKey] = list.slice(3)
  return patch
}

const SECTIONS = [
  { key: 'etsy_description_short', label: 'Etsy Description (Short)', single: true },
  { key: 'etsy_description_full', label: 'Etsy Description (Full)', single: true },
  { key: 'pinterest', label: 'Pinterest Captions', prefix: 'pinterest_caption', extra: 'pinterest_captions_extra' },
  { key: 'instagram', label: 'Instagram Posts', prefix: 'instagram_post', extra: 'instagram_posts_extra' },
]

export default function CopyLibrary() {
  const toast = useToast()
  const library = useCopyLibrary()
  const usage = useQuery(async () => {
    const [pins, posts] = await Promise.all([
      supabase.from('pinterest_pins').select('id, pin_name, caption, product_id'),
      supabase.from('instagram_posts').select('id, post_number, caption_full, product_id'),
    ])
    if (pins.error) return pins
    if (posts.error) return posts
    return { data: { pins: pins.data, posts: posts.data } }
  })
  const [productFilter, setProductFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null) // { row, section, index, value }
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const list = (library.data || []).filter((r) => r.product).sort((a, b) => a.product.name.localeCompare(b.product.name))
    const q = search.trim().toLowerCase()
    return list.filter((r) => {
      if (productFilter !== 'all' && r.product_id !== productFilter) return false
      if (!q) return true
      const texts = [
        r.etsy_description_short,
        r.etsy_description_full,
        ...readVariants(r, 'pinterest_caption', 'pinterest_captions_extra'),
        ...readVariants(r, 'instagram_post', 'instagram_posts_extra'),
        r.product.name,
      ]
      return texts.some((t) => (t || '').toLowerCase().includes(q))
    })
  }, [library.data, productFilter, search])

  function usedIn(text, productId) {
    if (!text || !usage.data) return []
    const t = text.trim()
    const hits = []
    for (const p of usage.data.pins) if (p.product_id === productId && (p.caption || '').trim() === t) hits.push(`Pinterest pin “${p.pin_name}”`)
    for (const p of usage.data.posts) if (p.product_id === productId && (p.caption_full || '').trim() === t) hits.push(`Instagram post #${p.post_number}`)
    return hits
  }

  async function persist(row, patch, message = 'Saved.') {
    setBusy(true)
    try {
      const saved = await api.upsertCopy(row.product_id, patch)
      library.setData((list) => list.map((r) => (r.product_id === row.product_id ? { ...r, ...saved, product: r.product } : r)))
      toast.success(message)
      setEditor(null)
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  function saveEditor() {
    const { row, section, index, value } = editor
    if (section.single) return persist(row, { [section.key]: value.trim() || null })
    const list = readVariants(row, section.prefix, section.extra)
    if (index === null) list.push(value)
    else list[index] = value
    return persist(row, writeVariants(list, section.prefix, section.extra))
  }

  function deleteVariant(row, section, index) {
    const list = readVariants(row, section.prefix, section.extra)
    list.splice(index, 1)
    return persist(row, writeVariants(list, section.prefix, section.extra), 'Variant deleted.')
  }

  const products = (library.data || []).filter((r) => r.product).map((r) => ({ value: r.product_id, label: r.product.name }))

  return (
    <div>
      <PageHeader title="Copy Library" subtitle="Every description, caption and post for every product. Copy it in one click." />
      <ErrorBanner error={library.error} onRetry={library.reload} />

      <FilterBar>
        <Select className="w-auto!" value={productFilter} onChange={setProductFilter} options={[{ value: 'all', label: 'All products' }, ...products]} aria-label="Filter by product" />
        <input className="input w-auto! min-w-[200px] flex-1 sm:flex-none" placeholder="Search all copy…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search copy" />
        <span className="text-sm text-slate-500">{rows.length} products</span>
      </FilterBar>

      {library.loading && !library.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          {library.data?.length ? 'No copy matches your search.' : 'No products yet. Add products in the Etsy Tracker and their copy cards appear here.'}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ProductCard key={row.product_id} row={row} usedIn={usedIn} onEdit={(section, index, value) => setEditor({ row, section, index, value: value || '' })} onDelete={deleteVariant} />
          ))}
        </div>
      )}

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor ? `${editor.section.label}${editor.index !== null && !editor.section.single ? ` · variant ${editor.index + 1}` : editor.section.single ? '' : ' · new variant'} — ${editor.row.product.name}` : ''}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveEditor} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editor && (
          <Field label="Text" hint={`${editor.value.length} characters · ${words(editor.value)} words`}>
            <textarea className="input min-h-[260px] bg-slate-900 font-mono text-sm text-slate-100" value={editor.value} onChange={(e) => setEditor((ed) => ({ ...ed, value: e.target.value }))} autoFocus />
          </Field>
        )}
      </Modal>
    </div>
  )
}

function ProductCard({ row, usedIn, onEdit, onDelete }) {
  const [open, setOpen] = useState(() => new Set(SECTIONS.map((s) => s.key)))
  const toggle = (k) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">{row.product.name}</h2>
        <span className="text-xs text-slate-500">{row.product.status}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {SECTIONS.map((section) => {
          const isOpen = open.has(section.key)
          const variants = section.single ? [row[section.key]] : readVariants(row, section.prefix, section.extra)
          const count = section.single ? (row[section.key] ? 1 : 0) : variants.length
          return (
            <div key={section.key}>
              <button type="button" className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => toggle(section.key)} aria-expanded={isOpen}>
                <span>
                  {section.label} <span className="ml-1 font-normal text-slate-400">({count})</span>
                </span>
                <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="space-y-3 px-4 pb-4">
                  {section.single ? (
                    <CopyBlock text={row[section.key]} uses={usedIn(row[section.key], row.product_id)} onEdit={() => onEdit(section, null, row[section.key])} />
                  ) : (
                    <>
                      {variants.length === 0 && <p className="text-sm text-slate-400">No variants yet.</p>}
                      {variants.map((v, i) => (
                        <CopyBlock key={i} label={`Variant ${i + 1}`} text={v} uses={usedIn(v, row.product_id)} onEdit={() => onEdit(section, i, v)} onDelete={() => onDelete(row, section, i)} />
                      ))}
                      <button type="button" className="btn-secondary btn-sm" onClick={() => onEdit(section, null, '')}>
                        + Add another variant
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CopyBlock({ label, text, uses, onEdit, onDelete }) {
  return (
    <div className="rounded-lg bg-slate-900 p-3 text-slate-100">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {label && <span className="mr-2 font-semibold text-slate-300">{label}</span>}
          {(text || '').length} chars · {words(text)} words
        </span>
        <div className="flex gap-1">
          <button type="button" className="btn-secondary btn-sm" onClick={onEdit}>
            Edit
          </button>
          <CopyButton text={text} />
          {onDelete && (
            <button type="button" className="btn-sm rounded-lg bg-red-600 px-2.5 text-white hover:bg-red-700" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm">{text || <span className="text-slate-500">Nothing written yet. Click Edit.</span>}</p>
      {uses?.length > 0 && <p className="mt-2 text-xs text-green-300">Used in: {uses.join(', ')}</p>}
    </div>
  )
}
