import { useState } from 'react'
import { ALL_CLUBS, CLUB_BY_ID } from '../data/clubs.js'
import { formatWage, formatMoneyFull } from '../utils/format.js'
import { Money, FormBadge, AbilityCell } from './shared.jsx'
import { windowStatus } from '../state/transferWindows.js'

export default function TransfersScreen({ state, dispatch }) {
  const [tab, setTab] = useState('browse')
  const [browseClubId, setBrowseClubId] = useState(ALL_CLUBS.find((c) => c.id !== state.playerClubId).id)

  const club = state.clubs[state.playerClubId]
  const ownSquad = state.squads[state.playerClubId]
  const listed = ownSquad.filter((p) => p.listed)
  const browseSquad = state.squads[browseClubId] ?? []
  const window_ = windowStatus(state.week)

  function viewPlayer(playerId, clubId) {
    dispatch({ type: 'NAVIGATE', payload: { screen: 'player-detail', playerId, clubId } })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">TRANSFERS</div>
        <p>Transfer budget: <Money value={club.budget} /> &nbsp; Bank balance: <Money value={club.bankBalance} /></p>
        <p className={window_.open ? 'window-open' : 'window-closed'}>
          {window_.open
            ? `${window_.label} — closes after Week ${window_.closesAfterWeek}`
            : `${window_.label}${window_.opensWeek ? ` — reopens Week ${window_.opensWeek}` : ' for the rest of the season'}`}
        </p>
        <div className="tabs">
          {['browse', 'free-agents', 'listed', 'offers', 'activity'].map((t) => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'browse'
                ? 'Browse Clubs'
                : t === 'free-agents'
                  ? 'Free Agents'
                  : t === 'listed'
                    ? 'Transfer List'
                    : t === 'offers'
                      ? `Offers${state.incomingOffers.length > 0 ? ` (${state.incomingOffers.length})` : ''}`
                      : 'Activity'}
            </button>
          ))}
        </div>

        <div className="panel-inset">
          {tab === 'browse' && (
            <>
              <div className="field-row">
                <label htmlFor="browse-club">Club</label>
                <select id="browse-club" value={browseClubId} onChange={(e) => setBrowseClubId(e.target.value)}>
                  {ALL_CLUBS.filter((c) => c.id !== state.playerClubId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.division === 'CH' ? '(Championship)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="scrollbox">
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Pos</th>
                      <th>Age</th>
                      <th>CA</th>
                      <th>Form</th>
                      <th>Wage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {browseSquad.map((p) => (
                      <tr key={p.id} className="clickable" onClick={() => viewPlayer(p.id, browseClubId)}>
                        <td>{p.name}</td>
                        <td>{p.position}</td>
                        <td>{p.age}</td>
                        <td><AbilityCell player={p} value={p.ability} /></td>
                        <td><FormBadge player={p} /></td>
                        <td>{formatWage(p.wage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'free-agents' && (
            <div className="scrollbox">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th>Age</th>
                    <th>CA</th>
                    <th>Wage ask</th>
                  </tr>
                </thead>
                <tbody>
                  {state.freeAgents.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => viewPlayer(p.id, null)}>
                      <td>{p.name}</td>
                      <td>{p.position}</td>
                      <td>{p.age}</td>
                      <td><AbilityCell player={p} value={p.ability} /></td>
                      <td>{formatWage(p.wage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'listed' && (
            <div className="scrollbox">
              {listed.length === 0 && <p>No players currently transfer-listed. Tick "Listed" on the Squad screen.</p>}
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th>Age</th>
                    <th>CA</th>
                    <th>Form</th>
                    <th>Wage</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => dispatch({ type: 'NAVIGATE', payload: { screen: 'player-detail', playerId: p.id, clubId: null } })}>
                      <td>{p.name}</td>
                      <td>{p.position}</td>
                      <td>{p.age}</td>
                      <td><AbilityCell player={p} value={p.ability} /></td>
                      <td><FormBadge player={p} /></td>
                      <td>{formatWage(p.wage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'offers' && (
            <div className="scrollbox">
              {state.incomingOffers.length === 0 && (
                <p>No offers on the table. List a player for transfer on the Squad screen to attract interest.</p>
              )}
              {state.incomingOffers.map((offer) => (
                <div key={offer.id} className="panel-inset" style={{ marginBottom: 8 }}>
                  <p>
                    <strong>{CLUB_BY_ID[offer.fromClubId].name}</strong> offer {formatMoneyFull(offer.fee)} for{' '}
                    <strong>{offer.playerName}</strong> (Wk{offer.week}).
                  </p>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => dispatch({ type: 'RESPOND_TO_OFFER', payload: { offerId: offer.id, accept: true } })}
                  >
                    Accept
                  </button>{' '}
                  <button
                    className="btn btn-small"
                    onClick={() => dispatch({ type: 'RESPOND_TO_OFFER', payload: { offerId: offer.id, accept: false } })}
                  >
                    Reject
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'activity' && (
            <div className="scrollbox">
              {state.transferLog.length === 0 && <p>No transfer activity yet this season.</p>}
              {state.transferLog.map((entry, i) => (
                <p key={i}>
                  Wk{entry.week}: {entry.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
