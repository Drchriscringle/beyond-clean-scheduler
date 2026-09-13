import { formatShortDate } from '../lib/format.js'

export default function Milestones({ milestones }) {
  if (milestones.length === 0) return null

  return (
    <section className="panel">
      <h2 className="panel-title">Things still to come</h2>
      <p className="panel-note">
        Whether the estimate has you there for them. It is an average, so the far ones are a
        question rather than an answer.
      </p>
      <ul className="milestones">
        {milestones.map((milestone) => (
          <li className={milestone.likely ? 'milestone' : 'milestone unlikely'} key={milestone.id}>
            <span className="milestone-name">
              {milestone.label}
              <span className={milestone.likely ? 'tag yes' : 'tag no'}>
                {milestone.likely ? 'Likely' : 'Long shot'}
              </span>
            </span>
            <span className="milestone-date">{formatShortDate(milestone.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
