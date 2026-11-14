import { useEffect, useState } from 'react'
import { api, siteBase } from '../../lib/api.js'
import { applyDiscount, depositFor, estimateOneOff, formatPounds } from '../../../supabase/functions/_shared/pricing.js'
import { AREAS, CLEAN_TYPES, ENQUIRY_STATUS, EXTRAS, PROPERTY_TYPES, TIME_WINDOWS, labelFor } from '../../lib/options.js'
import { Badge, ErrorNote, accessSummary, formatDate, timeAgo } from '../../components/ui.jsx'

const FILTERS = [
  ['open', 'To do', (e) => e.status === 'new'],
  ['replied', 'Quote sent', (e) => ['replied', 'awaiting_deposit'].includes(e.status)],
  ['booked', 'Booked', (e) => e.status === 'booked'],
  ['done', 'Done', (e) => e.status === 'completed'],
  ['all', 'All', () => true],
]
const WINDOW_START = { morning: '09:00', afternoon: '13:00', evening: '17:00' }

export default function Inbox({ data, settings, onChange }) {
  const { enquiries } = data
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(null)
  const fn = FILTERS.find((f) => f[0] === filter)[2]
  const list = enquiries.filter(fn)
  const open = enquiries.find((e) => e.id === openId)

  return (
    <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-4 items-start">
      <div className={open ? 'hidden lg:block' : ''}>
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {FILTERS.map(([id, label, f]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`btn-sm btn whitespace-nowrap ${filter === id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}>
              {label} <span className="opacity-70">{enquiries.filter(f).length}</span>
            </button>
          ))}
        </div>
        {!list.length && <div className="card p-6 text-center text-slate-500">Nothing here. New enquiries appear instantly.</div>}
        <ul className="space-y-2">
          {list.map((e) => {
            const st = ENQUIRY_STATUS[e.status]
            return (
              <li key={e.id}>
                <button onClick={() => setOpenId(e.id)}
                  className={`card w-full text-left p-3 hover:border-brand-500 transition ${openId === e.id ? 'border-brand-600 ring-2 ring-brand-100' : ''}`}>
                  <div className="flex items-center gap-2">
                    {e.status === 'new' && <span className="size-2.5 rounded-full bg-leaf-500 shrink-0" aria-label="New" />}
                    <span className="font-extrabold truncate">{e.name}</span>
                    <span className="ml-auto text-xs text-slate-500 whitespace-nowrap">{timeAgo(e.created_at)}</span>
                  </div>
                  <div className="text-sm text-slate-600 truncate">{labelFor(CLEAN_TYPES, e.clean_type)} · {labelFor(PROPERTY_TYPES, e.property_type)} · {e.postcode}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {e.booked_date && ['booked', 'awaiting_deposit'].includes(e.status) && <Badge tone="bg-slate-100 text-slate-700">{formatDate(e.booked_date)}</Badge>}
                    {e.photos?.length > 0 && <Badge tone="bg-slate-100 text-slate-700">📷 {e.photos.length}</Badge>}
                    {e.discount_code && <Badge tone="bg-leaf-100 text-leaf-600">🏷️ {e.discount_code}</Badge>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {open
        ? <Detail key={open.id} e={open} data={data} settings={settings} onBack={() => setOpenId(null)} onChange={onChange} />
        : <div className="hidden lg:block card p-10 text-center text-slate-500">Choose an enquiry to reply.</div>}
    </div>
  )
}

export function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('0')) return '44' + d.slice(1)
  return d
}

function Photos({ paths }) {
  const [urls, setUrls] = useState([])
  useEffect(() => {
    Promise.all((paths || []).map((p) => api.photoUrl('enquiry-photos', p))).then(setUrls)
  }, [paths])
  if (!paths?.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => u && <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Customer photo ${i + 1}`} className="size-24 rounded-xl object-cover border border-slate-200" /></a>)}
    </div>
  )
}

