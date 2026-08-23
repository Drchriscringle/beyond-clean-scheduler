import { useState } from 'react'
import { CLUB_BY_ID, DIVISION_LABELS } from '../data/clubs.js'
import { standingsToTable, playerLeagueClubIds, recentFormForClub } from '../state/gameReducer.js'
import { clubCupStatus, CUP_ROUND_WEEKS, SCOTTISH_CUP_ROUND_WEEKS } from '../state/cup.js'
import { RESPONSE_TYPES } from '../state/pressConference.js'
import { EURO_ROUND_WEEKS, EURO_ROUND_NAMES } from '../state/europe.js'
import { derbyLabel } from '../data/rivalries.js'

const VIEW_DIVISIONS = [
  'PL',
  'CH',
  'SPL',
  'SCH',
  'LALIGA',
  'SEGUNDA',
  'SERIEA',
  'SERIEB',
  'BUNDESLIGA',
  'BUNDESLIGA2',
  'LIGUE1',
  'LIGUE2',
  'EREDIVISIE',
  'EERSTEDIVISIE',
  'PRIMEIRALIGA',
  'LIGAPORTUGAL2',
]

function zoneClass(position, division) {
  if (division === 'PL') {
    if (position <= 4) return 'zone-europe'
    if (position >= 18) return 'zone-relegation'
    return ''
  }
  if (division === 'LALIGA' || division === 'SERIEA') {
    if (position <= 4) return 'zone-europe'
    if (position >= 18) return 'zone-relegation'
    return ''
  }
  if (division === 'BUNDESLIGA' || division === 'LIGUE1' || division === 'EREDIVISIE' || division === 'PRIMEIRALIGA') {
    // 18-club league: bottom 3 relegated.
    if (position <= 4) return 'zone-europe'
    if (position >= 16) return 'zone-relegation'
    return ''
  }
  if (division === 'CH' || division === 'SEGUNDA' || division === 'SERIEB' || division === 'EERSTEDIVISIE') {
    if (position <= 2) return 'zone-promotion'
    if (position <= 6) return 'zone-playoff'
    if (position >= 18) return 'zone-relegation'
    return ''
  }
  if (division === 'BUNDESLIGA2' || division === 'LIGUE2' || division === 'LIGAPORTUGAL2') {
    // 18-club league: bottom 3 relegated.
    if (position <= 2) return 'zone-promotion'
    if (position <= 6) return 'zone-playoff'
    if (position >= 16) return 'zone-relegation'
    return ''
  }
  if (division === 'SPL') {
    // 12-club league: bottom 2 relegated.
    if (position >= 11) return 'zone-relegation'
    return ''
  }
  if (division === 'SCH') {
    // 10-club league: champion auto-promoted, 2nd-5th contest the play-off.
    // No relegation zone - there's no third tier below it in this game.
    if (position === 1) return 'zone-promotion'
    if (position <= 5) return 'zone-playoff'
    return ''
  }
  return ''
}

