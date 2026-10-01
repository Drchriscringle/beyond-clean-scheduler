import { COMPETITIONS } from '../career/data/competitions.js'
import { currentEvent, nextUserTask, taskFormat, taskOpponentAverage, taskStage } from '../career/career.js'
import { plTable } from '../career/entry.js'
import { formatLabel, prizeFund, scaledPrizes, roundName } from '../career/formats.js'
import { ranking, rankOf } from '../career/rankings.js'
import { standings } from '../career/tournament.js'
import { dateLabel, money, playerLabel, TIER_LABELS } from './common.jsx'
import Face, { faceFor } from './Face.jsx'

export default function EventScreen({ career, onPlay, onSimMatch, onSimRest, onSimEvent, onFinish, onBack }) {
  const event = currentEvent(career)
  const comp = COMPETITIONS[event.key]
  const a = career.active
  const t = a.tournament
  const task = nextUserTask(career)
  const playing = task.kind === 'round' || task.kind === 'qualifier'
  const lastRound = t.results[t.round]?.length ? t.round : t.round - 1
  const lastResults = lastRound >= 0 ? (t.results[lastRound] ?? []).filter((r) => !r.bye) : []
  const oom = ranking(career, 'oom')
  const fund = prizeFund(event.key, career.prizeScale)
  const preview = playing ? taskOpponentAverage(career, task, () => 0.5) : null
  const h2h = playing ? career.h2h[task.opponent] : null
  const team = a.teams && a.userSide ? a.teams[a.userSide] : null

  return (
    <div className="screen event">
      <button className="btn ghost small back" onClick={onBack}>‹ Tour</button>
      <div className="event-head">
        <div className="event-tier">{TIER_LABELS[event.tier]} · {dateLabel(event)}</div>
        <h1>{event.name}</h1>
        <div className="event-meta">{event.venue ?? ''}</div>
        {fund > 0 && <div className="event-meta">Prize fund {money(fund)} · Winner {money(scaledPrizes(event.key, career.prizeScale).prizes[0])}</div>}
        {a.reason && <div className="event-meta muted">{a.reason}</div>}
        {team && <div className="event-meta">Team {playerLabel(career, a.userSide)}: you and {career.players[team.players.find((id) => id !== 'user')].name}</div>}
      </div>

      {playing && (
        <div className="card next-match">
          <div className="card-label">{taskStage(career, task)}</div>
          <div className="opp-row">
            {career.players[task.opponent] && <Face face={faceFor(career.players[task.opponent])} shirt={{ primary: '#2b2b30', secondary: '#111' }} size={64} ring />}
            <div className="opp-name">{playerLabel(career, task.opponent)}</div>
          </div>
          {career.players[task.opponent] && <div className="opp-nick">“{career.players[task.opponent].nickname}”</div>}
          <div className="opp-meta">
            {career.players[task.opponent] ? (rankOf(oom, task.opponent) ? `Order of Merit #${rankOf(oom, task.opponent)} · ` : 'Unranked · ') : ''}Expected average ≈ {preview.expected}
          </div>
          {h2h && <div className="opp-meta">Head to head: {h2h.w}–{h2h.l}{h2h.w + h2h.l >= 3 && Math.abs(h2h.w - h2h.l) <= 1 ? ' · Rivalry!' : ''}</div>}
          <div className="opp-meta">{formatLabel(taskFormat(career, task))}</div>
          {a.live?.match ? (
            <button className="btn primary big" onClick={onPlay}>Resume match</button>
          ) : (
            <div className="btn-row">
              <button className="btn primary big" onClick={onPlay}>Play on the oche</button>
              <button className="btn" onClick={onSimMatch}>Auto-sim this match</button>
              <button className="btn ghost" onClick={onSimEvent}>Auto-sim my whole event</button>
            </div>
          )}
        </div>
      )}

      {task.kind === 'spectate' && (
        <div className="card">
          {(() => {
            const out = a.qualifier?.lost || !a.userSide || t.eliminated[a.userSide] !== undefined
            return (
              <>
                <p>{a.qualifier?.lost ? `You lost in the ${a.qualifier.name}.` : out ? 'You are out of the event.' : t.round < (t.groupMatchdays ?? 0) ? 'You sit out this matchday.' : 'You have a bye into the next round.'}</p>
                <button className="btn primary" onClick={onSimRest}>{out ? 'Simulate the rest' : 'Play on to my next match'}</button>
              </>
            )
          })()}
        </div>
      )}

      {task.kind === 'finished' && (
        <div className="card champion">
          <div className="card-label">Champion</div>
          <div className="opp-name">🏆 {playerLabel(career, t.champion)}</div>
          {(t.champion === a.userSide) && <p className="gold">You've won the {event.name}!</p>}
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

      {t.groups && task.kind !== 'qualifier' && <GroupTables career={career} t={t} />}
      {(event.key === 'premier' || event.key === 'plPlayoffs') && <PremierTable career={career} />}

      {lastResults.length > 0 && (
        <details className="card">
          <summary className="card-label">{roundName(t, lastRound)} results</summary>
          <ul className="results-list">
            {lastResults.map((r, i) => (
              <li key={i}>
                <span className={r.winner === r.a ? 'bold' : ''}>{playerLabel(career, r.a)}</span>
                <span className="score">{r.score[0]}–{r.score[1]}</span>
                <span className={r.winner === r.b ? 'bold' : ''}>{playerLabel(career, r.b)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="card">
        <summary className="card-label">Format</summary>
        <p className="small-text">{comp.blurb}</p>
      </details>
    </div>
  )
}

function GroupTables({ career, t }) {
  const letters = 'ABCDEFGHIJKL'
  const mine = t.groups.findIndex((g) => g.includes(career.active.userSide))
  const order = mine >= 0 ? [mine, ...t.groups.map((_, i) => i).filter((i) => i !== mine)] : t.groups.map((_, i) => i)
  return (
    <details className="card" open={mine >= 0}>
      <summary className="card-label">Groups</summary>
      {order.map((gi) => (
        <table key={gi} className="group-table">
          <thead><tr><th>Group {letters[gi]}</th><th>P</th><th>W</th><th>+/−</th><th>Pts</th></tr></thead>
          <tbody>
            {standings(t, t.groups[gi]).map((id, pos) => {
              const r = t.table[id]
              return (
                <tr key={id} className={`${id === career.active.userSide ? 'me' : ''} ${pos < t.advance ? 'through' : ''}`}>
                  <td>{playerLabel(career, id)}</td><td>{r.played}</td><td>{r.won}</td><td>{r.legsFor - r.legsAgainst}</td><td>{r.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ))}
    </details>
  )
}

export function PremierTable({ career }) {
  const pl = career.pl
  if (!pl) return null
  return (
    <div className="card">
      <div className="card-label">Premier League table</div>
      <table className="group-table">
        <thead><tr><th></th><th>Nights</th><th>+/−</th><th>Pts</th></tr></thead>
        <tbody>
          {plTable(career).map((id, i) => {
            const r = pl.table[id]
            return (
              <tr key={id} className={`${id === 'user' ? 'me' : ''} ${i < 4 ? 'through' : ''}`}>
                <td>{i + 1}. {playerLabel(career, id)}</td><td>{r.nightWins}</td><td>{r.legsFor - r.legsAgainst}</td><td>{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
