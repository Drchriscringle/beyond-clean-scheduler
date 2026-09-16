import { useState } from 'react'
import { api } from '../api.js'

/** Objectives, their steps, and an honest account of what has stopped moving. */
export default function Plans({ brief, meta, onChange }) {
  const [adding, setAdding] = useState(false)
  const plans = brief.objectives

  const groups = [
    { key: 'overdue', title: 'Overdue', entries: plans.overdue },
    { key: 'stalled', title: 'Not moving', entries: plans.stalled },
    {
      key: 'active',
      title: 'In progress',
      entries: plans.active.filter((entry) => !entry.overdue && !entry.stalled),
    },
    { key: 'done', title: 'Done', entries: plans.done },
  ].filter((group) => group.entries.length > 0)

  return (
    <div style={{ display: 'grid', gap: 'var(--gap)' }}>
      <section className="panel">
        <h2>
          Objectives
          <span className="right">
            <button className="quiet" onClick={() => setAdding(true)}>Add an objective</button>
          </span>
        </h2>

        {plans.all.length === 0 && (
          <p className="empty">
            No objectives yet. An objective works best with one number to move and one next step.
          </p>
        )}

        {groups.map((group) => (
          <div key={group.key} className="daygroup">
            <h3>
              {group.title}
              <span className="rel">{group.entries.length}</span>
            </h3>
            {group.entries.map((objective) => (
              <Objective key={objective.id} objective={objective} onChange={onChange} />
            ))}
          </div>
        ))}

        {adding && (
          <ObjectiveForm
            meta={meta}
            onCancel={() => setAdding(false)}
            onSaved={async () => { setAdding(false); await onChange() }}
          />
        )}
      </section>
    </div>
  )
}

function Objective({ objective, onChange }) {
  const [metric, setMetric] = useState(objective.metric?.current ?? '')
  const state = objective.overdue ? 'late' : objective.progress.fraction >= 1 ? 'done' : ''

  return (
    <div className="objective">
      <div className="title">
        <strong>{objective.title}</strong>
        <span className="faint">{objective.horizon}</span>
        {objective.overdue && <span className="bad">overdue {objective.dueLabel}</span>}
        {!objective.overdue && objective.stalled && (
          <span className="warn">no movement in {objective.idleDays} days</span>
        )}
        {!objective.overdue && !objective.stalled && objective.dueOn && (
          <span className="faint">due {objective.dueLabel}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {objective.state === 'active' ? (
            <button
              className="link"
              onClick={async () => { await api.update('objectives', objective.id, { state: 'done' }); await onChange() }}
            >
              mark done
            </button>
          ) : (
            <button
              className="link"
              onClick={async () => { await api.update('objectives', objective.id, { state: 'active' }); await onChange() }}
            >
              reopen
            </button>
          )}{' '}
          <button
            className="link"
            onClick={async () => {
              if (confirm(`Remove "${objective.title}"?`)) {
                await api.remove('objectives', objective.id)
                await onChange()
              }
            }}
          >
            remove
          </button>
        </span>
      </div>

      {objective.detail && <p className="dim" style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>{objective.detail}</p>}

      <div className={`meter ${state}`}>
        <span style={{ width: `${Math.round(objective.progress.fraction * 100)}%` }} />
      </div>
      {objective.progress.label && (
        <div className="faint" style={{ fontSize: '0.82rem' }}>{objective.progress.label}</div>
      )}

      {objective.metric && (
        <div className="buttons" style={{ marginTop: '0.4rem' }}>
          <label className="faint" style={{ fontSize: '0.82rem' }}>
            {objective.metric.name || 'Now at'}
          </label>
          <input
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
            inputMode="decimal"
            style={{ width: '6rem' }}
          />
          <button
            className="quiet"
            onClick={async () => {
              await api.setMetric(objective.id, Number(metric))
              await onChange()
            }}
          >
            Update
          </button>
        </div>
      )}

      {objective.steps?.length > 0 && (
        <ul className="steps">
          {objective.steps.map((step) => (
            <li key={step.id}>
              <input
                type="checkbox"
                checked={step.done}
                id={`plan-${objective.id}-${step.id}`}
                onChange={async (event) => {
                  await api.tickStep(objective.id, step.id, event.target.checked)
                  await onChange()
                }}
              />
              <label htmlFor={`plan-${objective.id}-${step.id}`} className={step.done ? 'done' : ''}>
                {step.title}
                {step.dueOn && !step.done && <span className="faint"> · due {step.dueOn}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ObjectiveForm({ meta, onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    detail: '',
    horizon: 'quarter',
    dueOn: '',
    metricName: '',
    metricStart: '',
    metricCurrent: '',
    metricGoal: '',
    steps: '',
  })
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function save(event) {
    event.preventDefault()
    if (!form.title.trim()) return setError('Give it a title.')

    const steps = form.steps
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title, index) => ({ id: `step-${index + 1}`, title }))

    const hasMetric = form.metricGoal !== ''
    try {
      await api.create('objectives', {
        title: form.title.trim(),
        detail: form.detail.trim(),
        horizon: form.horizon,
        dueOn: form.dueOn || null,
        steps,
        metric: hasMetric
          ? {
            name: form.metricName.trim(),
            start: Number(form.metricStart || 0),
            current: Number(form.metricCurrent || 0),
            goal: Number(form.metricGoal),
          }
          : null,
      })
      await onSaved()
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <form onSubmit={save} style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
      {error && <div className="problem">{error}</div>}
      <div className="field">
        <label htmlFor="o-title">What are you trying to do</label>
        <input id="o-title" value={form.title} onChange={set('title')} placeholder="Land three retainer clients" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="o-detail">Any detail worth keeping</label>
        <input id="o-detail" value={form.detail} onChange={set('detail')} placeholder="Recurring revenue, not one-off projects" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="o-horizon">Horizon</label>
          <select id="o-horizon" value={form.horizon} onChange={set('horizon')}>
            {Object.entries(meta?.horizons ?? {}).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="o-due">Due by (optional)</label>
          <input id="o-due" type="date" value={form.dueOn} onChange={set('dueOn')} />
        </div>
      </div>

      <p className="faint" style={{ fontSize: '0.82rem', margin: '0.4rem 0 0.2rem' }}>
        One number to move, if there is one. Progress is measured on this rather than on ticked boxes.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="o-mname">What you are counting</label>
          <input id="o-mname" value={form.metricName} onChange={set('metricName')} placeholder="retainers" />
        </div>
        <div className="field">
          <label htmlFor="o-mgoal">Target</label>
          <input id="o-mgoal" value={form.metricGoal} onChange={set('metricGoal')} inputMode="decimal" placeholder="3" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="o-mstart">Started at</label>
          <input id="o-mstart" value={form.metricStart} onChange={set('metricStart')} inputMode="decimal" placeholder="0" />
        </div>
        <div className="field">
          <label htmlFor="o-mcurrent">Now at</label>
          <input id="o-mcurrent" value={form.metricCurrent} onChange={set('metricCurrent')} inputMode="decimal" placeholder="1" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="o-steps">Steps, one per line</label>
        <textarea id="o-steps" rows="4" value={form.steps} onChange={set('steps')} placeholder={'Write the one-page offer\nSend the proposal'} />
      </div>

      <div className="buttons">
        <button className="action" type="submit">Save</button>
        <button className="quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
