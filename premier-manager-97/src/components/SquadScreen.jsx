import { useState, useMemo } from 'react'
import { formatWage } from '../utils/format.js'
import { currentForm } from '../state/form.js'
import { FormBadge, AbilityCell } from './shared.jsx'

const COLUMNS = [
  { key: 'squadNumber', label: '#' },
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Pos' },
  { key: 'age', label: 'Age' },
  { key: 'ability', label: 'CA' },
  { key: 'potential', label: 'PA' },
  { key: 'form', label: 'Form' },
  { key: 'goals', label: 'G' },
  { key: 'assists', label: 'A' },
  { key: 'wage', label: 'Wage' },
  { key: 'contractYears', label: 'Contract' },
  { key: 'morale', label: 'Morale' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'status', label: 'Status' },
  { key: 'listed', label: 'Listed' },
]

function playerStatus(p) {
  if (p.injured) return `${p.injuryType} (${p.injuryWeeks}wk)`
  if (p.suspended) return `Suspended (${p.suspensionMatches})`
  return '-'
}

export default function SquadScreen({ state, dispatch }) {
  const [sortKey, setSortKey] = useState('squadNumber')
  const [sortDir, setSortDir] = useState(1)

  const squad = state.squads[state.playerClubId]
  const club = state.clubs[state.playerClubId]

  const withForm = useMemo(
    () => squad.map((p) => ({ ...p, form: currentForm(p), goals: p.stats.goals, assists: p.stats.assists })),
    [squad],
  )

  const sorted = useMemo(() => {
    const copy = [...withForm]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'string') return va.localeCompare(vb) * sortDir
      return (va - vb) * sortDir
    })
    return copy
  }, [withForm, sortKey, sortDir])

  function handleSort(key) {
    if (key === sortKey) setSortDir((d) => -d)
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  const wageBill = squad.reduce((sum, p) => sum + p.wage, 0)

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">{club.name.toUpperCase()} — FIRST TEAM SQUAD ({squad.length}/30)</div>
        <p>Weekly wage bill: {formatWage(wageBill)}</p>
        <div className="scrollbox">
          <table className="pm-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => handleSort(c.key)}>
                    {c.label}
                    {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className="clickable"
                  onClick={() => dispatch({ type: 'NAVIGATE', payload: { screen: 'player-detail', playerId: p.id, clubId: null } })}
                >
                  <td>{p.squadNumber}</td>
                  <td>{p.name}{p.injured ? ' 🩹' : ''}{p.suspended ? ' 🟥' : ''}</td>
                  <td>{p.position}</td>
                  <td>{p.age}</td>
                  <td><AbilityCell player={p} value={p.ability} /></td>
                  <td><AbilityCell player={p} value={p.potential} /></td>
                  <td><FormBadge player={p} /></td>
                  <td>{p.stats.goals}</td>
                  <td>{p.stats.assists}</td>
                  <td>{formatWage(p.wage)}</td>
                  <td style={p.contractYears <= 1 ? { color: '#800000', fontWeight: 'bold' } : undefined}>
                    {p.contractYears === 0 ? 'Expiring!' : `${p.contractYears} yr`}
                  </td>
                  <td>{p.morale}</td>
                  <td>{p.fitness}</td>
                  <td style={p.injured || p.suspended ? { color: '#800000', fontWeight: 'bold' } : undefined}>
                    {playerStatus(p)}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={p.listed}
                      onChange={(e) => {
                        e.stopPropagation()
                        dispatch({ type: 'TOGGLE_LISTED', payload: { playerId: p.id } })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
