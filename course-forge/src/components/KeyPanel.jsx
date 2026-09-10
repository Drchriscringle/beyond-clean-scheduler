import { useState } from 'react'
import { key } from '../api.js'

/**
 * Where the author supplies their Anthropic key on a hosted deployment.
 * The key stays in this browser; it is sent with a build request and never
 * stored by the server.
 */
export default function KeyPanel({ hasKey, onChange }) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(!hasKey)

  if (hasKey && !open) {
    return (
      <div className="banner ok">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>Your API key is set. It is stored in this browser only.</span>
          <span className="row">
            <button className="btn sm" onClick={() => setOpen(true)}>
              Replace
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                key.set('')
                onChange()
              }}
            >
              Remove
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <form
      className="card"
      style={{ marginBottom: 18 }}
      onSubmit={(event) => {
        event.preventDefault()
        key.set(value.trim())
        setValue('')
        setOpen(false)
        onChange()
      }}
    >
      <h2 style={{ marginTop: 0 }}>Add your Anthropic API key</h2>
      <p className="muted small">
        This studio does not keep a key of its own, so courses are written with yours. It is saved in
        this browser and sent only with the requests that generate a course — it is never stored on the
        server. Without one you can still click around, but courses come out as placeholder text.
      </p>
      <label className="field">
        <span>API key</span>
        <input
          id="anthropic-key"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="sk-ant-..."
        />
      </label>
      <div className="row">
        <button className="btn primary" type="submit" disabled={!value.trim()}>
          Save key
        </button>
        {hasKey && (
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        <a
          className="muted small"
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
        >
          Get a key →
        </a>
      </div>
    </form>
  )
}
