import { formatMoney } from '../utils/format.js'

export function Money({ value, showSign = false }) {
  const cls = value < 0 ? 'money negative' : showSign ? 'money positive' : 'money'
  const sign = showSign && value > 0 ? '+' : ''
  return (
    <span className={cls}>
      {sign}
      {formatMoney(value)}
    </span>
  )
}

export function AttrBar({ label, value }) {
  return (
    <div className="attr-row">
      <span className="attr-label">{label}</span>
      <div className="attr-bar-track">
        <div className="attr-bar-fill" style={{ width: `${(value / 20) * 100}%` }} />
      </div>
      <span className="attr-value">{value}</span>
    </div>
  )
}

export function ConfidenceMeter({ value }) {
  return (
    <div className="confidence-meter">
      <div className="confidence-meter-fill" style={{ width: `${value}%` }} />
    </div>
  )
}

export function RepStars({ reputation }) {
  return <span className="rep-stars">{'★'.repeat(reputation)}{'☆'.repeat(5 - reputation)}</span>
}

export function NoticeBanner({ notice, onClear }) {
  if (!notice) return null
  return (
    <div className="notice-banner">
      <span>{notice}</span>
      <button className="btn btn-small" onClick={onClear}>
        OK
      </button>
    </div>
  )
}
