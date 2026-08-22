import { CLUB_BY_ID, DIVISION_LABELS, totalCapacity } from '../data/clubs.js'
import { RepStars } from './shared.jsx'
import { formatMoney } from '../utils/format.js'

export default function JobOfferScreen({ state, dispatch }) {
  const offers = state.jobOffers ?? []
  const currentClub = CLUB_BY_ID[state.playerClubId]

  function respond(clubId) {
    dispatch({ type: 'RESPOND_TO_JOB_OFFER', payload: { clubId } })
  }

  return (
    <div className="pm97-app">
      <div className="screen">
        <div className="panel">
          <div className="panel-title">JOB OFFERS</div>
          <p>
            Your work at {currentClub.name} has turned heads. The following clubs would like to speak to you about
            becoming their next manager.
          </p>
        </div>

        {offers.map((clubId) => {
          const staticClub = CLUB_BY_ID[clubId]
          const liveClub = state.clubs[clubId]
          return (
            <div className="panel" key={clubId}>
              <div className="panel-title">{staticClub.name.toUpperCase()}</div>
              <div className="grid-2">
                <div>
                  <p>Ground: {staticClub.ground}</p>
                  <p>Capacity: {totalCapacity(staticClub).toLocaleString('en-GB')}</p>
                  <p>
                    Reputation: <RepStars reputation={staticClub.reputation} />
                  </p>
                </div>
                <div>
                  <p>Division: {DIVISION_LABELS[liveClub.division]}</p>
                  <p>Transfer budget: {formatMoney(liveClub.budget)}</p>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => respond(clubId)}>
                Accept — Become {staticClub.name} Manager
              </button>
            </div>
          )
        })}

        <div className="panel">
          <button className="btn" onClick={() => respond(null)}>
            Decline All — Stay at {currentClub.name}
          </button>
        </div>
      </div>
    </div>
  )
}
