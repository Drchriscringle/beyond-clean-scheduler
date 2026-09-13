import { useId, useState } from 'react'
import { money } from '../api.js'

/**
 * The balance, projected forward.
 *
 * One series, so there is no legend and no categorical palette — the panel
 * heading names it. What the chart is *for* is the shape between now and
 * payday, and specifically the two thresholds a closing balance hides: zero,
 * and the float you want to keep. Both are drawn as reference lines, and the
 * lowest point is marked, because that is the number that decides whether a
 * payment bounces.
 *
 * A crosshair and tooltip come as standard, and the same numbers are available
 * as a table for anyone not reading the picture.
 */
export default function ForecastChart({ days, bufferPence = 0, currency, height = 150 }) {
  const [hover, setHover] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const clipId = useId()

  if (!days || days.length < 2) {
    return <p className="empty">Not enough to forecast yet.</p>
  }

  const width = 720
  const padding = { top: 10, right: 8, bottom: 18, left: 8 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const values = days.map((day) => day.closingPence)
  // The scale always includes zero and the buffer, so a reference line can
  // never sit off-canvas and quietly stop warning anyone.
  const maximum = Math.max(...values, bufferPence, 0)
  const minimum = Math.min(...values, bufferPence, 0)
  const span = maximum - minimum || 1

  const x = (index) => padding.left + (index / (days.length - 1)) * plotWidth
  const y = (value) => padding.top + (1 - (value - minimum) / span) * plotHeight

  const line = days.map((day, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(day.closingPence).toFixed(1)}`).join('')
  const area = `${line}L${x(days.length - 1).toFixed(1)},${y(minimum).toFixed(1)}L${x(0).toFixed(1)},${y(minimum).toFixed(1)}Z`

  const lowest = days.reduce((worst, day) => (day.closingPence < worst.closingPence ? day : worst), days[0])
  const lowestIndex = days.indexOf(lowest)
  const active = hover !== null ? days[hover] : null

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const index = Math.round(ratio * width - padding.left) / plotWidth * (days.length - 1)
    setHover(Math.max(0, Math.min(days.length - 1, Math.round(index))))
  }

  const movementDays = days.filter((day) => day.movements.length > 0)

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Projected balance from ${days[0].day} to ${days[days.length - 1].day}. Lowest point ${money(lowest.closingPence, currency)} on ${lowest.day}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>

        <path className="fill" d={area} clipPath={`url(#${clipId})`} />

        {/* Reference lines: zero, then the buffer if it is a distinct level. */}
        {minimum < 0 && (
          <line className="zero" x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} />
        )}
        {bufferPence > 0 && (
          <line className="buffer" x1={padding.left} x2={width - padding.right} y1={y(bufferPence)} y2={y(bufferPence)} />
        )}

        <path className="line" d={line} />

        {/* The number that actually matters. */}
        <circle className="low" cx={x(lowestIndex)} cy={y(lowest.closingPence)} r="4" />

        {active && (
          <g>
            <line
              x1={x(hover)} x2={x(hover)} y1={padding.top} y2={padding.top + plotHeight}
              stroke="currentColor" strokeWidth="1" opacity="0.35"
            />
            <circle cx={x(hover)} cy={y(active.closingPence)} r="4.5" fill="currentColor" />
          </g>
        )}

        <text x={padding.left} y={height - 4}>{days[0].day}</text>
        <text x={width - padding.right} y={height - 4} textAnchor="end">{days[days.length - 1].day}</text>
      </svg>

      <div style={{ minHeight: '2.6rem', marginTop: '0.3rem' }}>
        {active ? (
          <div style={{ fontSize: '0.85rem' }}>
            <strong>{active.day}</strong>{' '}
            <span className={active.closingPence < 0 ? 'bad' : active.closingPence < bufferPence ? 'warn' : ''}>
              {money(active.closingPence, currency)}
            </span>
            {active.movements.length > 0 && (
              <div className="faint">
                {active.movements
                  .map((movement) => `${movement.name} ${money(movement.amountPence, { ...currency, signed: true })}`)
                  .join(' · ')}
              </div>
            )}
          </div>
        ) : (
          <div className="faint" style={{ fontSize: '0.82rem' }}>
            Lowest point {money(lowest.closingPence, currency)} on {lowest.day}.{' '}
            <button className="link" onClick={() => setShowTable((current) => !current)}>
              {showTable ? 'hide numbers' : 'show numbers'}
            </button>
          </div>
        )}
      </div>

      {showTable && (
        <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
        <table>
          <caption className="faint" style={{ textAlign: 'left', fontSize: '0.8rem', paddingBottom: '0.3rem' }}>
            Every day the balance changes
          </caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>What moves</th>
              <th className="num">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {movementDays.map((day) => (
              <tr key={day.day}>
                <td>{day.day}</td>
                <td className="dim">
                  {day.movements.map((movement) => movement.name).join(', ')}
                </td>
                <td className={`num ${day.closingPence < 0 ? 'bad' : ''}`}>{money(day.closingPence, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
