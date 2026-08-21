import { PLAYING_STYLES, PLAYING_STYLE_NAMES } from '../state/tactics.js'

const STYLE_BLURB = {
  balanced: 'No particular emphasis - a settled, even approach.',
  attacking: 'Push men forward and take the game to the opposition - more goals at both ends.',
  defensive: 'Sit in, stay compact and protect the scoreline - fewer goals at both ends.',
  possession: 'Patient build-up play - a modest edge in attack and at the back.',
  'route-one': 'Get the ball forward quickly - more direct threat, but leakier defensively.',
}

export default function TacticsScreen({ state, dispatch }) {
  const squad = state.squads[state.playerClubId]
  const lineup = state.lineups[state.playerClubId]
  const startingXI = lineup?.startingXI ?? []
  const tactics = state.tactics[state.playerClubId] ?? {}
  const xi = startingXI.map((id) => squad.find((p) => p.id === id)).filter(Boolean)
  const outfield = xi.filter((p) => p.position !== 'GK')

  function set(field, value) {
    dispatch({ type: 'SET_TACTICS', payload: { [field]: value } })
  }

  function RoleSelect({ label, field, options }) {
    const value = options.some((p) => p.id === tactics[field]) ? tactics[field] : ''
    return (
      <div className="field-row">
        <label htmlFor={field}>{label}</label>
        <select id={field} value={value} onChange={(e) => set(field, e.target.value || null)}>
          <option value="">— None selected —</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.squadNumber} {p.name} ({p.position})
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">TACTICS</div>

        <div className="panel-inset" style={{ marginBottom: 10 }}>
          <h3>Playing Style</h3>
          <div className="field-row">
            <label htmlFor="playing-style">Style</label>
            <select id="playing-style" value={tactics.playingStyle ?? 'balanced'} onChange={(e) => set('playingStyle', e.target.value)}>
              {PLAYING_STYLE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {PLAYING_STYLES[s].label}
                </option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 14 }}>{STYLE_BLURB[tactics.playingStyle ?? 'balanced']}</p>
        </div>

        <div className="grid-2">
          <div className="panel-inset">
            <h3>Captain &amp; Set Pieces</h3>
            <RoleSelect label="Captain" field="captainId" options={outfield.length > 0 ? outfield : xi} />
            <RoleSelect label="Penalty taker" field="penaltyTakerId" options={outfield} />
            <RoleSelect label="Free-kick taker" field="freeKickTakerId" options={outfield} />
            <RoleSelect label="Corner taker" field="cornerTakerId" options={outfield} />
            {xi.length === 0 && <p style={{ fontSize: 14 }}>Pick your Starting XI on the Team screen first.</p>}
          </div>
          <div className="panel-inset">
            <h3>Notes</h3>
            <p style={{ fontSize: 14 }}>
              The captain gives the side a small on-pitch lift when they start. Designated takers are used for penalties, direct
              free-kicks and a share of corners when they&apos;re in the Starting XI - otherwise the match engine picks a
              sensible deputy automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
