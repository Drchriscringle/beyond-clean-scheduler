import { useState } from 'react'

const LEVELS = [
  { value: 'beginner', label: 'Beginner — new to the subject' },
  { value: 'intermediate', label: 'Intermediate — has the basics' },
  { value: 'advanced', label: 'Advanced — working practitioner' },
]

const TONES = ['friendly', 'professional', 'energetic', 'academic', 'plain-spoken']

export default function BriefForm({ onSubmit, onCancel, busy }) {
  const [brief, setBrief] = useState({
    topic: '',
    audience: '',
    level: 'beginner',
    tone: 'friendly',
    durationMinutes: 60,
    moduleCount: 4,
    goals: '',
    sourceMaterial: '',
  })

  const set = (key) => (event) => setBrief((current) => ({ ...current, [key]: event.target.value }))

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(brief)
      }}
    >
      <h2>New course</h2>
      <p className="muted small">
        The brief is what the whole build is generated from. The more specific the audience, the less
        generic the course.
      </p>

      <label className="field">
        <span>What is the course about?</span>
        <input
          required
          autoFocus
          value={brief.topic}
          onChange={set('topic')}
          placeholder="Writing incident postmortems that people actually read"
        />
      </label>

      <label className="field">
        <span>Who is it for?</span>
        <input
          required
          value={brief.audience}
          onChange={set('audience')}
          placeholder="On-call backend engineers at a mid-size SaaS company"
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Level</span>
          <select value={brief.level} onChange={set('level')}>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tone</span>
          <select value={brief.tone} onChange={set('tone')}>
            {TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Runtime (minutes)</span>
          <input type="number" min="10" max="1200" value={brief.durationMinutes} onChange={set('durationMinutes')} />
        </label>
        <label className="field">
          <span>Modules</span>
          <input type="number" min="1" max="12" value={brief.moduleCount} onChange={set('moduleCount')} />
        </label>
      </div>

      <label className="field">
        <span>What should learners be able to do afterwards? (optional)</span>
        <textarea
          value={brief.goals}
          onChange={set('goals')}
          placeholder="Run a blameless review, write up a timeline, and land three concrete action items."
        />
      </label>

      <label className="field">
        <span>Source material (optional)</span>
        <textarea
          value={brief.sourceMaterial}
          onChange={set('sourceMaterial')}
          style={{ minHeight: 140 }}
          placeholder="Paste your handbook, runbook, transcript or slide notes. The course is written from this rather than from general knowledge."
        />
      </label>

      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !brief.topic || !brief.audience}>
          {busy ? 'Creating…' : 'Create course'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
