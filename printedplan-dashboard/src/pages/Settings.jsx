import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useSettings } from '../hooks/useSettings.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { PRODUCT_STATUSES, STATUS_LABELS, TIMEZONES } from '../lib/constants.js'
import { coerceRow, parseCSV, TABLE_COLUMNS } from '../lib/csv.js'
import { Field, Modal, PageHeader, Select } from '../components/ui.jsx'

const TABLES = ['products', 'pinterest_pins', 'instagram_posts', 'daily_performance', 'copy_library', 'content_pipeline']

export default function Settings() {
  const { user } = useAuth()
  const { settings, update } = useSettings()
  const toast = useToast()

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Account, data and preferences." />

      <Section title="Account">
        <EmailForm user={user} />
        <PasswordForm />
        <TwoFactor />
      </Section>

      <Section title="Preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone" hint="Used for “today” on the dashboard and posting countdowns.">
            <Select value={settings.timezone} onChange={(v) => { update({ timezone: v }); toast.success('Timezone saved.') }} options={TIMEZONES} />
          </Field>
          <Field label="Default product status" hint="Pre-selected when you add a new product.">
            <Select value={settings.defaultProductStatus} onChange={(v) => { update({ defaultProductStatus: v }); toast.success('Default status saved.') }} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
          </Field>
        </div>
      </Section>

      <Section title="Data management">
        <ImportCsv />
        <ExportData />
        <DeleteAll />
      </Section>

      <Section title="API keys (Phase 2)">
        <p className="mb-3 text-sm text-slate-500">Stored only in this browser for now. Automatic syncing arrives in Phase 2.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {['etsy', 'pinterest', 'instagram'].map((k) => (
            <ApiKey key={k} name={k} value={settings.apiKeys[k]} onChange={(v) => update({ apiKeys: { ...settings.apiKeys, [k]: v } })} />
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function EmailForm({ user }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Check both inboxes to confirm the new email.')
    setEditing(false)
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <Field label="Email" className="min-w-[220px] flex-1">
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing} required />
      </Field>
      {editing ? (
        <>
          <button type="submit" className="btn-primary" disabled={busy}>
            Save
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setEmail(user?.email || '') }}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
          Edit
        </button>
      )}
    </form>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault()
    if (pw !== pw2) return toast.error('Passwords do not match.')
    if (pw.length < 8) return toast.error('Use at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Password changed.')
    setOpen(false)
    setPw('')
    setPw2('')
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="label mb-0!">Password</p>
          <p className="text-sm text-slate-500">••••••••</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Change password" size="sm" footer={<button type="submit" form="pw-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>}>
        <form id="pw-form" onSubmit={save} className="space-y-4">
          <Field label="New password">
            <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
          </Field>
          <Field label="Repeat new password">
            <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

function TwoFactor() {
  const toast = useToast()
  const [factors, setFactors] = useState(null)
  const [enroll, setEnroll] = useState(null) // { id, qr, secret }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return toast.error(error.message)
    setFactors(data.totp || [])
  }
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = factors?.find((f) => f.status === 'verified')

  async function start() {
    setBusy(true)
    // Clean up any half-finished enrolment first.
    for (const f of factors || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
    setBusy(false)
    if (error) return toast.error(error.message)
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enroll.id })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() })
      if (vErr) throw vErr
      toast.success('Two-factor authentication enabled.')
      setEnroll(null)
      setCode('')
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!window.confirm('Disable two-factor authentication?')) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: active.id })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Two-factor authentication disabled.')
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label mb-0!">Two-factor authentication</p>
          <p className="text-sm text-slate-500">{factors === null ? 'Checking…' : active ? 'Enabled with an authenticator app.' : 'Off. Adds a 6-digit code at login.'}</p>
        </div>
        {factors !== null &&
          (active ? (
            <button type="button" className="btn-secondary" onClick={disable} disabled={busy}>
              Disable
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>
              Enable
            </button>
          ))}
      </div>
      <Modal open={!!enroll} onClose={() => setEnroll(null)} title="Set up two-factor" size="sm" footer={<button type="submit" form="mfa-form" className="btn-primary" disabled={busy}>Verify & enable</button>}>
        {enroll && (
          <form id="mfa-form" onSubmit={verify} className="space-y-4 text-sm">
            <p>Scan this with Google Authenticator, 1Password, Authy or similar, then enter the code it shows.</p>
            <img src={enroll.qr} alt="QR code for authenticator app" className="mx-auto h-44 w-44 rounded-lg border border-slate-200" />
            <p className="break-all text-xs text-slate-500">Manual key: {enroll.secret}</p>
            <Field label="6-digit code">
              <input className="input tracking-widest" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}

function ImportCsv() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [table, setTable] = useState('products')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    if (!rows.length) return toast.error('That CSV has no rows.')
    setPreview({ name: file.name, rows })
  }

  async function run() {
    setBusy(true)
    try {
      const cols = TABLE_COLUMNS[table]
      const rows = preview.rows.map((r) => coerceRow(r, cols)).filter((r) => Object.keys(r).length)
      const { error } = await supabase.from(table).insert(rows)
      if (error) throw error
      toast.success(`Imported ${rows.length} rows into ${table}.`)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(`Import failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="label">Import CSV</p>
      <p className="mb-2 text-sm text-slate-500">
        Column headers must match the table&apos;s column names (e.g. <code>name,price,status</code> for products). Rows are added, never overwritten.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-auto!" value={table} onChange={setTable} options={Object.keys(TABLE_COLUMNS).map((t) => ({ value: t, label: t }))} aria-label="Table" />
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pick} className="text-sm" aria-label="CSV file" />
      </div>
      {preview && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p>
            <strong>{preview.name}</strong>: {preview.rows.length} rows, columns: {Object.keys(preview.rows[0]).join(', ')}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={run} disabled={busy}>
              {busy ? 'Importing…' : `Import into ${table}`}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExportData() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const out = { exported_at: new Date().toISOString() }
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select('*')
        if (error) throw error
        out[t] = data
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `printedplan-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded.')
    } catch (err) {
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="label mb-0!">Export data</p>
        <p className="text-sm text-slate-500">Downloads every table as one JSON backup file.</p>
      </div>
      <button type="button" className="btn-secondary" onClick={run} disabled={busy}>
        {busy ? 'Exporting…' : 'Export'}
      </button>
    </div>
  )
}

function DeleteAll() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    const { error } = await supabase.rpc('delete_all_dashboard_data')
    setBusy(false)
    if (error) return toast.error(`Delete failed: ${error.message}`)
    toast.success('All data deleted.')
    setOpen(false)
    setConfirm('')
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <div>
        <p className="label mb-0! text-red-800">Delete all data</p>
        <p className="text-sm text-red-700">Wipes products, pins, posts, pipeline, copy and daily numbers. Cannot be undone. Export first.</p>
      </div>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Delete
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete ALL data?"
        size="sm"
        footer={
          <button type="button" className="btn-danger" disabled={busy || confirm !== 'DELETE'} onClick={run}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
        }
      >
        <p className="text-sm text-slate-700">
          This permanently deletes every row in every table. Your login stays. Type <strong>DELETE</strong> to confirm.
        </p>
        <input className="input mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
      </Modal>
    </div>
  )
}

function ApiKey({ name, value, onChange }) {
  const [show, setShow] = useState(false)
  const label = name[0].toUpperCase() + name.slice(1)
  return (
    <Field label={`${label} API key`}>
      <div className="flex gap-1">
        <input className="input" type={show ? 'text' : 'password'} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Not set" autoComplete="off" />
        <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="btn-ghost btn-sm shrink-0 text-red-600" onClick={() => onChange('')}>
          Reset
        </button>
      </div>
    </Field>
  )
}
