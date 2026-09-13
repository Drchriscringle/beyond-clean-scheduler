import { useRef, useState } from 'react'
import { api, fromPence, money, toPence } from '../api.js'
import ForecastChart from '../components/ForecastChart.jsx'

/**
 * The money panel: what is set up, what is coming, and what the bank actually
 * did about it.
 */
export default function Money({ brief, meta, commitments, accounts, onChange }) {
  const currency = { currency: brief.profile.currency, locale: brief.profile.locale }
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(null)
  const fileInput = useRef(null)
  const purse = brief.money

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setImporting({ busy: true })
    try {
      const result = await api.importCsv(await file.text(), { accountId: accounts[0]?.id })
      setImporting(result)
      await onChange()
    } catch (error) {
      setImporting({ error: error.message })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const outgoings = commitments.filter((entry) => entry.kind !== 'income')
  const incomes = commitments.filter((entry) => entry.kind === 'income')

  // When each commitment is *next* due, rather than the date its schedule is
  // anchored to — "next: 1 September" on the 13th is no use to anyone. Days
  // arrive in order, so the first sighting of a commitment is its next one.
  const nextDue = new Map()
  for (const day of purse.days) {
    for (const movement of day.movements) {
      if (!nextDue.has(movement.commitmentId)) nextDue.set(movement.commitmentId, movement.day)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--gap)' }}>
      <section className="panel">
        <h2>
          Forecast
          <span className="right faint">to {purse.horizonEnd}</span>
        </h2>
        <div className="figures">
          <Figure label="Balance now" value={money(purse.openingPence, currency)} />
          <Figure
            label="Lowest point"
            value={money(purse.lowest.balancePence, currency)}
            note={purse.lowest.day}
            tone={purse.lowest.balancePence < 0 ? 'bad' : purse.lowest.balancePence < brief.profile.bufferPence ? 'warn' : ''}
          />
          <Figure label="Money in" value={money(purse.totals.incomePence, currency)} tone="in" />
          <Figure label="Money out" value={money(purse.totals.outgoingPence, currency)} tone="out" />
        </div>
        <ForecastChart days={purse.days} bufferPence={brief.profile.bufferPence} currency={currency} />
        {purse.breaches.length > 0 && (
          <div style={{ marginTop: '0.8rem' }}>
            {purse.breaches.slice(0, 4).map((breach) => (
              <div key={breach.day} className={breach.belowZero ? 'bad' : 'warn'} style={{ fontSize: '0.88rem' }}>
                {breach.day} — {money(breach.balancePence, currency)}
                {breach.trigger ? ` after ${breach.trigger}` : ''}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid">
        <section className="panel">
          <h2>
            What the bank did
            <span className="right faint">last 35 days</span>
          </h2>

          {!purse.hasTransactions ? (
            <p className="empty">
              Import a bank statement to check your bills against what actually left the account.
            </p>
          ) : (
            <>
              <p className="dim" style={{ marginTop: 0, fontSize: '0.88rem' }}>
                {purse.reconciliation.paid} payment{purse.reconciliation.paid === 1 ? '' : 's'} matched what you expected.
              </p>

              {purse.reconciliation.missing.map((entry) => (
                <div className="row" key={entry.id}>
                  <span className="when warn">missing</span>
                  <span className="what">
                    {entry.name}
                    <div className="sub">due {entry.day}, nothing left the account</div>
                  </span>
                  <span className="amount out">{money(entry.amountPence, currency)}</span>
                </div>
              ))}

              {purse.reconciliation.changed.map((entry) => (
                <div className="row" key={entry.id}>
                  <span className="when">changed</span>
                  <span className="what">
                    {entry.name}
                    <div className="sub">
                      expected {money(entry.amountPence, currency)}, paid {money(entry.paidPence, currency)}
                    </div>
                  </span>
                  <span className={`amount ${entry.deltaPence < 0 ? 'out' : 'in'}`}>
                    {money(entry.deltaPence, { ...currency, signed: true })}
                  </span>
                </div>
              ))}

              {purse.reconciliation.unexpected.length > 0 && (
                <>
                  <h2 style={{ marginTop: '1rem' }}>Recurring, but not in your list</h2>
                  {purse.reconciliation.unexpected.map((entry) => (
                    <div className="row" key={entry.key}>
                      <span className="when">{entry.frequency}</span>
                      <span className="what">
                        {entry.description}
                        <div className="sub">
                          seen {entry.occurrences} times · {money(entry.annualPence, currency)} a year
                        </div>
                      </span>
                      <span className="amount out">{money(-entry.amountPence, currency)}</span>
                    </div>
                  ))}
                </>
              )}

              {purse.reconciliation.missing.length === 0
                && purse.reconciliation.changed.length === 0
                && purse.reconciliation.unexpected.length === 0 && (
                <p className="empty">Everything came out as expected.</p>
              )}
            </>
          )}

          <div className="buttons" style={{ marginTop: '0.9rem' }}>
            <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
            <button className="quiet" onClick={() => fileInput.current?.click()}>Import a statement (CSV)</button>
            {purse.hasTransactions && (
              <button className="link" onClick={async () => { await api.clearTransactions(); await onChange() }}>
                clear imported
              </button>
            )}
          </div>
          {importing?.added !== undefined && (
            <p className="faint" style={{ fontSize: '0.85rem' }}>
              Read {importing.read}, added {importing.added}, {importing.duplicates} already held
              {importing.skipped?.length ? `, ${importing.skipped.length} skipped` : ''}.
            </p>
          )}
          {importing?.error && <div className="problem">{importing.error}</div>}
        </section>

        <section className="panel">
          <h2>What it all costs</h2>
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">A month</th>
                <th className="num">A year</th>
              </tr>
            </thead>
            <tbody>
              {purse.breakdown.map((row) => (
                <tr key={row.category}>
                  <td className={row.category === 'income' ? 'in' : ''}>{label(row.category)}</td>
                  <td className="num">{money(row.monthlyPence, currency)}</td>
                  <td className="num">{money(row.annualPence, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {purse.breakdown.length === 0 && <p className="empty">Add some commitments to see this.</p>}
        </section>
      </div>

      <section className="panel">
        <h2>
          Money in
          <span className="right">
            <button className="quiet" onClick={() => setEditing({ kind: 'income' })}>Add income</button>
          </span>
        </h2>
        <CommitmentTable
          rows={incomes}
          meta={meta}
          currency={currency}
          nextDue={nextDue}
          onEdit={setEditing}
          onChange={onChange}
          empty="No income set up. Add your salary so the dashboard knows when payday is."
        />
      </section>

      <section className="panel">
        <h2>
          Money out
          <span className="right">
            <button className="quiet" onClick={() => setEditing({ kind: 'outgoing' })}>Add a payment</button>
          </span>
        </h2>
        <CommitmentTable
          rows={outgoings}
          meta={meta}
          currency={currency}
          nextDue={nextDue}
          onEdit={setEditing}
          onChange={onChange}
          empty="No direct debits or bills yet."
        />
      </section>

      {editing && (
        <CommitmentForm
          commitment={editing}
          meta={meta}
          accounts={accounts}
          onCancel={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onChange() }}
        />
      )}
    </div>
  )
}

function Figure({ label, value, note, tone = '' }) {
  return (
    <div className="figure">
      <div className="label">{label}</div>
      <div className={`value ${tone}`}>{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  )
}

function CommitmentTable({ rows, meta, currency, onEdit, onChange, empty, nextDue }) {
  if (rows.length === 0) return <p className="empty">{empty}</p>
  return (
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>How often</th>
          <th>Next</th>
          <th className="num">Amount</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} style={{ opacity: row.active === false ? 0.5 : 1 }}>
            <td>
              {row.name}
              {row.variable && <span className="faint"> · estimated</span>}
            </td>
            <td className="dim">{meta?.frequencies?.[row.schedule?.frequency]?.label ?? row.schedule?.frequency}</td>
            <td className="dim">{nextDue?.get(row.id) ?? (row.active === false ? 'paused' : '—')}</td>
            <td className={`num ${row.kind === 'income' ? 'in' : 'out'}`}>{money(row.amountPence, currency)}</td>
            <td className="num">
              <button className="link" onClick={() => onEdit(row)}>edit</button>{' '}
              <button
                className="link"
                onClick={async () => {
                  if (confirm(`Remove ${row.name}?`)) {
                    await api.remove('commitments', row.id)
                    await onChange()
                  }
                }}
              >
                remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

function CommitmentForm({ commitment, meta, accounts, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: commitment.name ?? '',
    kind: commitment.kind ?? 'outgoing',
    category: commitment.category ?? (commitment.kind === 'income' ? 'salary' : 'direct-debit'),
    amount: fromPence(commitment.amountPence),
    frequency: commitment.schedule?.frequency ?? 'monthly',
    anchor: commitment.schedule?.anchor ?? new Date().toISOString().slice(0, 10),
    shift: commitment.schedule?.shift ?? (commitment.kind === 'income' ? 'before' : 'after'),
    endOn: commitment.schedule?.endOn ?? '',
    variable: Boolean(commitment.variable),
    accountId: commitment.accountId ?? accounts[0]?.id ?? '',
    active: commitment.active !== false,
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    const amountPence = toPence(form.amount)
    if (!form.name.trim()) return setError('Give it a name.')
    if (amountPence === null || amountPence === 0) return setError('Give it an amount.')

    const record = {
      name: form.name.trim(),
      kind: form.kind,
      category: form.category,
      amountPence: Math.abs(amountPence),
      variable: form.variable,
      accountId: form.accountId || null,
      active: form.active,
      schedule: {
        frequency: form.frequency,
        anchor: form.anchor,
        shift: form.shift,
        endOn: form.endOn || null,
      },
    }

    setSaving(true)
    try {
      if (commitment.id) await api.update('commitments', commitment.id, record)
      else await api.create('commitments', record)
      await onSaved()
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <h2>{commitment.id ? `Edit ${commitment.name}` : `New ${form.kind === 'income' ? 'income' : 'payment'}`}</h2>
      <form onSubmit={save}>
        {error && <div className="problem">{error}</div>}
        <div className="field-row">
          <div className="field">
            <label htmlFor="c-name">Name</label>
            <input id="c-name" value={form.name} onChange={set('name')} placeholder="Council tax" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="c-amount">Amount</label>
            <input id="c-amount" value={form.amount} onChange={set('amount')} placeholder="185.00" inputMode="decimal" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="c-kind">Direction</label>
            <select id="c-kind" value={form.kind} onChange={set('kind')}>
              <option value="outgoing">Money out</option>
              <option value="income">Money in</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-category">Category</label>
            <select id="c-category" value={form.category} onChange={set('category')}>
              {(meta?.categories ?? []).map((category) => (
                <option key={category} value={category}>{label(category)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="c-frequency">How often</label>
            <select id="c-frequency" value={form.frequency} onChange={set('frequency')}>
              {Object.entries(meta?.frequencies ?? {}).map(([value, entry]) => (
                <option key={value} value={value}>{entry.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-anchor">
              {form.frequency === 'one-off' ? 'On' : 'First (or next) one'}
            </label>
            <input id="c-anchor" type="date" value={form.anchor} onChange={set('anchor')} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="c-shift">If it falls on a weekend or bank holiday</label>
            <select id="c-shift" value={form.shift} onChange={set('shift')}>
              {Object.entries(meta?.shifts ?? {}).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-end">Ends (optional)</label>
            <input id="c-end" type="date" value={form.endOn} onChange={set('endOn')} />
          </div>
        </div>

        <div className="buttons" style={{ marginBottom: '0.8rem' }}>
          <label><input type="checkbox" checked={form.variable} onChange={set('variable')} style={{ width: 'auto' }} /> Amount varies (an estimate)</label>
          <label><input type="checkbox" checked={form.active} onChange={set('active')} style={{ width: 'auto' }} /> Active</label>
        </div>

        <div className="buttons">
          <button className="action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="quiet" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

function label(value) {
  return String(value).replace(/-/g, ' ').replace(/^./, (character) => character.toUpperCase())
}
