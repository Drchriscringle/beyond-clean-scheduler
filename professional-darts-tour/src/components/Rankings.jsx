import { useState } from 'react'
import { RANKING_LABELS, ranking, rankOf, rankingValue } from '../career/rankings.js'
import { money, playerLabel } from './common.jsx'
import { PremierTable } from './EventScreen.jsx'

const CUTS = { oom: [[64, 'Top 64 keep their Tour Cards'], [16, 'Top 16: Matchplay & Grand Prix seeds']], pt: [[16, 'Top 16 non-seeds: Matchplay & Grand Prix'], [40, 'Top 40: World Championship']], pc: [[64, 'Top 64: Players Championship Finals']], et: [[32, 'Top 32: European Championship']], ct: [[2, 'Top 2 win Tour Cards'], [3, 'Top 3: World Championship']], dt: [[2, 'Top 2 win Tour Cards'], [3, 'Top 3: World Championship']], ws: [[8, 'Top 8: World Series Finals seeds']] }

export default function Rankings({ career }) {
  const [key, setKey] = useState('oom')
  const y = career.year
  const list = key === 'pl' ? [] : ranking(career, key).filter((id) => key === 'oom' || rankingValue(career.players[id], y, key) > 0 || id === 'user')
  const me = rankOf(list, 'user')
  return (
    <div className="tab-body">
      <select value={key} onChange={(e) => setKey(e.target.value)}>
        {Object.entries(RANKING_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        {career.pl && <option value="pl">Premier League table</option>}
      </select>
      {key === 'pl' ? <PremierTable career={career} /> : (
        <>
          {me && me > 150 && <p className="muted">You are #{me}.</p>}
          {!list.length && <p className="muted">No prize money won yet this season.</p>}
          <table className="rank-table">
            <tbody>
              {list.slice(0, 150).map((id, i) => {
                const cut = (CUTS[key] ?? []).find(([n]) => n === i + 1)
                return (
                  <tr key={id} className={`${id === 'user' ? 'me' : ''} ${cut ? 'cutline' : ''}`} title={cut?.[1]}>
                    <td>{i + 1}</td>
                    <td>{playerLabel(career, id)}{career.players[id].tour === 'pro' && key !== 'oom' ? '' : ''}</td>
                    <td className="num">{money(rankingValue(career.players[id], y, key))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ul className="plain small-text muted">{(CUTS[key] ?? []).map(([n, t]) => <li key={n}>Red dashed line under #{n}: {t}</li>)}</ul>
        </>
      )}
    </div>
  )
}
