import { CLUBS, CLUB_BY_ID } from '../data/clubs.js'
import { standingsToTable } from '../state/gameReducer.js'
import { clubCupStatus, CUP_ROUND_WEEKS } from '../state/cup.js'

function CupPanel({ state }) {
  const cup = state.cup
  if (!cup) return null
  const status = clubCupStatus(cup, state.playerClubId)
  const stillIn = cup.matches.some((m) => m.home === state.playerClubId || m.away === state.playerClubId)
  const nextWeek = CUP_ROUND_WEEKS[cup.roundIndex]

  return (
    <div className="panel">
      <div className="panel-title">FA CUP</div>
      {cup.champion && <p>Champions: <strong>{CLUB_BY_ID[cup.champion].name}</strong></p>}
      {!cup.champion && stillIn && (
        <p>
          Your status: {status.roundLabel}
          {nextWeek ? ` — next tie in Week ${nextWeek}` : ''}
        </p>
      )}
      {!cup.champion && !stillIn && status.roundLabel !== 'Did not enter' && (
        <p>Eliminated in the {status.roundLabel}.</p>
      )}
      {status.roundLabel === 'Did not enter' && <p>Not involved in this season's competition.</p>}
    </div>
  )
}

export default function FixturesScreen({ state }) {
  const clubIds = CLUBS.map((c) => c.id)
  const table = standingsToTable(state.standings, clubIds)
  const upcoming = state.fixtures.find((f) => f.week === state.week)

  return (
    <div className="screen">
      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">LEAGUE TABLE</div>
          <div className="scrollbox">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Club</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={row.clubId} className={row.clubId === state.playerClubId ? 'highlight-row' : ''}>
                    <td>{i + 1}</td>
                    <td>{CLUB_BY_ID[row.clubId].name}</td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.gf}</td>
                    <td>{row.ga}</td>
                    <td>{row.gf - row.ga}</td>
                    <td>
                      <strong>{row.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CupPanel state={state} />
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">FIXTURES — WEEK {state.week}</div>
            {upcoming ? (
              <ul>
                {upcoming.matches.map((m) => (
                  <li key={m.id} style={m.home === state.playerClubId || m.away === state.playerClubId ? { fontWeight: 'bold' } : undefined}>
                    {CLUB_BY_ID[m.home].name} vs {CLUB_BY_ID[m.away].name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Season complete. Continue to start a new campaign.</p>
            )}
          </div>

          {state.weekResults.length > 0 && (
            <div className="panel">
              <div className="panel-title">LAST WEEK'S RESULTS</div>
              <ul>
                {state.weekResults.map((r, i) => (
                  <li key={i}>
                    {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.lastMatch && (
            <div className="panel">
              <div className="panel-title">MATCH COMMENTARY</div>
              <p>
                {CLUB_BY_ID[state.lastMatch.homeClubId].name} {state.lastMatch.homeGoals}-{state.lastMatch.awayGoals}{' '}
                {CLUB_BY_ID[state.lastMatch.awayClubId].name}
              </p>
              <div className="commentary-log">
                {state.lastMatch.commentary.map((line, i) => (
                  <p key={i} className={`commentary-line${line.includes('GOAL') ? ' goal' : ''}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