function CupPanel({ state, cup, title, roundWeeks }) {
  if (!cup) return null
  const status = clubCupStatus(cup, state.playerClubId)
  const stillIn = cup.matches.some((m) => m.home === state.playerClubId || m.away === state.playerClubId)
  const nextWeek = roundWeeks[cup.roundIndex]

  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
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

function EuropePanel({ state }) {
  const europe = state.europe
  if (!europe) return null
  const compName = europe.competition === 'UCL' ? 'Champions League' : 'Europa League'
  const nextWeek = EURO_ROUND_WEEKS[europe.roundIndex]
  const lastTie = europe.history[europe.history.length - 1]

  return (
    <div className="panel">
      <div className="panel-title">{compName.toUpperCase()}</div>
      {europe.champion && <p>You are Champions of Europe! 🏆</p>}
      {!europe.champion && !europe.eliminated && (
        <p>
          Your status: {EURO_ROUND_NAMES[europe.roundIndex]}
          {nextWeek ? ` — next tie in Week ${nextWeek}` : ''}
        </p>
      )}
      {europe.eliminated && lastTie && (
        <p>Eliminated in the {lastTie.round} by {lastTie.opponent} ({lastTie.playerGoals}-{lastTie.opponentGoals}).</p>
      )}
      {europe.history.length > 0 && (
        <ul style={{ marginTop: 6 }}>
          {europe.history.map((h, i) => (
            <li key={i}>
              {h.round}: {h.won ? 'Won' : 'Lost'} {h.playerGoals}-{h.opponentGoals} {h.won ? 'vs' : 'to'} {h.opponent}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PressConferencePanel({ state, dispatch }) {
  if (!state.lastMatch || state.pressConferenceHandled) return null

  return (
    <div className="panel">
      <div className="panel-title">POST-MATCH PRESS CONFERENCE</div>
      <p>The press want your reaction to the result. How do you respond?</p>
      <div className="field-row">
        {Object.entries(RESPONSE_TYPES).map(([key, { label, quote }]) => (
          <button
            key={key}
            className="btn btn-small"
            title={quote}
            onClick={() => dispatch({ type: 'RESPOND_TO_PRESS', payload: { responseType: key } })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FixturesScreen({ state, dispatch }) {
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
            {VIEW_DIVISIONS.map((d) => (
              <button key={d} className={`tab${viewDivision === d ? ' active' : ''}`} onClick={() => setViewDivision(d)}>
                {DIVISION_LABELS[d]}
              </button>
            ))}
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
                  <th>Form</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => {
                  const position = i + 1
                  const classes = [zoneClass(position, viewDivision)]
                  if (row.clubId === state.playerClubId) classes.push('highlight-row')
                  const form = recentFormForClub(state.fixtures, row.clubId)
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
                      <td className="form-guide">
                        {form.map((outcome, fi) => (
                          <span key={fi} className={`result-badge result-${outcome.toLowerCase()}`}>
                            {outcome}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            {viewDivision === 'PL' && (
              <>
                <span className="zone-swatch zone-europe" /> Champions League/Europe &nbsp;
                <span className="zone-swatch zone-relegation" /> Relegation
              </>
            )}
            {(viewDivision === 'CH' ||
              viewDivision === 'SEGUNDA' ||
              viewDivision === 'SERIEB' ||
              viewDivision === 'BUNDESLIGA2' ||
              viewDivision === 'LIGUE2' ||
              viewDivision === 'EERSTEDIVISIE' ||
              viewDivision === 'LIGAPORTUGAL2') && (
              <>
                <span className="zone-swatch zone-promotion" /> Automatic promotion &nbsp;
                <span className="zone-swatch zone-playoff" /> Play-offs &nbsp;
                <span className="zone-swatch zone-relegation" /> Relegation
              </>
            )}
            {viewDivision === 'SPL' && <><span className="zone-swatch zone-relegation" /> Relegation</>}
            {viewDivision === 'SCH' && (
              <>
                <span className="zone-swatch zone-promotion" /> Automatic promotion &nbsp;
                <span className="zone-swatch zone-playoff" /> Play-offs
              </>
            )}
            {(viewDivision === 'LALIGA' ||
              viewDivision === 'SERIEA' ||
              viewDivision === 'BUNDESLIGA' ||
              viewDivision === 'LIGUE1' ||
              viewDivision === 'EREDIVISIE' ||
              viewDivision === 'PRIMEIRALIGA') && (
              <>
                <span className="zone-swatch zone-europe" /> Champions League/Europe &nbsp;
                <span className="zone-swatch zone-relegation" /> Relegation
              </>
            )}
          </p>
          <CupPanel state={state} cup={state.cup} title="FA CUP" roundWeeks={CUP_ROUND_WEEKS} />
          <CupPanel state={state} cup={state.scottishCup} title="SCOTTISH CUP" roundWeeks={SCOTTISH_CUP_ROUND_WEEKS} />
          <EuropePanel state={state} />
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">FIXTURES — WEEK {state.week}</div>
            {upcoming ? (
              <ul>
                {ownFixtures.map((m) => {
                  const label = derbyLabel(m.home, m.away)
                  return (
                    <li key={m.id} style={m.home === state.playerClubId || m.away === state.playerClubId ? { fontWeight: 'bold' } : undefined}>
                      {CLUB_BY_ID[m.home].name} vs {CLUB_BY_ID[m.away].name}
                      {label && <span className="deadline-day-badge" style={{ marginLeft: 8 }}>{label.toUpperCase()}</span>}
                    </li>
                  )
                })}
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
              <div className="stand-backdrop">
                <div className="roof" />
                <div className="crowd" />
              </div>
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

          <PressConferencePanel state={state} dispatch={dispatch} />
        </div>
      </div>
    </div>
  )
}
