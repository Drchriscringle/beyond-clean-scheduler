import { useEffect, useState } from 'react'
import { api, fromPence, toPence } from '../api.js'

/**
 * Settings, calendar feeds, news sources, accounts and the bank connection.
 *
 * The calendar section carries the instructions for finding a private .ics
 * address, because that is the one step that stops people using a feature like
 * this, and it is different in every calendar app.
 */
export default function Settings({ brief, meta, accounts, onChange }) {
  const [profile, setProfile] = useState(brief.profile)
  const [saved, setSaved] = useState(false)
  const [feeds, setFeeds] = useState([])
  const [sources, setSources] = useState([])
  const [connections, setConnections] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    api.list('feeds').then(setFeeds).catch(() => {})
    api.list('newsSources').then(setSources).catch(() => {})
    api.bankConnections().then(setConnections).catch(() => {})
  }, [])

  const set = (key) => (event) => {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
    setProfile((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  async function saveProfile(event) {
    event.preventDefault()
    await api.saveProfile({
      ...profile,
      bufferPence: toPence(profile.bufferText ?? fromPence(profile.bufferPence)) ?? profile.bufferPence,
    })
    setSaved(true)
    await onChange()
  }

  return (
    <div className="grid">
      <section className="panel">
        <h2>You</h2>
        <form onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" value={profile.name ?? ''} onChange={set('name')} placeholder="Chris" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="p-tz">Timezone</label>
              <input id="p-tz" value={profile.timezone} onChange={set('timezone')} placeholder="Europe/London" />
            </div>
            <div className="field">
              <label htmlFor="p-currency">Currency</label>
              <input id="p-currency" value={profile.currency} onChange={set('currency')} placeholder="GBP" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="p-buffer">Buffer to keep untouched</label>
              <input
                id="p-buffer"
                value={profile.bufferText ?? fromPence(profile.bufferPence)}
                onChange={(event) => {
                  setProfile((current) => ({ ...current, bufferText: event.target.value }))
                  setSaved(false)
                }}
                inputMode="decimal"
                placeholder="250.00"
              />
            </div>
            <div className="field">
              <label htmlFor="p-horizon">Forecast this many days ahead</label>
              <input id="p-horizon" type="number" min="7" max="365" value={profile.horizonDays} onChange={set('horizonDays')} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="p-agenda">Diary window (days)</label>
              <input id="p-agenda" type="number" min="1" max="60" value={profile.agendaDays} onChange={set('agendaDays')} />
            </div>
            <div className="field">
              <label htmlFor="p-news">News window (days)</label>
              <input id="p-news" type="number" min="1" max="30" value={profile.newsDays} onChange={set('newsDays')} />
            </div>
          </div>
          <div className="buttons">
            <button className="action" type="submit">Save</button>
            {saved && <span className="in">Saved.</span>}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Accounts</h2>
        {accounts.length === 0 && <p className="empty">No accounts yet.</p>}
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} onChange={onChange} />
        ))}
        <div className="buttons" style={{ marginTop: '0.7rem' }}>
          <button
            className="quiet"
            onClick={async () => {
              await api.create('accounts', { name: 'New account', balancePence: 0, kind: 'account' })
              await onChange()
            }}
          >
            Add an account
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Calendar feeds</h2>
        <p className="faint" style={{ fontSize: '0.85rem', marginTop: 0 }}>
          Paste the private address of a calendar and its events appear in your diary.
          It is read-only — nothing is ever written back.
        </p>
        <details style={{ marginBottom: '0.8rem' }}>
          <summary className="dim" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Where to find it</summary>
          <ul className="faint" style={{ fontSize: '0.84rem', paddingLeft: '1.1rem' }}>
            <li><strong>Google Calendar</strong> — Settings → your calendar → Integrate calendar → &ldquo;Secret address in iCal format&rdquo;.</li>
            <li><strong>Apple iCloud</strong> — right-click the calendar → Share Calendar → Public Calendar → copy the link.</li>
            <li><strong>Outlook</strong> — Settings → Calendar → Shared calendars → Publish → ICS link.</li>
          </ul>
          <p className="faint" style={{ fontSize: '0.84rem' }}>
            Treat that address like a password: anyone holding it can read the calendar.
          </p>
        </details>

        <UrlList
          items={feeds}
          collection="feeds"
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          namePlaceholder="Work"
          onSaved={async () => { setFeeds(await api.list('feeds')); await onChange() }}
        />
      </section>

      <section className="panel">
        <h2>News sources</h2>
        <p className="faint" style={{ fontSize: '0.85rem', marginTop: 0 }}>
          Any RSS or Atom feed. Everything from these is matched against your whole
          watchlist, on top of the searches each target generates by itself.
        </p>
        <UrlList
          items={sources}
          collection="newsSources"
          placeholder="https://example.com/feed.xml"
          namePlaceholder="Trade journal"
          onSaved={async () => { setSources(await api.list('newsSources')); await onChange() }}
        />
      </section>

      <section className="panel">
        <h2>Bank connection</h2>
        {!meta?.banking?.configured ? (
          <p className="faint" style={{ marginTop: 0, fontSize: '0.88rem' }}>
            Open Banking is not set up, and the dashboard works fully without it —
            statements can be imported by hand instead. To connect a bank, add
            TrueLayer credentials to <code>.env</code> (see <code>.env.example</code>)
            and restart.
          </p>
        ) : (
          <>
            <p className="faint" style={{ marginTop: 0, fontSize: '0.88rem' }}>
              Read-only access to balances and transactions, in the{' '}
              <strong>{meta.banking.environment}</strong> environment. Nothing here can move money.
            </p>
            {connections.map((connection) => (
              <div className="row" key={connection.id}>
                <span className="what">
                  {connection.name}
                  <div className="sub">{connection.accounts?.length ?? 0} accounts</div>
                </span>
                <span className="amount">
                  <button
                    className="link"
                    onClick={async () => {
                      await api.bankDisconnect(connection.id)
                      setConnections(await api.bankConnections())
                    }}
                  >
                    disconnect
                  </button>
                </span>
              </div>
            ))}
            <div className="buttons" style={{ marginTop: '0.7rem' }}>
              <button
                className="action"
                onClick={async () => {
                  const { url } = await api.bankConnect()
                  window.open(url, '_blank', 'noopener')
                }}
              >
                Connect a bank
              </button>
              <button
                className="quiet"
                disabled={busy === 'sync'}
                onClick={async () => {
                  setBusy('sync')
                  try {
                    await api.bankSync()
                    await onChange()
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                {busy === 'sync' ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Data</h2>
        <p className="faint" style={{ marginTop: 0, fontSize: '0.88rem' }}>
          Everything lives in plain JSON files at <code>{meta?.dataDir}</code>. Back it up,
          diff it, move it — it is yours, and nothing here talks to a server but your own.
        </p>
        <div className="buttons">
          <button
            className="quiet"
            onClick={async () => {
              if (confirm('Replace everything with example data?')) {
                await api.loadDemo()
                await onChange()
              }
            }}
          >
            Load example data
          </button>
        </div>
      </section>
    </div>
  )
}

function AccountRow({ account, onChange }) {
  const [name, setName] = useState(account.name)
  const [balance, setBalance] = useState(fromPence(account.balancePence))

  // Name on its own line, then the balance and its buttons: side by side these
  // squeeze the name down to a few characters in a narrow column.
  return (
    <div style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--line)' }}>
      <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Account name" />
      {account.provider && <div className="sub faint">connected · {account.provider}</div>}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
        <input
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
          inputMode="decimal"
          aria-label="Balance"
          style={{ flex: 1, textAlign: 'right' }}
        />
        <button
          className="quiet"
          onClick={async () => {
            await api.update('accounts', account.id, { name, balancePence: toPence(balance) ?? 0 })
            await onChange()
          }}
        >
          Save
        </button>
        <button
          className="link"
          aria-label={`Remove ${account.name}`}
          onClick={async () => {
            if (confirm(`Remove ${account.name}?`)) {
              await api.remove('accounts', account.id)
              await onChange()
            }
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function UrlList({ items, collection, placeholder, namePlaceholder, onSaved }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState(null)

  async function add(event) {
    event.preventDefault()
    if (!url.trim()) return setError('Paste an address first.')
    try {
      await api.create(collection, { name: name.trim() || 'Feed', url: url.trim(), enabled: true })
      setName('')
      setUrl('')
      setError(null)
      await onSaved()
    } catch (addError) {
      setError(addError.message)
    }
  }

  return (
    <>
      {items.map((item) => (
        <div className="row" key={item.id}>
          <span className="what">
            {item.name}
            <div className="sub" style={{ wordBreak: 'break-all' }}>{item.url}</div>
          </span>
          <span className="amount">
            <button
              className="link"
              onClick={async () => { await api.update(collection, item.id, { enabled: item.enabled === false }); await onSaved() }}
            >
              {item.enabled === false ? 'enable' : 'pause'}
            </button>{' '}
            <button
              className="link"
              onClick={async () => { await api.remove(collection, item.id); await onSaved() }}
            >
              remove
            </button>
          </span>
        </div>
      ))}

      <form onSubmit={add} style={{ marginTop: '0.7rem' }}>
        {error && <div className="problem">{error}</div>}
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={namePlaceholder} />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={placeholder} />
          </div>
        </div>
        <button className="quiet" type="submit">Add</button>
      </form>
    </>
  )
}
