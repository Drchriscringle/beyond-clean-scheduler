const ROW_Y = { GK: 91, DF: 71, MF: 47, FW: 21 }
const ROW_ORDER = ['GK', 'DF', 'MF', 'FW']

function surname(name) {
  const parts = name.trim().split(' ')
  return parts[parts.length - 1]
}

export default function PitchView({ squad, startingXI, onRemove }) {
  const xi = startingXI.map((id) => squad.find((p) => p.id === id)).filter(Boolean)
  const byPos = { GK: [], DF: [], MF: [], FW: [] }
  for (const p of xi) {
    if (byPos[p.position]) byPos[p.position].push(p)
  }
  for (const pos of ROW_ORDER) {
    byPos[pos].sort((a, b) => a.squadNumber - b.squadNumber)
  }

  const chips = []
  for (const pos of ROW_ORDER) {
    const players = byPos[pos]
    const n = players.length
    players.forEach((p, i) => {
      const x = n === 1 ? 50 : 12 + (76 / (n - 1)) * i
      chips.push({ player: p, x, y: ROW_Y[pos] })
    })
  }

  return (
    <div className="pitch-view">
      <div className="pitch-halfway" />
      <div className="pitch-circle" />
      <div className="pitch-box pitch-box-top" />
      <div className="pitch-box pitch-box-bottom" />
      {chips.map(({ player, x, y }) => (
        <button
          key={player.id}
          type="button"
          className={`pitch-chip pitch-chip-${player.position}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onRemove?.(player.id)}
          title={`${player.name} (${player.position}) — click to remove`}
        >
          <span className="pitch-chip-number">#{player.squadNumber}</span>
          <span className="pitch-chip-name">{surname(player.name)}</span>
        </button>
      ))}
    </div>
  )
}
