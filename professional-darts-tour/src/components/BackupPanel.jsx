import { useRef, useState } from 'react'
import { exportSave, listSnapshots, parseSave, restoreSnapshot } from '../backup.js'

// Export / import / automatic snapshots. onRestore(career) replaces the current career.
export default function BackupPanel({ career, onRestore }) {
  const [msg, setMsg] = useState('')
  const file = useRef(null)
  const snaps = listSnapshots()

  async function doExport() {
    try {
      const name = await exportSave(career)
      setMsg(`Saved ${name}. Keep it somewhere safe (email it to yourself, or save it to your cloud drive).`)
    } catch (e) {
      setMsg(`Couldn't export: ${e.message}`)
    }
  }

  function doImport(e) {
    const f = e.target.files?.[0]
    if (!f) return
    f.text().then((text) => {
      try {
        const c = parseSave(text)
        if (window.confirm(`Load ${c.players.user.name}'s career (${c.year} season)? This replaces the career on this device.`)) {
          onRestore(c)
          setMsg('Career loaded.')
        }
      } catch (err) {
        setMsg(err.message)
      }
    })
    e.target.value = ''
  }

  return (
    <div className="card form">
      <div className="card-label">Save backup</div>
      <p className="small-text muted">Your career is saved on this device automatically. Export a save file to keep a copy you can load on a new phone, or if the app is deleted.</p>
      <div className="btn-row tight">
        <button className="btn small primary" onClick={doExport}>Export save file</button>
        <button className="btn small" onClick={() => file.current?.click()}>Load a save file</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={doImport} />
      </div>
      {snaps.length > 0 && (
        <>
          <div className="label">Automatic backups</div>
          <ul className="plain small-text">
            {snaps.map((sn, i) => (
              <li key={sn.savedAt}>
                {new Date(sn.savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}: {sn.year}, before {sn.next}{' '}
                <button className="btn small ghost" onClick={() => { if (window.confirm('Go back to this backup? Progress since then will be lost.')) onRestore(restoreSnapshot(i)) }}>Restore</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {msg && <p className="small-text gold">{msg}</p>}
    </div>
  )
}

// For the start screen: load a career from a file.
export function LoadSaveButton({ onRestore }) {
  const file = useRef(null)
  const [msg, setMsg] = useState('')
  return (
    <>
      <button className="btn ghost" onClick={() => file.current?.click()}>Load a saved career</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => {
        const f = e.target.files?.[0]
        if (!f) return
        f.text().then((text) => {
          try { onRestore(parseSave(text)) } catch (err) { setMsg(err.message) }
        })
      }} />
      {msg && <p className="small-text error">{msg}</p>}
    </>
  )
}
