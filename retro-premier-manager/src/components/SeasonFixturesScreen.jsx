import { CLUB_BY_ID } from '../data/clubs.js'
import { derbyLabel } from '../data/rivalries.js'

function outcomeFor(gf, ga) {
  if (gf > ga) return 'W'
  if (gf < ga) return 'L'
  return 'D'
}

export default function SeasonFixturesScreen({ state }) {
  const playerClubId = state.playerClubId
  const rows = state.fixtures
    .map((wk) => {
      const match = wk.matches.find((m) => m.home === playerClubId || m.away === playerClubId)
      if (!match) return null
      const isHome = match.home === playerClubId
      const opponentId = isHome ? match.away : match.home
      const played = match.homeGoals != null
      const gf = played ? (isHome ? match.homeGoals : match.awayGoals) : null
      const ga = played ? (isHome ? match.awayGoals : match.homeGoals) : null
      return {
        week: wk.week,
        opponentId,
        isHome,
        played,
        gf,
        ga,
        outcome: played ? outcomeFor(gf, ga) : null,
        isDerby: Boolean(derbyLabel(playerClubId, opponentId)),
      }
    })
    .filter(Boolean)

  const played = rows.filter((r) => r.played)
  const wins = played.filter((r) => r.outcome === 'W').length
  const draws = played.filter((r) => r.outcome === 'D').length
  const losses = played.filter((r) => r.outcome === 'L').length

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">SEASON FIXTURES &amp; RESULTS</div>
        <p>
          {CLUB_BY_ID[playerClubId].name} — {played.length}/{rows.length} played this season: {wins}W {draws}D {losses}L
        </p>
      </div>

      <div className="panel">
        <div className="scrollbox">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Wk</th>
                <th>Opponent</th>
                <th>Venue</th>
                <th>Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week} className={r.week === state.week ? 'highlight-row' : ''}>
                  <td>{r.week}</td>
                  <td>
                    {CLUB_BY_ID[r.opponentId].name}
                    {r.isDerby && (
                      <span className="deadline-day-badge" style={{ marginLeft: 8 }}>
                        DERBY
                      </span>
                    )}
                  </td>
                  <td>{r.isHome ? 'H' : 'A'}</td>
                  <td>{r.played ? `${r.gf}-${r.ga}` : '-'}</td>
                  <td>{r.played ? <span className={`result-badge result-${r.outcome.toLowerCase()}`}>{r.outcome}</span> : 'Upcoming'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
