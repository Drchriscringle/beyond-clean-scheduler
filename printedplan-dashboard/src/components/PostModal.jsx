import { useEffect, useState } from 'react'
import { Field, Modal, Select } from './ui.jsx'
import { PILLARS, PILLAR_LABELS, POST_STATUSES, STATUS_LABELS } from '../lib/constants.js'
import { api } from '../hooks/useData.js'
import { useToast } from '../hooks/useToast.jsx'
import { words } from '../lib/format.js'

const empty = {
  product_id: '',
  post_number: '',
  post_date: '',
  pillar: 'breakdown',
  hook: '',
  caption_full: '',
  status: 'draft',
  images_ready: false,
  instagram_url: '',
  notes: '',
}

export default function PostModal({ open, onClose, post, products, nextNumber, defaultDate, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(post ? { ...empty, ...post, pillar: post.pillar || 'breakdown', product_id: post.product_id || '' } : { ...empty, post_number: nextNumber || 1, post_date: defaultDate || '' })
  }, [open, post, nextNumber, defaultDate])

  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const row = {
        product_id: form.product_id || null,
        post_number: Number(form.post_number) || 1,
        post_date: form.post_date,
        pillar: form.pillar || null,
        hook: form.hook || '',
        caption_full: form.caption_full || '',
        status: form.status,
        images_ready: Boolean(form.images_ready),
        instagram_url: form.instagram_url?.trim() || null,
        notes: form.notes?.trim() || null,
      }
      const saved = post?.id ? await api.updatePost(post.id, row) : await api.createPost(row)
      toast.success(post?.id ? 'Post updated.' : 'Post created.')
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
      title={post?.id ? `Edit post #${post.post_number}` : 'New Instagram post'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="post-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save post'}
          </button>
        </>
      }
    >
      <form id="post-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Post #">
          <input className="input" type="number" min="1" value={form.post_number} onChange={onInput('post_number')} required />
        </Field>
        <Field label="Post date">
          <input className="input" type="date" value={form.post_date} onChange={onInput('post_date')} required />
        </Field>
        <Field label="Product (optional)">
          <Select value={form.product_id} onChange={set('product_id')} options={[{ value: '', label: 'None' }, ...(products || []).map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
        <Field label="Pillar">
          <Select value={form.pillar} onChange={set('pillar')} options={PILLARS.map((p) => ({ value: p, label: PILLAR_LABELS[p] }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')} options={POST_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={!!form.images_ready} onChange={onInput('images_ready')} /> Images ready
        </label>
        <Field label="Hook" className="sm:col-span-2" hint="The first line people see.">
          <input className="input" value={form.hook} onChange={onInput('hook')} />
        </Field>
        <Field label="Full caption" className="sm:col-span-2" hint={`${(form.caption_full || '').length} characters · ${words(form.caption_full)} words`}>
          <textarea className="input min-h-[140px] bg-slate-900 text-slate-100" value={form.caption_full} onChange={onInput('caption_full')} />
        </Field>
        <Field label="Instagram URL" className="sm:col-span-2">
          <input className="input" type="url" value={form.instagram_url || ''} onChange={onInput('instagram_url')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[60px]" value={form.notes || ''} onChange={onInput('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export function PublishModal({ open, onClose, post, today, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && post)
      setForm({
        posted_date: post.posted_date || today,
        instagram_url: post.instagram_url || '',
        likes: post.likes || 0,
        saves: post.saves || 0,
        comments: post.comments || 0,
        clicks_to_etsy: post.clicks_to_etsy || 0,
        conversions: post.conversions || 0,
      })
  }, [open, post, today])

  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await api.updatePost(post.id, {
        status: 'posted',
        posted_date: form.posted_date || today,
        instagram_url: form.instagram_url?.trim() || null,
        likes: Number(form.likes) || 0,
        saves: Number(form.saves) || 0,
        comments: Number(form.comments) || 0,
        clicks_to_etsy: Number(form.clicks_to_etsy) || 0,
        conversions: Number(form.conversions) || 0,
      })
      toast.success(`Post #${post.post_number} marked as posted.`)
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
      title={`Publish post #${post?.post_number}`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="publish-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Mark as posted'}
          </button>
        </>
      }
    >
      <form id="publish-form" onSubmit={save} className="grid grid-cols-2 gap-4">
        <Field label="Posted on" className="col-span-2">
          <input className="input" type="date" value={form.posted_date || ''} onChange={onInput('posted_date')} required />
        </Field>
        <Field label="Instagram URL" className="col-span-2">
          <input className="input" type="url" value={form.instagram_url || ''} onChange={onInput('instagram_url')} />
        </Field>
        {[
          ['likes', 'Likes'],
          ['saves', 'Saves'],
          ['comments', 'Comments'],
          ['clicks_to_etsy', 'Clicks to Etsy'],
          ['conversions', 'Conversions'],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <input className="input" type="number" min="0" value={form[k] ?? 0} onChange={onInput(k)} />
          </Field>
        ))}
        <p className="col-span-2 text-xs text-slate-500">You can update these numbers later from the Posted Archive.</p>
      </form>
    </Modal>
  )
}
