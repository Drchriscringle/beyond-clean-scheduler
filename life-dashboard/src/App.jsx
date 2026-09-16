import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import Today from './panels/Today.jsx'
import Money from './panels/Money.jsx'
import Diary from './panels/Diary.jsx'
import Plans from './panels/Plans.jsx'
import Reel from './panels/Reel.jsx'
import Settings from './panels/Settings.jsx'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'money', label: 'Money' },
  { id: 'diary', label: 'Diary' },
  { id: 'plans', label: 'Plans' },
  { id: 'reel', label: 'Reel' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [tab, setTab] = useState(() => window.location.hash.slice(1) || 'today')
  const [brief, setBrief] = useState(null)
  const [meta, setMeta] = useState(null)
  const [lists, setLists] = useState({ commitments: [], accounts: [], targets: [] })
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ news = true } = {}) => {
    setRefreshing(true)
    try {
      const [nextBrief, commitments, accounts, targets] = await Promise.all([
        api.brief({ news }),
        api.list('commitments'),
        api.list('accounts'),
        api.list('targets'),
      ])
      setBrief(nextBrief)
      setLists({ commitments, accounts, targets })
      setError(null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {})
    load()
  }, [load])

  useEffect(() => {
    if (window.location.hash.slice(1) !== tab) window.location.hash = tab
  }, [tab])

  // The hash is the address of the panel you are on, so the browser's back and
  // forward buttons have to move between them — writing the hash without
  // listening for it leaves those buttons doing nothing.
  useEffect(() => {
    const onHashChange = () => setTab(window.location.hash.slice(1) || 'today')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // The day rolls over while the page is open; a dashboard still showing
  // yesterday at nine in the morning is worse than useless.
  useEffect(() => {
    const timer = setInterval(() => load(), 15 * 60 * 1000)
    return () => clearInterval(timer)
  }, [load])

  if (error && !brief) {
    return (
      <div className="app">
        <div className="problem">Could not reach the dashboard server — {error}</div>
      </div>
    )
  }

  if (!brief) return <div className="loading">Building your day…</div>

  const counts = {
    money: brief.money.reconciliation.missing.length + brief.money.reconciliation.changed.length,
    plans: brief.objectives.overdue.length + brief.objectives.stalled.length,
    reel: brief.news.items.length,
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>{brief.greeting}</h1>
        <span className="date">{brief.heading}</span>
        <span className="spacer" />
        <button className="quiet" onClick={() => load()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="problem">{error}</div>}

      <nav className="tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id}
          >
            {entry.label}
            {counts[entry.id] > 0 && <span className="count">{counts[entry.id]}</span>}
          </button>
        ))}
      </nav>

      {tab === 'today' && (
        <Today
          brief={brief}
          onTickStep={async (objectiveId, stepId, done) => {
            await api.tickStep(objectiveId, stepId, done)
            await load({ news: false })
          }}
        />
      )}
      {tab === 'money' && (
        <Money
          brief={brief}
          meta={meta}
          commitments={lists.commitments}
          accounts={lists.accounts}
          onChange={() => load({ news: false })}
        />
      )}
      {tab === 'diary' && <Diary brief={brief} onChange={() => load({ news: false })} />}
      {tab === 'plans' && <Plans brief={brief} meta={meta} onChange={() => load({ news: false })} />}
      {tab === 'reel' && <Reel brief={brief} meta={meta} targets={lists.targets} onChange={() => load()} />}
      {tab === 'settings' && (
        <Settings brief={brief} meta={meta} accounts={lists.accounts} onChange={() => load({ news: false })} />
      )}
    </div>
  )
}
