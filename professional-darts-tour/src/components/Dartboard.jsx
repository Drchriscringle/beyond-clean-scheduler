import { RADII, SEGMENTS } from '../engine/board.js'

const pt = (r, deg) => {
  const a = (deg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)]
}

function sector(r1, r2, a1, a2) {
  const [x1, y1] = pt(r2, a1)
  const [x2, y2] = pt(r2, a2)
  const [x3, y3] = pt(r1, a2)
  const [x4, y4] = pt(r1, a1)
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`
}

const RINGS = [
  [RADII.outerBull, RADII.trebleIn, 'single'],
  [RADII.trebleIn, RADII.trebleOut, 'ring'],
  [RADII.trebleOut, RADII.doubleIn, 'single'],
  [RADII.doubleIn, RADII.doubleOut, 'ring'],
]

// darts: [{ x, y, label, color?, tag? }] in board millimetres (y up)
// view: how many mm from the centre to show (200 = whole board, ~60 = zoomed on the bull)
// onTap(x, y): called with board millimetres where the board was tapped
export default function Dartboard({ darts = [], size = 260, view = 200, onTap = null }) {
  const markR = Math.max(2.2, (7 * view) / 200)
  function tap(e) {
    if (!onTap) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 * view - view
    const y = -(((e.clientY - rect.top) / rect.height) * 2 * view - view)
    onTap(x, y)
  }
  return (
    <svg className={`board ${onTap ? 'tappable' : ''}`} viewBox={`${-view} ${-view} ${view * 2} ${view * 2}`} width={size} height={size} role="img" aria-label="Dartboard" onClick={tap}>
      <circle r="198" fill="#141414" />
      {SEGMENTS.map((n, i) => {
        const a1 = i * 18 - 9
        const a2 = i * 18 + 9
        const dark = i % 2 === 0
        return (
          <g key={n}>
            {RINGS.map(([r1, r2, kind]) => (
              <path
                key={r1}
                d={sector(r1, r2, a1, a2)}
                fill={kind === 'ring' ? (dark ? '#c62828' : '#2e7d32') : dark ? '#1b1b1b' : '#f1e9d2'}
                stroke="#9a9a9a"
                strokeWidth="0.6"
              />
            ))}
            <text x={pt(184, i * 18)[0]} y={pt(184, i * 18)[1]} className="board-num" textAnchor="middle" dominantBaseline="central">
              {n}
            </text>
          </g>
        )
      })}
      <circle r={RADII.outerBull} fill="#2e7d32" stroke="#9a9a9a" strokeWidth="0.6" />
      <circle r={RADII.bull} fill="#c62828" stroke="#9a9a9a" strokeWidth="0.6" />
      {darts.map((d, i) => (
        <g key={i} className="dart-hit">
          <circle cx={d.x} cy={-d.y} r={markR} fill={d.color ?? '#f4c542'} stroke="#000" strokeWidth={markR / 3.5} />
          <text x={d.x} y={-d.y} className="dart-idx" style={{ fontSize: markR * 1.3 }} textAnchor="middle" dominantBaseline="central">
            {d.tag ?? i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
