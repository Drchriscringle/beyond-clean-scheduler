import { useEffect, useState } from 'react'
import { Field, Modal, Select } from './ui.jsx'
import { PRODUCT_STATUSES, STATUS_LABELS } from '../lib/constants.js'
import { api } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { useSettings } from '../hooks/useSettings.jsx'

const empty = (status) => ({
  name: '',
  price: '',
  status,
  etsy_url: '',
  etsy_views_30d: 0,
  etsy_sales_30d: 0,
  images_ready: false,
  copy_ready: false,
  notes: '',
})

export default function ProductModal({ open, onClose, product, onSaved }) {
  const toast = useToast()
  const { settings } = useSettings()
  const [form, setForm] = useState(empty(settings.defaultProductStatus))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(product ? { ...empty(settings.defaultProductStatus), ...product } : empty(settings.defaultProductStatus))
  }, [open, product, settings.defaultProductStatus])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const onInput = (k) => (e) => set(k)(e.target.type === 'checkbox' ? e.target.checked : e.target.value)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const row = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        status: form.status,
        etsy_url: form.etsy_url?.trim() || null,
        etsy_views_30d: Number(form.etsy_views_30d) || 0,
        etsy_sales_30d: Number(form.etsy_sales_30d) || 0,
        images_ready: Boolean(form.images_ready),
        copy_ready: Boolean(form.copy_ready),
        notes: form.notes?.trim() || null,
      }
      const saved = product?.id ? await api.updateProduct(product.id, row) : await api.createProduct(row)
      toast.success(product?.id ? 'Product updated.' : 'Product added.')
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
      title={product?.id ? 'Edit product' : 'Add new product'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" className="sm:col-span-2">
          <input className="input" value={form.name} onChange={onInput('name')} required placeholder="e.g. Money OS" />
        </Field>
        <Field label="Price (£)">
          <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={onInput('price')} required />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
        </Field>
        <Field label="Etsy URL" className="sm:col-span-2">
          <input className="input" type="url" value={form.etsy_url || ''} onChange={onInput('etsy_url')} placeholder="https://www.etsy.com/listing/…" />
        </Field>
        <Field label="Views (30d)">
          <input className="input" type="number" min="0" value={form.etsy_views_30d} onChange={onInput('etsy_views_30d')} />
        </Field>
        <Field label="Sales (30d)" hint="Revenue is calculated as sales × price.">
          <input className="input" type="number" min="0" value={form.etsy_sales_30d} onChange={onInput('etsy_sales_30d')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={!!form.images_ready} onChange={onInput('images_ready')} /> Images ready
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={!!form.copy_ready} onChange={onInput('copy_ready')} /> Copy ready
        </label>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[90px]" value={form.notes || ''} onChange={onInput('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
