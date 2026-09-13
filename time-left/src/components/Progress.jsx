import { formatLongDate, formatPercent, formatYears } from '../lib/format.js'

export default function Progress({ fraction, age, expectancyYears, endDate, survivorsShare }) {
  return (
    <section className="panel">
      <h2 className="panel-title">Where you are</h2>
      <div className="progress-row">
        <span>{formatPercent(fraction)} spent</span>
        <span>{formatPercent(1 - fraction)} left</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        aria-label="Share of the estimated lifespan already lived"
      >
        <div className="progress-fill" style={{ width: `${Math.min(100, fraction * 100)}%` }} />
      </div>
      <div className="progress-legend">
        <span>
          Lived <b>{formatYears(age)}</b>
        </span>
        <span>
          Estimate lands on <b>{formatLongDate(endDate)}</b>
        </span>
        <span>
          A life of <b>{formatYears(expectancyYears)}</b>
        </span>
        {survivorsShare != null ? (
          <span>
            Still here from your year: <b>{formatPercent(survivorsShare, 0)}</b>
          </span>
        ) : null}
      </div>
    </section>
  )
}
