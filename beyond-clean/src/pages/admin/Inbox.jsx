import { useState } from 'react'
import { api, siteBase } from '../../lib/api.js'
import { formatPounds } from '../../../supabase/functions/_shared/pricing.js'
import { AREAS, CLEAN_TYPES, ENQUIRY_STATUS, EXTRAS, PROPERTY_TYPES, TIME_WINDOWS, labelFor } from '../../lib/options.js'
import { Badge, ErrorNote, formatDate, timeAgo } from '../../components/ui.jsx'

const FILTERS = [
  ['open', 'To do', (e) => e.status === 'new'],
  ['replied', 'Quote sent', (e) => e.status === 'replied'],
  ['booked', 'Booked', (e) => e.status === 'booked'],
  ['all', 'All', () => true],
]

export default function Inbox({ enquiries, onChange }) {
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(null)
  const fn = FILTERS.find((f) => f[0] === filter)[2]
  const list = enquiries.filter(fn)
  const open = enquiries.find((e) => e.id === openId)

  return (
    <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-4 items-start">
      <div className={open ? 'hidden lg:block' : ''}>
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
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
                  <div className="mt-1.5"><Badge tone={st.tone}>{st.label}</Badge></div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {open
        ? <Detail key={open.id} e={open} onBack={() => setOpenId(null)} onChange={onChange} />
        : <div className="hidden lg:block card p-10 text-center text-slate-500">Choose an enquiry to reply.</div>}
    </div>
  )
}

function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('0')) return '44' + d.slice(1)
  return d
}

function Detail({ e, onBack, onChange }) {
  const first = (e.preferred || [])[0]
  const [msg, setMsg] = useState(e.reply_message || `Hi ${e.name.split(' ')[0]}, thanks for getting in touch with Beyond Clean! `)
  const [price, setPrice] = useState(e.quote_pence != null ? String(e.quote_pence / 100) : '')
  const [date, setDate] = useState(e.booked_date || first?.date || '')
  const [time, setTime] = useState(e.booked_time || (first ? { morning: '09:00', afternoon: '13:00', evening: '17:00' }[first.window] || '' : ''))
  const [notes, setNotes] = useState(e.owner_notes || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const statusLink = `${siteBase()}#/enquiry/${e.token}`

  async function save(patch, note) {
    setBusy(true); setError('')
    try { await api.updateEnquiry(e.id, patch); setSent(note); onChange() } catch (err) { setError(err.message) }
    setBusy(false)
  }

  function sendQuote() {
    const pence = Math.round(parseFloat(price) * 100)
    if (!msg.trim()) return setError('Write a short message to the customer.')
    if (!(pence > 0)) return setError('Add a price.')
    if (!date) return setError('Choose the date you can do.')
    save({
      status: 'replied', reply_message: msg.trim(), quote_pence: pence, booked_date: date, booked_time: time || null,
      replied_at: new Date().toISOString(), owner_notes: notes,
    }, 'Quote sent. The customer gets an email with a link to accept.')
  }

  const waText = encodeURIComponent(`${msg.trim()}${price ? `\n\nPrice: £${price}` : ''}${date ? `\nDate: ${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${time ? ` at ${time}` : ''}` : ''}\n\nAccept or view your quote here: ${statusLink}`)

  const st = ENQUIRY_STATUS[e.status]
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
        {e.notes && <Row k="Their notes" v={e.notes} />}
      </dl>

      {e.status === 'booked' && (
        <div className="rounded-xl bg-leaf-100 px-3.5 py-3 font-semibold">
          ✓ Booked for {formatDate(e.booked_date, { weekday: 'long', day: 'numeric', month: 'long' })}{e.booked_time ? ` at ${e.booked_time}` : ''}
          {e.quote_pence != null && ` · ${formatPounds(e.quote_pence)}`}
        </div>
      )}

      <section className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
        <h3 className="font-extrabold">{e.status === 'new' ? 'Reply with a quote' : 'Update your reply'}</h3>
        {(e.preferred || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {e.preferred.map((p) => (
              <button key={p.date} type="button" className={`btn-sm btn border ${date === p.date ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-300'}`}
                onClick={() => { setDate(p.date); setTime({ morning: '09:00', afternoon: '13:00', evening: '17:00' }[p.window] || time) }}>
                {formatDate(p.date)} · {labelFor(TIME_WINDOWS, p.window)}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label" htmlFor="qp">Price £</label>
            <input id="qp" inputMode="decimal" className="field" value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="85" /></div>
          <div><label className="label" htmlFor="qd">Date</label>
            <input id="qd" type="date" className="field !px-2" value={date} onChange={(ev) => setDate(ev.target.value)} /></div>
          <div><label className="label" htmlFor="qt">Time</label>
            <input id="qt" type="time" className="field !px-2" value={time} onChange={(ev) => setTime(ev.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="qm">Message</label>
          <textarea id="qm" rows={4} className="field" value={msg} onChange={(ev) => setMsg(ev.target.value)} /></div>
        <div><label className="label" htmlFor="qn">Private notes <span className="font-normal text-slate-500">(only you see these)</span></label>
          <textarea id="qn" rows={2} className="field" value={notes} onChange={(ev) => setNotes(ev.target.value)} /></div>
        <ErrorNote>{error}</ErrorNote>
        {sent && <div role="status" className="rounded-xl bg-leaf-100 px-3 py-2 text-sm font-semibold">{sent}</div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={sendQuote}>Send quote</button>
          <a className="btn-secondary" href={`https://wa.me/${waNumber(e.phone)}?text=${waText}`} target="_blank" rel="noreferrer">Send by WhatsApp</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" disabled={busy}
            onClick={() => date ? save({ status: 'booked', booked_date: date, booked_time: time || null, quote_pence: price ? Math.round(parseFloat(price) * 100) : null, owner_notes: notes }, 'Marked as booked.') : setError('Choose a date first.')}>
            Mark booked (agreed by phone)
          </button>
          <button className="btn-danger btn-sm" disabled={busy}
            onClick={() => save({ status: 'declined', reply_message: msg.trim() || 'Sorry, we can\'t take this one on.', replied_at: new Date().toISOString(), owner_notes: notes }, 'Enquiry declined.')}>
            Decline
          </button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => save({ owner_notes: notes }, 'Notes saved.')}>Save notes</button>
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
