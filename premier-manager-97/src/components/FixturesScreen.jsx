import { useState } from 'react'
import { CLUB_BY_ID } from '../data/clubs.js'
import { standingsToTable, playerLeagueClubIds } from '../state/gameReducer.js'
import { clubCupStatus, CUP_ROUND_WEEKS } from '../state/cup.js'

function zoneClass(position, division) {
  if (division === 'PL') {
    if (position <= 4) return 'zone-europe'
    if (position >= 18) return 'zone-relegation'
    return ''
  }
  if (position <= 2) return 'zone-promotion'
  if (position <= 6) return 'zone-playoff'
  if (position >= 18) return 'zone-relegation'
  return ''
}

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
  const playerDivision = state.clubs[state.playerClubId].division
  const [viewDivision, setViewDivision] = useState(playerDivision)
  const allClubIds = Object.keys(state.clubs)
  const viewClubIds = allClubIds.filter((id) => state.clubs[id].division === viewDivision)
  const table = standingsToTable(state.standings, viewClubIds)
  const ownClubIds = playerLeagueClubIds(state)
  const upcoming = state.fixtures.find((f) => f.week === state.week)
  const ownFixtures = upcoming?.matches.filter((m) => ownClubIds.includes(m.home) && ownClubIds.includes(m.away)) ?? []
  const ownResults = state.weekResults.filter((r) => ownClubIds.includes(r.home) && ownClubIds.includes(r.away))

  return (
    <div className="screen">
      <div className="grid-2">
        <div className="panel">
          <div className="tabs" style={{ marginBottom: 8 }}>
            <button className={`tab${viewDivision === 'PL' ? ' active' : ''}`} onClick={() => setViewDivision('PL')}>
              Premier League
            </button>
            <button className={`tab${viewDivision === 'CH' ? ' active' : ''}`} onClick={() => setViewDivision('CH')}>
              Championship
            </button>
          </div>
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
                {table.map((row, i) => {
                  const position = i + 1
                  const classes = [zoneClass(position, viewDivision)]
                  if (row.clubId === state.playerClubId) classes.push('highlight-row')
                  return (
                    <tr key={row.clubId} className={classes.filter(Boolean).join(' ')}>
                      <td>{position}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            {viewDivision === 'PL' ? (
              <>
                <span className="zone-swatch zone-europe" /> Champions League/Europe &nbsp;
                <span className="zone-swatch zone-relegation" /> Relegation
              </>
            ) : (
              <>
                <span className="zone-swatch zone-promotion" /> Automatic promotion &nbsp;
                <span className="zone-swatch zone-playoff" /> Play-offs &nbsp;
                <span className="zone-swatch zone-relegation" /> Relegation
              </>
            )}
          </p>
          <CupPanel state={state} />
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">FIXTURES — WEEK {state.week}</div>
            {upcoming ? (
              <ul>
                {ownFixtures.map((m) => (
                  <li key={m.id} style={m.home === state.playerClubId || m.away === state.playerClubId ? { fontWeight: 'bold' } : undefined}>
                    {CLUB_BY_ID[m.home].name} vs {CLUB_BY_ID[m.away].name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Season complete. Continue to start a new campaign.</p>
            )}
          </div>

          {ownResults.length > 0 && (
            <div className="panel">
              <div className="panel-title">LAST WEEK'S RESULTS</div>
              <ul>
                {ownResults.map((r, i) => (
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
                  <p
                    key={i}
                    className={`commentary-line${line.includes('GOAL') ? ' goal' : ''}${line.includes('RED CARD') ? ' red-card' : ''}`}
                  >
                    {line}
                  </p>
                ))}
              </div>
              {state.lastMatch.motmName && (
                <p style={{ marginTop: 8 }}>
                  <strong>Man of the Match:</strong> {state.lastMatch.motmName} ({CLUB_BY_ID[state.lastMatch.motmClubId].name})
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
