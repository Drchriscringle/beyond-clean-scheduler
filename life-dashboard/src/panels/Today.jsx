import { money } from '../api.js'

/**
 * The morning view: what is on, what is leaving, what wants doing.
 *
 * Ordered by what you can still act on. The diary is first because it is the
 * only part with hard times in it; money second because it is the part that
 * quietly goes wrong; objectives last because they are the part you choose.
 */
export default function Today({ brief, onTickStep }) {
  const { agenda, money: purse, objectives, news } = brief
  const currency = { currency: brief.profile.currency, locale: brief.profile.locale }

  return (
    <>
      {brief.attention.length > 0 && (
        <div className="attention">
          {brief.attention.map((item, index) => (
            <div key={index} className={`alert ${item.severity}`}>
              <span className="dot">{item.severity === 'high' ? '⚠' : item.severity === 'medium' ? '!' : '·'}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid wide">
        <div style={{ display: 'grid', gap: 'var(--gap)' }}>
          <section className="panel">
            <h2>
              Diary
              <span className="right faint">next {agenda.windowDays} days</span>
            </h2>

            {agenda.problems?.map((problem, index) => (
              <div key={index} className="problem">
                {problem.feed} could not be refreshed — {problem.error}
              </div>
            ))}

            {agenda.days.length === 0 && (
              <p className="empty">Nothing in the diary. Add an event, or subscribe to a calendar in Settings.</p>
            )}

            {agenda.days.map((day) => (
              <div className="daygroup" key={day.day}>
                <h3>
                  {day.label}
                  <span className="rel">{day.relative}</span>
                </h3>
                <div className="rows">
                  {day.entries.map((entry) => (
                    <div className="row" key={entry.id}>
                      <span className="when">{entry.time ?? 'all day'}</span>
                      <span className="what">
                        {entry.title}
                        {(entry.location || entry.source?.name) && (
                          <div className="sub">
                            {[entry.location, entry.source?.kind === 'feed' ? entry.source.name : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Objectives</h2>
            {objectives.active.length === 0 && <p className="empty">No objectives yet.</p>}
            {objectives.active.map((objective) => (
              <ObjectiveRow key={objective.id} objective={objective} onTickStep={onTickStep} />
            ))}
          </section>
        </div>

        <div style={{ display: 'grid', gap: 'var(--gap)' }}>
          <section className="panel">
            <h2>Before payday</h2>
            {purse.runway.payday ? (
              <>
                <div className="figures">
                  <div className="figure">
                    <div className="label">Balance</div>
                    <div className="value">{money(purse.openingPence, currency)}</div>
                  </div>
                  <div className="figure">
                    <div className="label">Safe to spend</div>
                    <div className={`value ${purse.runway.tight ? 'bad' : 'in'}`}>
                      {money(purse.runway.safeToSpendPence, currency)}
                    </div>
                    <div className="note">
                      {purse.runway.outgoingCount} payment{purse.runway.outgoingCount === 1 ? '' : 's'} to go
                    </div>
                  </div>
                </div>
                <p className="dim" style={{ margin: 0, fontSize: '0.88rem' }}>
                  {money(purse.runway.outgoingBeforePaydayPence, currency)} still to leave before{' '}
                  {purse.runway.payday.name} lands in {purse.runway.daysToPayday} days.
                </p>
              </>
            ) : (
              <p className="empty">Add an income commitment to see a payday runway.</p>
            )}
          </section>

          <section className="panel">
            <h2>Due next</h2>
            {purse.dueSoon.length === 0 && <p className="empty">Nothing due in the next fortnight.</p>}
            <div className="rows">
              {purse.dueSoon.slice(0, 10).map((item) => (
                <div className="row" key={item.id}>
                  <span className="when">{item.day.slice(8)} {monthShort(item.day)}</span>
                  <span className="what">
                    {item.name}
                    {(item.moved || item.estimated) && (
                      <div className="sub">
                        {item.moved && 'moved off a non-working day'}
                        {item.moved && item.estimated && ' · '}
                        {item.estimated && 'estimated'}
                      </div>
                    )}
                  </span>
                  <span className={`amount ${item.amountPence >= 0 ? 'in' : 'out'}`}>
                    {money(item.amountPence, { ...currency, signed: true })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {news.items.length > 0 && (
            <section className="panel">
              <h2>
                Watchlist
                <span className="right faint">{news.items.length} stories</span>
              </h2>
              {news.items.slice(0, 5).map((item, index) => (
                <div className="story" key={item.url ?? index}>
                  <a href={item.url} target="_blank" rel="noreferrer noopener">{item.title}</a>
                  <div className="meta">
                    {item.targets.map((target) => (
                      <span className={`tag ${target.kind}`} key={target.id}>{target.name}</span>
                    ))}
                    <span>{item.sources.join(', ')}</span>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  )
}

function ObjectiveRow({ objective, onTickStep }) {
  const state = objective.overdue ? 'late' : objective.progress.fraction >= 1 ? 'done' : ''
  return (
    <div className="objective">
      <div className="title">
        <strong>{objective.title}</strong>
        {objective.overdue && <span className="bad">overdue {objective.dueLabel}</span>}
        {!objective.overdue && objective.stalled && (
          <span className="warn">no movement in {objective.idleDays} days</span>
        )}
        {!objective.overdue && !objective.stalled && objective.dueOn && (
          <span className="faint">due {objective.dueLabel}</span>
        )}
      </div>
      <div className={`meter ${state}`}>
        <span style={{ width: `${Math.round(objective.progress.fraction * 100)}%` }} />
      </div>
      {objective.progress.label && <div className="faint" style={{ fontSize: '0.82rem' }}>{objective.progress.label}</div>}
      {objective.steps?.length > 0 && (
        <ul className="steps">
          {objective.steps.map((step) => (
            <li key={step.id}>
              <input
                type="checkbox"
                checked={step.done}
                onChange={(event) => onTickStep(objective.id, step.id, event.target.checked)}
                id={`${objective.id}-${step.id}`}
              />
              <label htmlFor={`${objective.id}-${step.id}`} className={step.done ? 'done' : ''}>
                {step.title}
                {step.dueOn && !step.done && <span className="faint"> · {step.dueOn.slice(8)} {monthShort(step.dueOn)}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthShort(day) {
  return MONTHS[Number(day.slice(5, 7)) - 1]
}
