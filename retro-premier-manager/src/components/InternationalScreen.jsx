export default function InternationalScreen({ state, dispatch }) {
  const { international, internationalOffer } = state

  function respond(accept) {
    dispatch({ type: 'RESPOND_TO_INTERNATIONAL_OFFER', payload: { accept } })
  }

  function resign() {
    dispatch({ type: 'RESIGN_INTERNATIONAL' })
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-title">INTERNATIONAL MANAGEMENT</div>

        {internationalOffer && !international && (
          <div className="panel-inset">
            <p>
              <strong>The FA have been in touch.</strong> Your form in club management has caught the selectors' eye —
              they'd like you to take charge of the England national team alongside your club job.
            </p>
            <button className="btn btn-primary" onClick={() => respond(true)}>
              Accept the England Job
            </button>{' '}
            <button className="btn" onClick={() => respond(false)}>
              Turn It Down
            </button>
          </div>
        )}

        {international && (
          <div className="panel-inset">
            <p>You are the England manager, appointed in {international.appointedSeason}.</p>
            <p>
              Record: {international.played} played, {international.won} won, {international.drawn} drawn, {international.lost} lost
            </p>
            <p>Recent form: {international.form.length > 0 ? international.form.join(' ') : '—'}</p>
            {international.lastResult && (
              <p>
                Last result: England {international.lastResult.englandGoals}-{international.lastResult.opponentGoals}{' '}
                {international.lastResult.opponent}
              </p>
            )}
            <button className="btn btn-danger" onClick={resign}>
              Resign as England Manager
            </button>
          </div>
        )}

        {!international && !internationalOffer && (
          <p>
            No international recognition yet. A strong season in charge of your club — or winning the league — may
            catch the selectors' eye and bring an England call-up.
          </p>
        )}
      </div>
    </div>
  )
}
