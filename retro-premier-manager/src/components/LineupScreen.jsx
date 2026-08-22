import { FORMATION_NAMES } from '../data/formations.js'
import PitchView from './PitchView.jsx'

export default function LineupScreen({ state, dispatch }) {
  const squad = state.squads[state.playerClubId]
  const lineup = state.lineups[state.playerClubId]
  const startingXI = lineup?.startingXI ?? []

  function setFormation(formation) {
    dispatch({ type: 'SET_FORMATION', payload: { formation } })
  }

  function toggle(playerId) {
    const isIn = startingXI.includes(playerId)
    let next
    if (isIn) {
      next = startingXI.filter((id) => id !== playerId)
    } else {
      if (startingXI.length >= 11) return
      next = [...startingXI, playerId]
    }
    dispatch({ type: 'SET_STARTING_XI', payload: { ids: next } })
  }

  const grouped = ['GK', 'DF', 'MF', 'FW'].map((pos) => ({
    pos,
    players: squad.filter((p) => p.position === pos).sort((a, b) => b.ability - a.ability),
  }))

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">STARTING XI &amp; FORMATION</div>
        <div className="field-row">
          <label htmlFor="formation">Formation</label>
          <select id="formation" value={lineup?.formation ?? '4-4-2'} onChange={(e) => setFormation(e.target.value)}>
            {FORMATION_NAMES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <span>Selected: {startingXI.length}/11</span>
        </div>

        <div className="grid-2">
          <div>
            <PitchView squad={squad} startingXI={startingXI} onRemove={toggle} />
            <p style={{ fontSize: 14, textAlign: 'center' }}>Click a player on the pitch to drop them back to the bench.</p>
          </div>

          <div className="scrollbox" style={{ maxHeight: 640 }}>
            {grouped.map(({ pos, players }) => (
              <div key={pos} className="panel-inset" style={{ marginBottom: 8 }}>
                <strong>{pos}</strong>
                <div className="pitch-list" style={{ marginTop: 6 }}>
                  {players.map((p) => (
                    <button
                      key={p.id}
                      className={`pitch-slot${startingXI.includes(p.id) ? ' filled' : ''}`}
                      onClick={() => toggle(p.id)}
                      disabled={p.injured || p.suspended}
                      title={p.injured ? `${p.injuryType} (${p.injuryWeeks} wk)` : p.suspended ? `Suspended (${p.suspensionMatches} match)` : ''}
                    >
                      #{p.squadNumber} {p.name} ({p.ability}){p.injured ? ' 🩹' : ''}{p.suspended ? ' 🟥' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
