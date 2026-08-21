import { CLUB_BY_ID } from '../data/clubs.js'

export default function NewsScreen({ state }) {
  const results = state.weekResults
  const plResults = results.filter((r) => state.clubs[r.home]?.division === 'PL')
  const chResults = results.filter((r) => state.clubs[r.home]?.division === 'CH')
  const lastCupRound = state.cup?.history?.[state.cup.history.length - 1]

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">LEAGUE NEWS — WEEK {Math.min(state.week, 38)}</div>
        <p style={{ fontSize: 14 }}>Everything that happened across both divisions last time round.</p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">PREMIER LEAGUE RESULTS</div>
          {plResults.length === 0 && <p>No Premier League fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {plResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">CHAMPIONSHIP RESULTS</div>
          {chResults.length === 0 && <p>No Championship fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {chResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {lastCupRound && (
        <div className="panel">
          <div className="panel-title">FA CUP — {lastCupRound.round.toUpperCase()}</div>
          <div className="scrollbox">
            <ul>
              {lastCupRound.matches.map((m, i) => (
                <li key={i} className={m.home === state.playerClubId || m.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[m.home].name} {m.homeGoals}-{m.awayGoals} {CLUB_BY_ID[m.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">TRANSFER &amp; CLUB NEWS</div>
        {state.transferLog.length === 0 && <p>No transfer activity to report yet this season.</p>}
        <div className="scrollbox">
          {state.transferLog.map((entry, i) => (
            <p key={i}>
              Wk{entry.week}: {entry.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
