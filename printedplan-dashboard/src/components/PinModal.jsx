import { useEffect, useState } from 'react'
import { Field, Modal, Select } from './ui.jsx'
import { PIN_STATUSES, STATUS_LABELS } from '../lib/constants.js'
import { api } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'

const empty = {
  product_id: '',
  pin_name: '',
  caption: '',
  board: '',
  status: 'needs_caption',
  scheduled_date: '',
  scheduled_time: '',
  pinterest_url: '',
  clicks_7d: 0,
  impressions_7d: 0,
  saves_7d: 0,
  notes: '',
}

export default function PinModal({ open, onClose, pin, products, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open)
      setForm(
        pin
          ? { ...empty, ...pin, scheduled_date: pin.scheduled_date || '', scheduled_time: (pin.scheduled_time || '').slice(0, 5) }
          : { ...empty, product_id: products?.[0]?.id || '' },
      )
  }, [open, pin, products])

  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.product_id) return toast.error('Pick a product first (add one in the Etsy Tracker).')
    setBusy(true)
    try {
      const row = {
        product_id: form.product_id,
        pin_name: form.pin_name.trim(),
        caption: form.caption || '',
        board: form.board || '',
        status: form.status,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        pinterest_url: form.pinterest_url?.trim() || null,
        clicks_7d: Number(form.clicks_7d) || 0,
        impressions_7d: Number(form.impressions_7d) || 0,
        saves_7d: Number(form.saves_7d) || 0,
        notes: form.notes?.trim() || null,
      }
      const saved = pin?.id ? await api.updatePin(pin.id, row) : await api.createPin(row)
      toast.success(pin?.id ? 'Pin updated.' : 'Pin created.')
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
      title={pin?.id ? 'Edit pin' : 'New pin'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="pin-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save pin'}
          </button>
        </>
      }
    >
      <form id="pin-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Pin name" className="sm:col-span-2">
          <input className="input" value={form.pin_name} onChange={onInput('pin_name')} required />
        </Field>
        <Field label="Product">
          <Select
            value={form.product_id}
            onChange={set('product_id')}
            options={[{ value: '', label: 'Choose…' }, ...(products || []).map((p) => ({ value: p.id, label: p.name }))]}
            required
          />
        </Field>
        <Field label="Board">
          <input className="input" value={form.board} onChange={onInput('board')} placeholder="e.g. Budget Planners" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')} options={PIN_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
        </Field>
        <Field label="Pinterest URL">
          <input className="input" type="url" value={form.pinterest_url || ''} onChange={onInput('pinterest_url')} placeholder="https://pinterest.com/pin/…" />
        </Field>
        <Field label="Scheduled date">
          <input className="input" type="date" value={form.scheduled_date} onChange={onInput('scheduled_date')} />
        </Field>
        <Field label="Scheduled time">
          <input className="input" type="time" value={form.scheduled_time} onChange={onInput('scheduled_time')} />
        </Field>
        <Field label="Caption" className="sm:col-span-2" hint={`${(form.caption || '').length} characters`}>
          <textarea className="input min-h-[100px]" value={form.caption} onChange={onInput('caption')} />
        </Field>
        <Field label="Clicks (7d)">
          <input className="input" type="number" min="0" value={form.clicks_7d} onChange={onInput('clicks_7d')} />
        </Field>
        <Field label="Impressions (7d)">
          <input className="input" type="number" min="0" value={form.impressions_7d} onChange={onInput('impressions_7d')} />
        </Field>
        <Field label="Saves (7d)">
          <input className="input" type="number" min="0" value={form.saves_7d} onChange={onInput('saves_7d')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[70px]" value={form.notes || ''} onChange={onInput('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
