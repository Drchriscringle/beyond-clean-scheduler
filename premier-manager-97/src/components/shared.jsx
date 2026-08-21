import { formatMoney } from '../utils/format.js'
import { currentForm, formTrend } from '../state/form.js'

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

const TREND_ARROW = { up: ' ▲', down: ' ▼', level: '' }

export function FormBadge({ player }) {
  const form = currentForm(player)
  const trend = formTrend(player)
  const cls = form >= 6.8 ? 'form-good' : form >= 5.3 ? 'form-average' : 'form-poor'
  return (
    <span className={`form-badge ${cls}`}>
      {form.toFixed(1)}
      {TREND_ARROW[trend]}
    </span>
  )
}

export function FormDots({ player }) {
  const history = player.formHistory ?? []
  if (history.length === 0) return <span style={{ fontSize: 14 }}>No recent matches</span>
  return (
    <span className="form-dots">
      {history.map((rating, i) => {
        const cls = rating >= 6.8 ? 'form-good' : rating >= 5.3 ? 'form-average' : 'form-poor'
        return (
          <span key={i} className={`form-dot ${cls}`} title={rating.toFixed(1)}>
            {rating.toFixed(0)}
          </span>
        )
      })}
    </span>
  )
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
