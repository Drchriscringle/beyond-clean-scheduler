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

// darts: [{ x, y, label }] in board millimetres (y up)
export default function Dartboard({ darts = [], size = 260 }) {
  return (
    <svg className="board" viewBox="-200 -200 400 400" width={size} height={size} role="img" aria-label="Dartboard">
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
          <circle cx={d.x} cy={-d.y} r="7" fill="#f4c542" stroke="#000" strokeWidth="2" />
          <text x={d.x} y={-d.y} className="dart-idx" textAnchor="middle" dominantBaseline="central">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
