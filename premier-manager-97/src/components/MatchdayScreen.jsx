import { useEffect } from 'react'
import { CLUB_BY_ID } from '../data/clubs.js'
import { PLAYING_STYLES, PLAYING_STYLE_NAMES } from '../state/tactics.js'

const SPEEDS = [
  { key: '5min', label: '5 min' },
  { key: '3min', label: '3 min' },
  { key: '2min', label: '2 min' },
  { key: 'instant', label: 'Instant' },
]
const SPEED_SECONDS = { '5min': 300, '3min': 180, '2min': 120 }
const TOTAL_TICKS = 30

export default function MatchdayScreen({ state, dispatch }) {
  const lm = state.liveMatch
  const isHome = lm?.homeId === state.playerClubId
  const finished = lm && lm.currentMinute >= 90

  useEffect(() => {
    if (!lm || lm.paused || finished) return
    if (lm.speed === 'instant') {
      dispatch({ type: 'TICK_MATCH', payload: { instant: true } })
      return
    }
    const intervalMs = (SPEED_SECONDS[lm.speed] / TOTAL_TICKS) * 1000
    const timer = setTimeout(() => dispatch({ type: 'TICK_MATCH' }), intervalMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lm?.currentMinute, lm?.paused, lm?.speed, finished])

  if (!lm) {
    return (
      <div className="pm97-app">
        <div className="screen">
          <div className="panel">Loading matchday...</div>
        </div>
      </div>
    )
  }

  const homeClub = CLUB_BY_ID[lm.homeId]
  const awayClub = CLUB_BY_ID[lm.awayId]

  const playerSquad = state.squads[state.playerClubId]
  const playerLineupIds = isHome ? lm.homeLineup : lm.awayLineup
  const playerTactics = isHome ? lm.homeTactics : lm.awayTactics
  const playerSubsUsed = isHome ? lm.homeSubsUsed : lm.awaySubsUsed
  const onPitch = playerLineupIds.map((id) => playerSquad.find((p) => p.id === id)).filter(Boolean)
  const bench = playerSquad.filter(
    (p) => !playerLineupIds.includes(p.id) && !p.injured && !p.suspended,
  )
  const outfieldOnPitch = onPitch.filter((p) => p.position !== 'GK')

  function setSpeed(speed) {
    dispatch({ type: 'SET_MATCH_SPEED', payload: { speed } })
  }

  function makeSub(outId, inId) {
    if (!outId || !inId) return
    dispatch({ type: 'LIVE_SUBSTITUTION', payload: { outId, inId } })
  }

  function setLiveTactic(field, value) {
    dispatch({ type: 'LIVE_SET_TACTICS', payload: { [field]: value } })
  }

  return (
    <div className="pm97-app">
      <div className="screen matchday-screen">
        <div className="panel">
          <div className="panel-title">MATCHDAY</div>
          <div className="scoreboard">
            <span className="scoreboard-club">{homeClub.name}</span>
            <span className="scoreboard-score">
              {lm.homeGoals} - {lm.awayGoals}
            </span>
            <span className="scoreboard-club">{awayClub.name}</span>
          </div>
          <div className="scoreboard-clock">{finished ? 'FULL TIME' : lm.paused ? `PAUSED — ${lm.currentMinute}'` : `${lm.currentMinute}'`}</div>

          <div className="field-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <label>Speed</label>
            {SPEEDS.map((s) => (
              <button
                key={s.key}
                className={`btn btn-small${lm.speed === s.key ? ' btn-primary' : ''}`}
                onClick={() => setSpeed(s.key)}
              >
                {s.label}
              </button>
            ))}
            {!finished && !lm.paused && (
              <button className="btn btn-small" onClick={() => dispatch({ type: 'PAUSE_MATCH' })}>
                Pause
              </button>
            )}
          </div>

          <div className="stand-backdrop">
            <div className="roof" />
            <div className="crowd" />
          </div>
          <div className="commentary-log">
            {lm.commentary.map((line, i) => (
              <p
                key={i}
                className={`commentary-line${line.includes('GOAL') ? ' goal' : ''}${line.includes('RED CARD') ? ' red-card' : ''}`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {finished && (
          <div className="panel">
            <div className="panel-title">FULL TIME</div>
            <p>
              {homeClub.name} {lm.homeGoals}-{lm.awayGoals} {awayClub.name}
            </p>
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'FINISH_MATCHDAY' })}>
              Continue
            </button>
          </div>
        )}

        {!finished && lm.paused && (
          <div className="panel">
            <div className="panel-title">{lm.currentMinute === 45 ? 'HALF TIME' : 'PAUSED'} — MAKE CHANGES</div>
            <div className="grid-2">
              <div className="panel-inset">
                <h3>Substitution ({playerSubsUsed}/5 used)</h3>
                <SubForm onPitch={onPitch} bench={bench} onSub={makeSub} disabled={playerSubsUsed >= 5} />
              </div>
              <div className="panel-inset">
                <h3>Tactics</h3>
                <div className="field-row">
                  <label htmlFor="live-style">Playing style</label>
                  <select id="live-style" value={playerTactics?.playingStyle ?? 'balanced'} onChange={(e) => setLiveTactic('playingStyle', e.target.value)}>
                    {PLAYING_STYLE_NAMES.map((s) => (
                      <option key={s} value={s}>
                        {PLAYING_STYLES[s].label}
                      </option>
                    ))}
                  </select>
                </div>
                <RoleSelect label="Captain" field="captainId" value={playerTactics?.captainId} options={outfieldOnPitch.length > 0 ? outfieldOnPitch : onPitch} onChange={setLiveTactic} />
                <RoleSelect label="Penalty taker" field="penaltyTakerId" value={playerTactics?.penaltyTakerId} options={outfieldOnPitch} onChange={setLiveTactic} />
                <RoleSelect label="Free-kick taker" field="freeKickTakerId" value={playerTactics?.freeKickTakerId} options={outfieldOnPitch} onChange={setLiveTactic} />
                <RoleSelect label="Corner taker" field="cornerTakerId" value={playerTactics?.cornerTakerId} options={outfieldOnPitch} onChange={setLiveTactic} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => dispatch({ type: 'RESUME_MATCH' })}>
              {lm.currentMinute === 45 ? 'Continue Second Half' : 'Resume'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RoleSelect({ label, field, value, options, onChange }) {
  const current = options.some((p) => p.id === value) ? value : ''
  return (
    <div className="field-row">
      <label htmlFor={field}>{label}</label>
      <select id={field} value={current} onChange={(e) => onChange(field, e.target.value || null)}>
        <option value="">— None —</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.squadNumber} {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function SubForm({ onPitch, bench, onSub, disabled }) {
  function submit(e) {
    e.preventDefault()
    const form = e.target
    onSub(form.outId.value, form.inId.value)
    form.reset()
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label htmlFor="outId">Off</label>
        <select id="outId" name="outId" disabled={disabled}>
          <option value="">— Select —</option>
          {onPitch.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.squadNumber} {p.name} ({p.position})
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="inId">On</label>
        <select id="inId" name="inId" disabled={disabled}>
          <option value="">— Select —</option>
          {bench.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.squadNumber} {p.name} ({p.position})
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary btn-small" type="submit" disabled={disabled}>
        Make Substitution
      </button>
    </form>
  )
}
