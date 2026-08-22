import { flagBackgroundStyle } from '../utils/flags.js'

export default function SackedScreen({ state, dispatch }) {
  const info = state.sackedInfo

  function lookForJob() {
    dispatch({ type: 'QUIT_TO_MENU' })
  }

  return (
    <div className="pm97-app" style={flagBackgroundStyle(state.clubs[state.playerClubId]?.division)}>
      <div className="screen">
        <div className="panel">
          <div className="panel-title">YOU HAVE BEEN SACKED</div>
          <p>
            {info?.clubName ?? 'The club'} have terminated your contract as manager
            {info?.finalPosition ? `, having finished the season in ${info.finalPosition}${suffix(info.finalPosition)} place` : ''}.
          </p>
          {info?.reason && <p className="panel-inset">{info.reason}</p>}
          <p>Your time in the dugout is over — for now.</p>
          <button className="btn btn-primary" onClick={lookForJob}>
            Look for a New Job
          </button>
        </div>
      </div>
    </div>
  )
}

function suffix(n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}
