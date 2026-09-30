import { formatLabel, prizeFund, qualifierFormat, roundFormat, roundName, MONTHS } from '../career/calendar.js'
import { currentEvent, nextUserTask, proRanking, rankOf } from '../career/career.js'
import { opponentAverages } from '../career/difficulty.js'
import { money, playerLabel, TIER_LABELS } from './common.jsx'

export default function EventScreen({ career, onPlay, onSimMatch, onSimRest, onFinish, onBack }) {
  const event = currentEvent(career)
  const a = career.active
  const t = a.tournament
  const task = nextUserTask(career)
  const opponent = task.opponent ? career.players[task.opponent] : null
  const lastRound = t.results[t.round]?.length ? t.round : t.round - 1
  const lastResults = lastRound >= 0 ? t.results[lastRound] ?? [] : []
  const pros = proRanking(career)
  const format =
    task.kind === 'qualifier' ? qualifierFormat(career.settings.matchLength) : task.kind === 'round' ? roundFormat(event, task.round, career.settings.matchLength) : null
  const preview = opponent ? opponentAverages(career, opponent.rating, { round: task.kind === 'round' ? task.round : 0, tier: event.tier }) : null

  return (
    <div className="screen event">
      <button className="btn ghost small back" onClick={onBack}>‹ Tour</button>
      <div className="event-head">
        <div className="event-tier">{TIER_LABELS[event.tier]} · {MONTHS[event.month]} {event.year}</div>
        <h1>{event.name}</h1>
        <div className="event-meta">
          {t.size} players{prizeFund(event) ? ` · Prize fund ${money(prizeFund(event))} · Winner ${money(event.prizes[0])}` : ''}
        </div>
        <div className="event-meta muted">{a.entry.reason}</div>
      </div>

      {(task.kind === 'round' || task.kind === 'qualifier') && (
        <div className="card next-match">
          <div className="card-label">{task.kind === 'qualifier' ? 'Tour Card Holder Qualifier' : roundName(t.size, task.round)}</div>
          <div className="opp-name">{playerLabel(career, task.opponent)}</div>
          <div className="opp-nick">“{opponent.nickname}”</div>
          <div className="opp-meta">
            {opponent.tour === 'pro' ? `Order of Merit #${rankOf(pros, task.opponent) ?? '—'}` : 'Challenge Tour'} · Expected average ≈ {preview.expected}
          </div>
          <div className="opp-meta">{formatLabel(format)}</div>
          {a.live?.match ? (
            <button className="btn primary big" onClick={onPlay}>Resume match</button>
          ) : (
            <div className="btn-row">
              <button className="btn primary big" onClick={onPlay}>Play on the oche</button>
              <button className="btn" onClick={onSimMatch}>Auto-sim this match</button>
            </div>
          )}
        </div>
      )}

      {task.kind === 'spectate' && (
        <div className="card">
          <p>{a.qualifier?.result && !a.qualifier.result.userWon ? 'You lost in qualifying.' : t.eliminated.user !== undefined ? 'You are out of the event.' : 'Waiting for the rest of the draw.'}</p>
          <button className="btn primary" onClick={onSimRest}>Simulate the rest of the event</button>
        </div>
      )}

      {task.kind === 'finished' && (
        <div className="card champion">
          <div className="card-label">Champion</div>
          <div className="opp-name">🏆 {playerLabel(career, t.champion)}</div>
          {t.champion === 'user' && <p className="gold">You've won {event.name}!</p>}
          <button className="btn primary" onClick={onFinish}>Back to the tour</button>
        </div>
      )}

      {a.userLog.length > 0 && (
        <div className="card">
          <div className="card-label">Your run</div>
          <ul className="run-list">
            {a.userLog.map((m, i) => (
              <li key={i} className={m.userWon ? 'win' : 'loss'}>
                <span>{m.stage}</span>
                <span>{m.userWon ? 'W' : 'L'} {m.score[0]}–{m.score[1]}{m.sets ? ' sets' : ''}</span>
                <span className="muted">{playerLabel(career, m.opponent)}</span>
                <span className="muted">{m.simulated ? 'sim' : `${m.userAvg.toFixed(1)} v ${m.oppAvg.toFixed(1)}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastResults.length > 0 && (
        <details className="card">
          <summary className="card-label">{roundName(t.size, lastRound)} results</summary>
          <ul className="results-list">
            {lastResults.filter((r) => !r.bye).map((r, i) => (
              <li key={i}>
                <span className={r.winner === r.a ? 'bold' : ''}>{playerLabel(career, r.a)}</span>
                <span className="score">{r.score[0]}–{r.score[1]}</span>
                <span className={r.winner === r.b ? 'bold' : ''}>{playerLabel(career, r.b)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
