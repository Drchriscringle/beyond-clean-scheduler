import { formatCount } from '../lib/format.js'

export default function CounterGrid({ groups }) {
  return (
    <section className="panel">
      <h2 className="panel-title">What that adds up to</h2>
      <p className="panel-note">Everything below is counted between right now and that date.</p>
      {groups.map((group) => (
        <div className="counter-group" key={group.id}>
          <h3 className="panel-title">{group.title}</h3>
          {group.note ? <p className="panel-note">{group.note}</p> : null}
          <div className="counter-grid">
            {group.items.map((item) => (
              <div className={item.accent ? 'counter accent' : 'counter'} key={item.id}>
                <div className="counter-value">
                  {formatCount(item.value, { compact: item.compact })}
                </div>
                <div className="counter-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
