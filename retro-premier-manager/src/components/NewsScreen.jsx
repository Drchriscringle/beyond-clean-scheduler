import { CLUB_BY_ID } from '../data/clubs.js'

function AwardsPanel({ title, awards, onView }) {
  if (!awards) return null
  return (
    <div className="panel-inset">
      <h3>{title}</h3>
      {awards.goldenBoot ? (
        <p className="clickable" onClick={() => onView(awards.goldenBoot.playerId, awards.goldenBoot.clubId)}>
          <strong>Golden Boot:</strong> {awards.goldenBoot.name} ({CLUB_BY_ID[awards.goldenBoot.clubId].name}) — {awards.goldenBoot.goals} goals
        </p>
      ) : (
        <p>Golden Boot: not awarded.</p>
      )}
      {awards.playerOfSeason && (
        <p className="clickable" onClick={() => onView(awards.playerOfSeason.playerId, awards.playerOfSeason.clubId)}>
          <strong>Player of the Season:</strong> {awards.playerOfSeason.name} ({CLUB_BY_ID[awards.playerOfSeason.clubId].name}) — {awards.playerOfSeason.motm} MOTM, {awards.playerOfSeason.goals}g {awards.playerOfSeason.assists}a
        </p>
      )}
      {awards.teamOfSeason.length > 0 && (
        <>
          <strong>Team of the Season:</strong>
          <ul>
            {awards.teamOfSeason.map((p) => (
              <li key={p.playerId} className="clickable" onClick={() => onView(p.playerId, p.clubId)}>
                {p.position} — {p.name} ({CLUB_BY_ID[p.clubId].name})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function NewsScreen({ state, dispatch }) {
  const results = state.weekResults
  const plResults = results.filter((r) => state.clubs[r.home]?.division === 'PL')
  const chResults = results.filter((r) => state.clubs[r.home]?.division === 'CH')
  const splResults = results.filter((r) => state.clubs[r.home]?.division === 'SPL')
  const schResults = results.filter((r) => state.clubs[r.home]?.division === 'SCH')
  const laLigaResults = results.filter((r) => state.clubs[r.home]?.division === 'LALIGA')
  const lastCupRound = state.cup?.history?.[state.cup.history.length - 1]
  const lastScottishCupRound = state.scottishCup?.history?.[state.scottishCup.history.length - 1]
  const awards = state.lastSeasonAwards

  function viewPlayer(playerId, clubId) {
    dispatch({ type: 'NAVIGATE', payload: { screen: 'player-detail', playerId, clubId } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">LEAGUE NEWS — WEEK {Math.min(state.week, 38)}</div>
        <p style={{ fontSize: 14 }}>Everything that happened across both divisions last time round.</p>
      </div>

      {awards && (
        <div className="panel">
          <div className="panel-title">SEASON AWARDS — {awards.season}/{String(awards.season + 1).slice(2)}</div>
          <div className="grid-2">
            <AwardsPanel title="Premier League" awards={awards.PL} onView={viewPlayer} />
            <AwardsPanel title="Championship" awards={awards.CH} onView={viewPlayer} />
          </div>
        </div>
      )}

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

        <div className="panel">
          <div className="panel-title">SCOTTISH PREMIERSHIP RESULTS</div>
          {splResults.length === 0 && <p>No Scottish Premiership fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {splResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">SCOTTISH CHAMPIONSHIP RESULTS</div>
          {schResults.length === 0 && <p>No Scottish Championship fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {schResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">LA LIGA RESULTS</div>
          {laLigaResults.length === 0 && <p>No La Liga fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {laLigaResults.map((r, i) => (
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

      {lastScottishCupRound && (
        <div className="panel">
          <div className="panel-title">SCOTTISH CUP — {lastScottishCupRound.round.toUpperCase()}</div>
          <div className="scrollbox">
            <ul>
              {lastScottishCupRound.matches.map((m, i) => (
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
