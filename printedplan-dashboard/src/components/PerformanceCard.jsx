import { useEffect, useState } from 'react'
import { Field, Modal } from './ui.jsx'
import { api } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'

const NUMERIC = [
  ['etsy_revenue', 'Etsy revenue (£)', '0.01'],
  ['etsy_sales', 'Etsy sales'],
  ['etsy_views', 'Etsy views'],
  ['pinterest_clicks', 'Pinterest clicks'],
  ['pinterest_impressions', 'Pinterest impressions'],
  ['instagram_likes', 'Instagram likes'],
  ['instagram_saves', 'Instagram saves'],
  ['instagram_clicks', 'Instagram clicks'],
]

/** Modal for logging (or editing) one day's numbers in daily_performance. */
export default function PerformanceEntryModal({ open, onClose, entry, defaultDate, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      const base = { date: defaultDate, top_product_revenue: '', top_pin_clicks: '', top_post_engagement: '', notes: '' }
      for (const [k] of NUMERIC) base[k] = 0
      setForm(entry ? { ...base, ...entry } : base)
    }
  }, [open, entry, defaultDate])

  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const row = { date: form.date }
      for (const [k] of NUMERIC) row[k] = Number(form[k]) || 0
      for (const k of ['top_product_revenue', 'top_pin_clicks', 'top_post_engagement', 'notes']) row[k] = (form[k] || '').trim() || null
      const saved = await api.upsertPerformance(row)
      toast.success(`Saved numbers for ${form.date}.`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? `Edit ${entry.date}` : "Log a day's numbers"}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="perf-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="perf-form" onSubmit={save} className="grid grid-cols-2 gap-4">
        <Field label="Date" className="col-span-2" hint="One row per day. Saving an existing date overwrites it.">
          <input className="input" type="date" value={form.date || ''} onChange={onInput('date')} required disabled={!!entry} />
        </Field>
        {NUMERIC.map(([k, label, step]) => (
          <Field key={k} label={label}>
            <input className="input" type="number" min="0" step={step || '1'} value={form[k] ?? 0} onChange={onInput(k)} />
          </Field>
        ))}
        <Field label="Top product (by revenue)">
          <input className="input" value={form.top_product_revenue || ''} onChange={onInput('top_product_revenue')} />
        </Field>
        <Field label="Top pin (by clicks)">
          <input className="input" value={form.top_pin_clicks || ''} onChange={onInput('top_pin_clicks')} />
        </Field>
        <Field label="Top post (by engagement)" className="col-span-2">
          <input className="input" value={form.top_post_engagement || ''} onChange={onInput('top_post_engagement')} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea className="input min-h-[60px]" value={form.notes || ''} onChange={onInput('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
