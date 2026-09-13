import { memo } from 'react'

/**
 * One box per week of the whole estimated life. Filled boxes are behind you.
 * Rendered from counts only, so it repaints once a week rather than ten times
 * a second like the clock above it.
 */
function WeekGrid({ weeksLived, weeksTotal }) {
  const total = Math.max(weeksLived + 1, Math.min(weeksTotal, 52 * 120))
  const boxes = []
  for (let week = 0; week < total; week += 1) {
    const state = week < weeksLived ? 'week spent' : week === weeksLived ? 'week now' : 'week'
    boxes.push(<div className={state} key={week} />)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Your life in weeks</h2>
      <p className="panel-note">
        One box a week, 52 to a row, one row a year. {weeksLived.toLocaleString()} behind you,{' '}
        {Math.max(0, total - weeksLived).toLocaleString()} ahead.
      </p>
      <div className="weeks" aria-hidden="true">
        {boxes}
      </div>
      <div className="weeks-key">
        <span>
          <i className="swatch" style={{ background: '#2f6f69' }} /> Lived
        </span>
        <span>
          <i className="swatch" style={{ background: '#e8b13c' }} /> This week
        </span>
        <span>
          <i className="swatch" style={{ background: '#242c38' }} /> Still to come
        </span>
      </div>
    </section>
  )
}

export default memo(WeekGrid)
