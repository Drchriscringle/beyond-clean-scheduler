import { useState } from 'react'
import { api } from '../api.js'

/**
 * The news reel and the watchlist behind it.
 *
 * A target is just a name plus the words that make it unambiguous. The reel is
 * only as good as those, so the form makes aliases and exclusions first-class
 * rather than hiding them behind "advanced".
 */
export default function Reel({ brief, meta, targets, onChange }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState(null)
  const news = brief.news

  const shown = filter ? news.items.filter((item) => item.targets.some((target) => target.id === filter)) : news.items

  return (
    <div className="grid wide">
      <section className="panel">
        <h2>
          The reel
          <span className="right faint">last {brief.profile.newsDays} days</span>
        </h2>

        {news.error && <div className="problem">The reel could not be built — {news.error}</div>}
        {news.problems?.length > 0 && (
          <div className="problem">
            {news.problems.length} source{news.problems.length === 1 ? '' : 's'} could not be reached.
          </div>
        )}

        {news.targets?.length > 0 && (
          <div className="buttons" style={{ marginBottom: '0.8rem' }}>
            <button className="quiet" onClick={() => setFilter(null)} aria-pressed={filter === null}>
              Everything
            </button>
            {news.targets.map((target) => (
              <button
                key={target.id}
                className="quiet"
                aria-pressed={filter === target.id}
                onClick={() => setFilter(filter === target.id ? null : target.id)}
                style={filter === target.id ? { color: 'var(--ink)', borderColor: 'var(--accent)' } : undefined}
              >
                {target.name} <span className="faint">{target.count}</span>
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 && (
          <p className="empty">
            {targets.length === 0
              ? 'Add something to your watchlist and the reel fills itself.'
              : 'Nothing new about your watchlist in this window.'}
          </p>
        )}

        {shown.map((item, index) => (
          <article className="story" key={item.url ?? index}>
            <a href={item.url} target="_blank" rel="noreferrer noopener">{item.title}</a>
            <div className="meta">
              {item.targets.map((target) => (
                <span className={`tag ${target.kind}`} key={target.id}>{target.name}</span>
              ))}
              <span>{item.sources.join(', ')}</span>
              {item.publishedAt && <span>{timeAgo(item.publishedAt)}</span>}
              <button
                className="dismiss"
                title="Not interested"
                onClick={async () => {
                  await api.dismissStory(item.url ?? item.title)
                  await onChange()
                }}
              >
                ×
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>
          Watchlist
          <span className="right">
            <button className="quiet" onClick={() => { setAdding(true); setEditing(null) }}>Add</button>
          </span>
        </h2>

        {targets.length === 0 && <p className="empty">Nothing watched yet.</p>}

        {targets.map((target) => (
          <div className="row" key={target.id}>
            <span className="what">
              <span className={`tag ${target.kind}`}>{kindLabel(target.kind, meta)}</span>{' '}
              {target.name}
              {target.aliases?.length > 0 && <div className="sub">also: {target.aliases.join(', ')}</div>}
              {target.exclude?.length > 0 && <div className="sub">not: {target.exclude.join(', ')}</div>}
            </span>
            <span className="amount">
              <button className="link" onClick={() => { setEditing(target); setAdding(false) }}>edit</button>{' '}
              <button
                className="link"
                onClick={async () => {
                  if (confirm(`Stop watching ${target.name}?`)) {
                    await api.remove('targets', target.id)
                    await onChange()
                  }
                }}
              >
                remove
              </button>
            </span>
          </div>
        ))}

        {(adding || editing) && (
          <TargetForm
            target={editing ?? {}}
            meta={meta}
            onCancel={() => { setAdding(false); setEditing(null) }}
            onSaved={async () => { setAdding(false); setEditing(null); await onChange() }}
          />
        )}

        <p className="faint" style={{ fontSize: '0.82rem', marginBottom: 0 }}>
          Each name becomes a news search automatically. You can also subscribe to a
          specific feed — a regulator, a trade journal, a competitor&rsquo;s blog — in Settings.
        </p>
      </section>
    </div>
  )
}

function TargetForm({ target, meta, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: target.name ?? '',
    kind: target.kind ?? 'company',
    aliases: (target.aliases ?? []).join(', '),
    exclude: (target.exclude ?? []).join(', '),
    mustInclude: (target.mustInclude ?? []).join(', '),
  })
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const split = (value) => value.split(',').map((entry) => entry.trim()).filter(Boolean)

  async function save(event) {
    event.preventDefault()
    if (!form.name.trim()) return setError('Give it a name.')
    const record = {
      name: form.name.trim(),
      kind: form.kind,
      aliases: split(form.aliases),
      exclude: split(form.exclude),
      mustInclude: split(form.mustInclude),
      active: true,
    }
    try {
      if (target.id) await api.update('targets', target.id, record)
      else await api.create('targets', record)
      await onSaved()
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <form onSubmit={save} style={{ marginTop: '0.9rem', borderTop: '1px solid var(--line)', paddingTop: '0.9rem' }}>
      {error && <div className="problem">{error}</div>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="t-name">Name</label>
          <input id="t-name" value={form.name} onChange={set('name')} placeholder="Acme Group" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="t-kind">What is it</label>
          <select id="t-kind" value={form.kind} onChange={set('kind')}>
            {Object.entries(meta?.targetKinds ?? { company: 'Company', person: 'Person', topic: 'Topic' }).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-aliases">Also known as <span className="faint">(comma separated)</span></label>
        <input id="t-aliases" value={form.aliases} onChange={set('aliases')} placeholder="Acme Holdings, Acme Ltd" />
      </div>
      <div className="field">
        <label htmlFor="t-exclude">Never about <span className="faint">(kills the noise)</span></label>
        <input id="t-exclude" value={form.exclude} onChange={set('exclude')} placeholder="predators, wildlife" />
      </div>
      <div className="field">
        <label htmlFor="t-must">Only when it also mentions <span className="faint">(optional)</span></label>
        <input id="t-must" value={form.mustInclude} onChange={set('mustInclude')} placeholder="contract, acquisition" />
      </div>
      <div className="buttons">
        <button className="action" type="submit">Save</button>
        <button className="quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function kindLabel(kind, meta) {
  return (meta?.targetKinds?.[kind] ?? kind ?? 'topic').split(' ')[0]
}

function timeAgo(iso) {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000
  if (!Number.isFinite(hours)) return ''
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}
