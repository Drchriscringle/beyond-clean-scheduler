import { useState } from 'react'
import Newspaper from './Newspaper.jsx'

export default function Inbox({ career, update, onAction, initialOpen = null }) {
  const [openId, setOpenId] = useState(initialOpen)
  const open = career.inbox.find((m) => m.id === openId)

  function view(m) {
    setOpenId(m.id)
    if (!m.read) update((c) => { const x = c.inbox.find((y) => y.id === m.id); if (x) x.read = true })
  }

  if (open) {
    return (
      <div className="tab-body">
        <button className="btn ghost small back" onClick={() => setOpenId(null)}>‹ Inbox</button>
        {open.article ? <Newspaper article={open.article} career={career} /> : (
        <div className="card mail">
          <div className="mail-from">{open.from}</div>
          <h2>{open.subject}</h2>
          <div className="muted small-text">{open.date}</div>
          {open.body.split('\n').map((para, i) => <p key={i}>{para}</p>)}
          {open.actions && !open.resolved && (
            <div className="btn-row">
              {open.actions.map((a, i) => <button key={a.action} className={`btn ${i === 0 ? 'primary' : ''}`} onClick={() => onAction(open.id, a.action, a.payload)}>{a.label}</button>)}
            </div>
          )}
          {open.resolved && <p className="tag done">{open.resolved}</p>}
        </div>
        )}
      </div>
    )
  }

  return (
    <div className="tab-body">
      <div className="btn-row tight">
        <button className="btn small ghost" onClick={() => update((c) => c.inbox.forEach((m) => { m.read = true }))}>Mark all read</button>
      </div>
      <ul className="inbox">
        {career.inbox.map((m) => (
          <li key={m.id} className={m.read ? '' : 'unread'} onClick={() => view(m)}>
            <div className="mail-row-top"><span className="mail-from">{m.from}</span><span className="muted small-text">{m.date.slice(5)}</span></div>
            <div className="mail-subject">{m.subject}{m.actions && !m.resolved ? <span className="tag pending">Action needed</span> : null}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