function Detail({ e, data, settings, onBack, onChange }) {
  const first = (e.preferred || [])[0]
  const est = estimateOneOff(settings, e)
  const [code, setCode] = useState(null)
  const [msg, setMsg] = useState(e.reply_message || `Hi ${e.name.split(' ')[0]}, thanks for getting in touch with Beyond Clean! `)
  const [price, setPrice] = useState(e.quote_pence != null ? String(e.quote_pence / 100) : est ? String(Math.round((est.lowPence + est.highPence) / 200 / 5) * 5) : '')
  const [date, setDate] = useState(e.booked_date || first?.date || '')
  const [time, setTime] = useState(e.booked_time || (first ? WINDOW_START[first.window] || '' : ''))
  const [hours, setHours] = useState(String(e.est_hours ?? est?.hours ?? ''))
  const [askDeposit, setAskDeposit] = useState(settings.depositPercent > 0)
  const [cleaner, setCleaner] = useState(e.cleaner_id || '')
  const [notes, setNotes] = useState(e.owner_notes || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const statusLink = `${siteBase()}#/enquiry/${e.token}`

  useEffect(() => {
    if (e.discount_code) api.checkDiscount(e.discount_code, 'oneoff').then((c) => setCode(c.valid ? c : null)).catch(() => {})
  }, [e.discount_code])

  const pricePence = Math.round(parseFloat(price) * 100) || 0
  const finalPence = code ? applyDiscount(pricePence, code) : pricePence
  const deposit = askDeposit ? depositFor(settings, finalPence) : 0

  async function save(patch, note) {
    setBusy(true); setError('')
    try { await api.updateEnquiry(e.id, patch); setSent(note); onChange() } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const common = () => ({ owner_notes: notes, cleaner_id: cleaner || null, est_hours: parseFloat(hours) || null })

  function sendQuote() {
    if (!msg.trim()) return setError('Write a short message to the customer.')
    if (!(pricePence > 0)) return setError('Add a price.')
    if (!date) return setError('Choose the date you can do.')
    save({
      ...common(), status: 'replied', reply_message: msg.trim(), quote_pence: finalPence, booked_date: date, booked_time: time || null,
      deposit_pence: deposit, replied_at: new Date().toISOString(),
    }, 'Quote sent. The customer gets an email with a link to accept.')
  }

  const waText = encodeURIComponent(`${msg.trim()}${price ? `\n\nPrice: ${formatPounds(finalPence)}` : ''}${date ? `\nDate: ${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${time ? ` at ${time}` : ''}` : ''}\n\nAccept or view your quote here: ${statusLink}`)
  const st = ENQUIRY_STATUS[e.status]
  const access = accessSummary(e.access)

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <button className="btn-ghost btn-sm lg:hidden -ml-2" onClick={onBack}>← All enquiries</button>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-xl text-brand-900">{e.name}</h2>
          <div className="text-sm text-slate-500">{formatDate(e.created_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · prefers {e.contact_pref}</div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a className="btn-secondary btn-sm" href={`tel:${e.phone}`}>📞 Call</a>
        <a className="btn-secondary btn-sm" href={`https://wa.me/${waNumber(e.phone)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
        <a className="btn-secondary btn-sm" href={`mailto:${e.email}`}>✉️ Email</a>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        <Row k="Clean" v={labelFor(CLEAN_TYPES, e.clean_type)} />
        <Row k="Property" v={`${labelFor(PROPERTY_TYPES, e.property_type)}${e.property_type !== 'office' ? ` · ${e.bedrooms} bed · ${e.bathrooms} bath` : ''}`} />
        <Row k="Areas" v={(e.areas || []).map((a) => labelFor(AREAS, a)).join(', ')} />
        <Row k="Extras" v={(e.extras || []).map((a) => labelFor(EXTRAS, a)).join(', ') || 'None'} />
        <Row k="Address" v={<a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(`${e.address}, ${e.postcode}`)}`}>{e.address}, {e.postcode}</a>} />
        <Row k="Phone / email" v={`${e.phone} · ${e.email}`} />
        <Row k="Would like" v={
          <ul>
            {(e.preferred || []).map((p) => <li key={p.date}>{formatDate(p.date)} · {labelFor(TIME_WINDOWS, p.window)}</li>)}
            {e.flexible && <li>Flexible</li>}
          </ul>
        } />
        <Row k="Estimate shown" v={e.estimate_low_pence ? `${formatPounds(e.estimate_low_pence)}–${formatPounds(e.estimate_high_pence)} (~${e.est_hours} hrs)` : 'None (quote by hand)'} />
        {e.notes && <Row k="Their notes" v={e.notes} />}
        {access && <Row k="Access" v={access} />}
        {e.discount_code && <Row k="Code" v={code ? `${e.discount_code}: ${code.description}` : `${e.discount_code} (no longer valid)`} />}
      </dl>
      <Photos paths={e.photos} />

      {['booked', 'awaiting_deposit', 'completed', 'cancelled'].includes(e.status) && (
        <div className={`rounded-xl px-3.5 py-3 font-semibold ${e.status === 'cancelled' ? 'bg-red-50' : 'bg-leaf-100'}`}>
          {e.status === 'cancelled' ? '✕ Cancelled' : e.status === 'completed' ? '✓ Done' : e.status === 'awaiting_deposit' ? '⏳ Accepted, waiting for deposit' : '✓ Booked'}{' '}
          for {formatDate(e.booked_date, { weekday: 'long', day: 'numeric', month: 'long' })}{e.booked_time ? ` at ${e.booked_time}` : ''}
          {e.quote_pence != null && ` · ${formatPounds(e.quote_pence)}`}
          <div className="text-sm font-normal">
            Paid {formatPounds(e.paid_pence || 0)}{e.deposit_pence ? ` (deposit ${formatPounds(e.deposit_pence)})` : ''}
            {e.status === 'cancelled' && e.late_cancel && ' · late cancellation'}
          </div>
        </div>
      )}

      <section className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
        <h3 className="font-extrabold">{e.status === 'new' ? 'Reply with a quote' : 'Update the job'}</h3>
        {(e.preferred || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {e.preferred.map((p) => (
              <button key={p.date} type="button" className={`btn-sm btn border ${date === p.date ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-300'}`}
                onClick={() => { setDate(p.date); setTime(WINDOW_START[p.window] || time) }}>
                {formatDate(p.date)} · {labelFor(TIME_WINDOWS, p.window)}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div><label className="label" htmlFor="qp">Price £</label>
            <input id="qp" inputMode="decimal" className="field" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="85" /></div>
          <div><label className="label" htmlFor="qh">Hours</label>
            <input id="qh" inputMode="decimal" className="field" value={hours} onChange={(ev) => setHours(ev.target.value)} /></div>
          <div><label className="label" htmlFor="qd">Date</label>
            <input id="qd" type="date" className="field !px-2" value={date} onChange={(ev) => setDate(ev.target.value)} /></div>
          <div><label className="label" htmlFor="qt">Time</label>
            <input id="qt" type="time" className="field !px-2" value={time} onChange={(ev) => setTime(ev.target.value)} /></div>
        </div>
        {code && pricePence > 0 && <p className="text-sm">🏷️ With their code: <b>{formatPounds(pricePence)} → {formatPounds(finalPence)}</b></p>}
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-brand-600" checked={askDeposit} onChange={(ev) => setAskDeposit(ev.target.checked)} />
            Ask for a {settings.depositPercent || 25}% deposit{deposit ? ` (${formatPounds(deposit)})` : ''}
          </label>
          <label className="text-sm font-semibold flex items-center gap-2">Cleaner
            <select className="field !py-1.5 !w-auto" value={cleaner} onChange={(ev) => setCleaner(ev.target.value)}>
              <option value="">Not assigned</option>
              {data.cleaners.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div><label className="label" htmlFor="qm">Message</label>
          <textarea id="qm" rows={4} className="field" value={msg} onChange={(ev) => setMsg(ev.target.value)} /></div>
        <div><label className="label" htmlFor="qn">Private notes <span className="font-normal text-slate-500">(only you see these)</span></label>
          <textarea id="qn" rows={2} className="field" value={notes} onChange={(ev) => setNotes(ev.target.value)} /></div>
        <ErrorNote>{error}</ErrorNote>
        {sent && <div role="status" className="rounded-xl bg-leaf-100 px-3 py-2 text-sm font-semibold">{sent}</div>}
        {['new', 'replied'].includes(e.status) && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={sendQuote}>Send quote</button>
            <a className="btn-secondary" href={`https://wa.me/${waNumber(e.phone)}?text=${waText}`} target="_blank" rel="noreferrer">Send by WhatsApp</a>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {['new', 'replied', 'awaiting_deposit'].includes(e.status) && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => date ? save({ ...common(), status: 'booked', booked_date: date, booked_time: time || null, quote_pence: finalPence || null }, 'Marked as booked.') : setError('Choose a date first.')}>
              Mark booked (agreed by phone)
            </button>
          )}
          {e.status === 'booked' && (
            <>
              <button className="btn-leaf btn-sm" disabled={busy} onClick={() => save({ ...common(), status: 'completed', completed_at: new Date().toISOString() }, 'Marked as done. The customer gets a thank-you with a review link and a link to pay any balance.')}>✓ Mark done</button>
              <button className="btn-secondary btn-sm" disabled={busy} onClick={() => save({ ...common(), booked_date: date, booked_time: time || null }, 'Booking updated.')}>Save date / cleaner</button>
            </>
          )}
          {e.status === 'completed' && (e.quote_pence || 0) > (e.paid_pence || 0) && (
            <button className="btn-secondary btn-sm" disabled={busy} onClick={() => save({ paid_pence: e.quote_pence }, 'Marked as paid in full.')}>Paid in cash / bank transfer</button>
          )}
          {['new', 'replied'].includes(e.status) && (
            <button className="btn-danger btn-sm" disabled={busy}
              onClick={() => save({ ...common(), status: 'declined', reply_message: msg.trim() || 'Sorry, we can\'t take this one on.', replied_at: new Date().toISOString() }, 'Enquiry declined.')}>
              Decline
            </button>
          )}
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => save(common(), 'Saved.')}>Save notes</button>
        </div>
        <p className="text-xs text-slate-500 break-all">Customer's page: <a className="underline" href={statusLink} target="_blank" rel="noreferrer">{statusLink}</a></p>
      </section>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div>
      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wide">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  )
}
