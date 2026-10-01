import { useState } from 'react'

// Simple SVG charts for matches played on the oche (career.progress).
const W = 320
const H = 140
const PAD = { l: 30, r: 8, t: 10, b: 18 }

function rolling(values, n) {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v != null)
    return win.length ? win.reduce((a, b) => a + b, 0) / win.length : null
  })
}

function Chart({ values, trend, bars, fmt = (v) => Math.round(v), color = 'var(--gold)' }) {
  const all = [...values, ...(trend ?? [])].filter((v) => v != null)
  if (!all.length) return null
  let lo = bars ? 0 : Math.floor(Math.min(...all) / 10) * 10
  let hi = Math.ceil(Math.max(...all) / 10) * 10
  if (bars) hi = Math.max(1, Math.ceil(Math.max(...all)))
  if (hi === lo) hi = lo + 10
  const n = values.length
  const x = (i) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (n - 1)) * (W - PAD.l - PAD.r))
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
  const path = (vs) => vs.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ')
  const bw = Math.max(2, Math.min(14, ((W - PAD.l - PAD.r) / n) * 0.7))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {[lo, (lo + hi) / 2, hi].map((g) => (
        <g key={g}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--line)" />
          <text x={PAD.l - 4} y={y(g) + 4} textAnchor="end" className="chart-axis">{fmt(g)}</text>
        </g>
      ))}
      {bars
        ? values.map((v, i) => v > 0 && <rect key={i} x={x(i) - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx="1.5" fill={color} />)
        : values.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--muted)" opacity="0.6" />)}
      {trend && <polyline points={path(trend)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      <text x={PAD.l} y={H - 4} className="chart-axis">first</text>
      <text x={W - PAD.r} y={H - 4} textAnchor="end" className="chart-axis">latest</text>
    </svg>
  )
}

const RANGES = [['20', 20], ['50', 50], ['All', Infinity]]

export default function ProgressCharts({ career }) {
  const [range, setRange] = useState(50)
  const all = career.progress ?? []
  if (all.length < 2) {
    return (
      <div className="card">
        <div className="card-label">Your progress</div>
        <p className="muted">Play a couple of matches on the oche and your average, checkout % and 180s will be charted here.</p>
      </div>
    )
  }
  const rows = all.slice(-range)
  const avgs = rows.map((r) => r.avg)
  const co = rows.map((r) => (r.atDouble ? (r.legs / r.atDouble) * 100 : null))
  const s180 = rows.map((r) => r.s180)
  const recent = (vs) => { const v = vs.slice(-10).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const earlier = (vs) => { const v = vs.slice(0, Math.min(10, Math.floor(vs.length / 2))).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const delta = (vs) => { const a = recent(vs); const b = earlier(vs); return a != null && b != null ? a - b : null }
  const d = delta(avgs)
  return (
    <div className="card">
      <div className="card-label">Your progress · last {rows.length} matches on the oche</div>
      <div className="btn-row tight">
        {RANGES.map(([l, v]) => <button key={l} className={`btn small ${range === v ? 'primary' : ''}`} onClick={() => setRange(v)}>{l}</button>)}
      </div>
      <h4 className="chart-title">Match average <span className="muted">· recent 10: {recent(avgs).toFixed(1)}{d != null ? <span className={d >= 0 ? 'up' : 'down'}> ({d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)})</span> : null}</span></h4>
      <Chart values={avgs} trend={rolling(avgs, 5)} />
      <p className="chart-note muted">Dots are single matches; the gold line is your 5-match rolling average.</p>
      {co.some((v) => v != null) && (
        <>
          <h4 className="chart-title">Checkout % <span className="muted">· recent 10: {recent(co)?.toFixed(1) ?? '–'}%</span></h4>
          <Chart values={co} trend={rolling(co, 5)} color="var(--green)" fmt={(v) => `${Math.round(v)}`} />
        </>
      )}
      <h4 className="chart-title">180s per match <span className="muted">· total {s180.reduce((a, b) => a + b, 0)}</span></h4>
      <Chart values={s180} bars color="var(--red-2)" />
    </div>
  )
}
