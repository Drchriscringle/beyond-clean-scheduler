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
  const segundaResults = results.filter((r) => state.clubs[r.home]?.division === 'SEGUNDA')
  const serieAResults = results.filter((r) => state.clubs[r.home]?.division === 'SERIEA')
  const serieBResults = results.filter((r) => state.clubs[r.home]?.division === 'SERIEB')
  const bundesligaResults = results.filter((r) => state.clubs[r.home]?.division === 'BUNDESLIGA')
  const bundesliga2Results = results.filter((r) => state.clubs[r.home]?.division === 'BUNDESLIGA2')
  const ligue1Results = results.filter((r) => state.clubs[r.home]?.division === 'LIGUE1')
  const ligue2Results = results.filter((r) => state.clubs[r.home]?.division === 'LIGUE2')
  const eredivisieResults = results.filter((r) => state.clubs[r.home]?.division === 'EREDIVISIE')
  const eersteDivisieResults = results.filter((r) => state.clubs[r.home]?.division === 'EERSTEDIVISIE')
  const primeiraLigaResults = results.filter((r) => state.clubs[r.home]?.division === 'PRIMEIRALIGA')
  const ligaPortugal2Results = results.filter((r) => state.clubs[r.home]?.division === 'LIGAPORTUGAL2')
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

        <div className="panel">
          <div className="panel-title">SEGUNDA DIVISION RESULTS</div>
          {segundaResults.length === 0 && <p>No Segunda Division fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {segundaResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">SERIE A RESULTS</div>
          {serieAResults.length === 0 && <p>No Serie A fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {serieAResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">SERIE B RESULTS</div>
          {serieBResults.length === 0 && <p>No Serie B fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {serieBResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">BUNDESLIGA RESULTS</div>
          {bundesligaResults.length === 0 && <p>No Bundesliga fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {bundesligaResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">2. BUNDESLIGA RESULTS</div>
          {bundesliga2Results.length === 0 && <p>No 2. Bundesliga fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {bundesliga2Results.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">LIGUE 1 RESULTS</div>
          {ligue1Results.length === 0 && <p>No Ligue 1 fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {ligue1Results.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">LIGUE 2 RESULTS</div>
          {ligue2Results.length === 0 && <p>No Ligue 2 fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {ligue2Results.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">EREDIVISIE RESULTS</div>
          {eredivisieResults.length === 0 && <p>No Eredivisie fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {eredivisieResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">EERSTE DIVISIE RESULTS</div>
          {eersteDivisieResults.length === 0 && <p>No Eerste Divisie fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {eersteDivisieResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">PRIMEIRA LIGA RESULTS</div>
          {primeiraLigaResults.length === 0 && <p>No Primeira Liga fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {primeiraLigaResults.map((r, i) => (
                <li key={i} className={r.home === state.playerClubId || r.away === state.playerClubId ? 'highlight-row' : ''}>
                  {CLUB_BY_ID[r.home].name} {r.homeGoals}-{r.awayGoals} {CLUB_BY_ID[r.away].name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">LIGA PORTUGAL 2 RESULTS</div>
          {ligaPortugal2Results.length === 0 && <p>No Liga Portugal 2 fixtures last week.</p>}
          <div className="scrollbox">
            <ul>
              {ligaPortugal2Results.map((r, i) => (
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
