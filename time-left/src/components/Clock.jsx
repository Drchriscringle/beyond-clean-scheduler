import { pad, splitCountdown } from '../lib/format.js'

function Unit({ value, label, small = false, width = 2 }) {
  return (
    <div className={small ? 'clock-unit small' : 'clock-unit'}>
      <div className="clock-digits">{pad(value, width)}</div>
      <div className="clock-unit-label">{label}</div>
    </div>
  )
}

/**
 * The countdown itself. Counting up instead of down when the straight
 * subtraction has already been passed - that time is worth showing off.
 */
export default function Clock({ from, to, counting = 'down', children }) {
  const parts = splitCountdown(from, to)
  const bonus = counting === 'up'

  return (
    <section className={bonus ? 'panel clock-panel bonus' : 'panel clock-panel'}>
      <div className="clock-label">
        {bonus ? 'Time you have already been given' : 'Estimated time left'}
      </div>
      {/* Two groups rather than one long row, so a narrow screen wraps between
          the date part and the clock part instead of stranding a colon. */}
      <div className="clock" role="timer" aria-live="off">
        <div className="clock-group">
          <Unit value={parts.years} label={parts.years === 1 ? 'Year' : 'Years'} />
          <div className="clock-sep">:</div>
          <Unit value={parts.days} label="Days" width={3} />
        </div>
        <div className="clock-sep between">:</div>
        <div className="clock-group">
          <Unit value={parts.hours} label="Hrs" small />
          <div className="clock-sep">:</div>
          <Unit value={parts.minutes} label="Min" small />
          <div className="clock-sep">:</div>
          <Unit value={parts.seconds} label="Sec" small />
          <div className="clock-sep dot">.</div>
          <Unit value={parts.tenths} label="Tenths" small width={1} />
        </div>
      </div>
      {children ? <p className="clock-caption">{children}</p> : null}
    </section>
  )
}
