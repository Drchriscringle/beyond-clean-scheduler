import { CLUB_BY_ID, DIVISION_LABELS } from '../data/clubs.js'

const OUTCOME_LABEL = {
  completed: 'Continued',
  sacked: 'Sacked',
  'sacked-mid-season': 'Sacked (mid-season)',
}

function ordinalSuffix(n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}

export default function CareerScreen({ state }) {
  const history = state.careerHistory ?? []
  const trophies = history.filter((h) => h.cupResult === 'FA Cup Winner').length
  const promotions = history.filter((h, i) => {
    const next = history[i + 1]
    return (
      next &&
      next.clubId === h.clubId &&
      ((h.division === 'CH' && next.division === 'PL') ||
        (h.division === 'SCH' && next.division === 'SPL') ||
        (h.division === 'SEGUNDA' && next.division === 'LALIGA') ||
        (h.division === 'SERIEB' && next.division === 'SERIEA') ||
        (h.division === 'BUNDESLIGA2' && next.division === 'BUNDESLIGA') ||
        (h.division === 'LIGUE2' && next.division === 'LIGUE1') ||
        (h.division === 'EERSTEDIVISIE' && next.division === 'EREDIVISIE'))
    )
  }).length
  const seasonsManaged = history.length
  const clubsManaged = new Set(history.map((h) => h.clubId)).size

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">MANAGER CAREER</div>
        <p>{state.managerName}</p>
        <div className="grid-2">
          <p>Seasons managed: {seasonsManaged}</p>
          <p>Clubs managed: {clubsManaged}</p>
          <p>FA Cups won: {trophies}</p>
          <p>Promotions won: {promotions}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">SEASON-BY-SEASON RECORD</div>
        {history.length === 0 && <p>No completed seasons yet - your career record will build up here.</p>}
        {history.length > 0 && (
          <div className="scrollbox">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Club</th>
                  <th>Division</th>
                  <th>Position</th>
                  <th>Objective</th>
                  <th>Cup</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={history.length - 1 - i}>
                    <td>
                      {h.season}/{String(h.season + 1).slice(2)}
                    </td>
                    <td>{CLUB_BY_ID[h.clubId]?.name ?? h.clubId}</td>
                    <td>{DIVISION_LABELS[h.division] ?? h.division}</td>
                    <td>
                      {h.finalPosition}
                      {ordinalSuffix(h.finalPosition)}
                    </td>
                    <td>
                      {h.objectiveLabel}
                      {h.objectiveMet === true && ' — met'}
                      {h.objectiveMet === false && ' — missed'}
                    </td>
                    <td>{h.cupResult ?? '-'}</td>
                    <td>{OUTCOME_LABEL[h.outcome] ?? h.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
