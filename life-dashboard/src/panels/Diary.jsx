import { useState } from 'react'
import { api } from '../api.js'

/** The full diary, and the place to add something that is not in a calendar. */
export default function Diary({ brief, onChange }) {
  const [adding, setAdding] = useState(false)
  const agenda = brief.agenda

  return (
    <div className="grid wide">
      <section className="panel">
        <h2>
          Diary
          <span className="right faint">next {agenda.windowDays} days</span>
        </h2>

        {agenda.error && <div className="problem">{agenda.error}</div>}
        {agenda.problems?.map((problem, index) => (
          <div key={index} className="problem">{problem.feed} — {problem.error}</div>
        ))}

        {agenda.days.length === 0 && <p className="empty">Nothing in the diary for this window.</p>}

        {agenda.days.map((day) => (
          <div className="daygroup" key={day.day}>
            <h3>{day.label}<span className="rel">{day.relative}</span></h3>
            <div className="rows">
              {day.entries.map((entry) => (
                <div className="row" key={entry.id}>
                  <span className="when">{entry.time ?? 'all day'}</span>
                  <span className="what">
                    {entry.title}
                    <div className="sub">
                      {[entry.location, entry.source?.name].filter(Boolean).join(' · ')}
                    </div>
                  </span>
                  {entry.source?.kind === 'own' && (
                    <span className="amount">
                      <button
                        className="link"
                        onClick={async () => {
                          if (confirm(`Remove "${entry.title}"?`)) {
                            await api.remove('events', entry.eventId)
                            await onChange()
                          }
                        }}
                      >
                        remove
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>
          Add an event
          {!adding && (
            <span className="right">
              <button className="quiet" onClick={() => setAdding(true)}>New</button>
            </span>
          )}
        </h2>
        {adding ? (
          <EventForm
            onCancel={() => setAdding(false)}
            onSaved={async () => { setAdding(false); await onChange() }}
          />
        ) : (
          <p className="faint" style={{ fontSize: '0.85rem' }}>
            For things that are not in a calendar you subscribe to. Subscribed
            calendars stay read-only, so anything added here lives only in this
            dashboard.
          </p>
        )}
      </section>
    </div>
  )
}

function EventForm({ onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    day: new Date().toISOString().slice(0, 10),
    time: '',
    endTime: '',
    location: '',
    repeat: '',
  })
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const REPEATS = {
    '': 'Does not repeat',
    'FREQ=DAILY': 'Every day',
    'FREQ=WEEKLY': 'Every week',
    'FREQ=WEEKLY;INTERVAL=2': 'Every two weeks',
    'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR': 'Every weekday',
    'FREQ=MONTHLY': 'Every month',
    'FREQ=YEARLY': 'Every year',
  }

  async function save(event) {
    event.preventDefault()
    if (!form.title.trim()) return setError('Give it a title.')
    try {
      await api.create('events', {
        title: form.title.trim(),
        day: form.day,
        time: form.time || null,
        endTime: form.endTime || null,
        location: form.location.trim() || null,
        rrule: form.repeat || null,
      })
      await onSaved()
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <form onSubmit={save}>
      {error && <div className="problem">{error}</div>}
      <div className="field">
        <label htmlFor="e-title">What</label>
        <input id="e-title" value={form.title} onChange={set('title')} placeholder="Dentist" autoFocus />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="e-day">When</label>
          <input id="e-day" type="date" value={form.day} onChange={set('day')} />
        </div>
        <div className="field">
          <label htmlFor="e-time">Time <span className="faint">(leave blank for all day)</span></label>
          <input id="e-time" type="time" value={form.time} onChange={set('time')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="e-end">Until</label>
          <input id="e-end" type="time" value={form.endTime} onChange={set('endTime')} />
        </div>
        <div className="field">
          <label htmlFor="e-repeat">Repeats</label>
          <select id="e-repeat" value={form.repeat} onChange={set('repeat')}>
            {Object.entries(REPEATS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="e-where">Where</label>
        <input id="e-where" value={form.location} onChange={set('location')} placeholder="Optional" />
      </div>
      <div className="buttons">
        <button className="action" type="submit">Save</button>
        <button className="quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
