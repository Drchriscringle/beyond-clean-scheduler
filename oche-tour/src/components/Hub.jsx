import { useState } from 'react'
import { formatLabel, MATCH_LENGTHS, MONTHS, prizeFund, roundFormat } from '../career/calendar.js'
import { challengeRanking, currentEvent, proMoney, proRanking, rankOf, resolveEntry, CHALLENGE_CARDS, TOUR_CARD_KEEP_RANK } from '../career/career.js'
import { DIFFICULTIES } from '../career/difficulty.js'
import { threeDartAverage } from '../engine/match.js'
import { money, playerLabel, statusText, TIER_LABELS } from './common.jsx'

const TABS = ['Tour', 'Calendar', 'Rankings', 'Stats', 'News', 'Settings']

export default function Hub({ career, update, onContinue, onOpenEvent, onDelete }) {
  const [tab, setTab] = useState('Tour')
  return (
    <div className="screen hub">
      <header className="hub-head">
        <div className="logo">OCHE TOUR</div>
        <div className="season">{career.year} season</div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'Tour' && <TourTab career={career} onContinue={onContinue} onOpenEvent={onOpenEvent} />}
      {tab === 'Calendar' && <CalendarTab career={career} />}
      {tab === 'Rankings' && <RankingsTab career={career} />}
      {tab === 'Stats' && <StatsTab career={career} />}
      {tab === 'News' && <NewsTab career={career} />}
      {tab === 'Settings' && <SettingsTab career={career} update={update} onDelete={onDelete} />}
    </div>
  )
}

function TourTab({ career, onContinue, onOpenEvent }) {
  const user = career.players.user
  const y = career.year
  const pros = proRanking(career)
  const ct = challengeRanking(career)
  const event = currentEvent(career)
  const entry = event && !career.active ? resolveEntry(career, event, () => 0.5) : career.active?.entry
  const userEntered = career.active && (career.active.entry.userIn || career.active.qualifier)
  const seasonEarnings = (user.money[y] ?? 0) + (user.ctMoney[y] ?? 0)

  return (
    <div className="tab-body">
      {career.seasonEnded && (
        <div className="card review">
          <div className="card-label">Season {career.seasonEnded.year} review</div>
          <p>{career.seasonEnded.outcome}</p>
          <p className="muted">Earnings {money(career.seasonEnded.money)}{career.seasonEnded.titles.length ? ` · Titles: ${career.seasonEnded.titles.join(', ')}` : ''}</p>
        </div>
      )}
      <div className="card status">
        <div className="player-name">{user.name}{user.nickname ? <span className="nick"> “{user.nickname}”</span> : null}</div>
        <div className="pill">{statusText(career)}</div>
        <div className="status-grid">
          {career.status.qschool ? (
            <div><b>{career.qschoolPoints.user ?? 0} pts</b><span>Q-School</span></div>
          ) : user.tour === 'pro' ? (
            <div><b>#{rankOf(pros, 'user')}</b><span>Order of Merit</span></div>
          ) : (
            <div><b>#{rankOf(ct, 'user') ?? '—'}</b><span>Challenge Tour</span></div>
          )}
          <div><b>{money(user.tour === 'pro' ? proMoney(user, y) : user.ctMoney[y])}</b><span>{user.tour === 'pro' ? '2-year money' : 'CT money'}</span></div>
          <div><b>{money(seasonEarnings)}</b><span>This season</span></div>
          <div><b>{career.user.avg}</b><span>Your average</span></div>
        </div>
        <p className="goal">{goalText(career, pros)}</p>
      </div>

      {event && (
        <div className="card next-event">
          <div className="card-label">Next up · {MONTHS[event.month]}</div>
          <h2>{event.name}</h2>
          <div className="event-meta">{TIER_LABELS[event.tier]} · {event.size} players{prizeFund(event) ? ` · Prize fund ${money(prizeFund(event))}` : ''}</div>
          <div className="event-meta">{formatLabel(roundFormat(event, 0, career.settings.matchLength))} in round one</div>
          {career.active ? (
            <button className="btn primary big" onClick={onOpenEvent}>{userEntered ? 'Go to event' : 'Open event'}</button>
          ) : (
            <>
              <div className={`entry ${entry?.userIn || entry?.qualifierOpponent ? 'in' : 'out'}`}>
                {entry?.skip ? 'Not needed this year' : entry?.userIn ? `You're in: ${entry.reason}` : entry?.qualifierOpponent ? entry.reason : `Not entered: ${entry?.reason}`}
              </div>
              <button className="btn primary big" onClick={onContinue}>
                {entry?.userIn || entry?.qualifierOpponent ? 'Enter event' : 'Simulate to my next event'}
              </button>
            </>
          )}
        </div>
      )}

      {career.lastResult && (
        <div className="card">
          <div className="card-label">Last event</div>
          <p><b>{career.lastResult.eventName}</b>: {career.lastResult.text ?? 'Not entered'}{career.lastResult.prize ? ` · ${money(career.lastResult.prize)}` : ''}</p>
        </div>
      )}
    </div>
  )
}

function goalText(career, pros) {
  const user = career.players.user
  if (career.status.qschool) return 'Q-School: reach the final on any of the four days, or finish top 4 on the Q-School Order of Merit, to win a two-year Tour Card.'
  if (user.tour === 'challenge') return `Finish top ${CHALLENGE_CARDS} on the Challenge Tour Order of Merit to earn a Tour Card. Top ${CHALLENGE_CARDS} also go to the World Championship.`
  const r = rankOf(pros, 'user')
  if (career.status.cardExpiry === career.year) return `Your card is up at the end of this season: be inside the top ${TOUR_CARD_KEEP_RANK} (you're #${r}) to keep it.`
  return `Build your two-year prize money: you'll need to be top ${TOUR_CARD_KEEP_RANK} at the end of ${career.status.cardExpiry} to keep your card.`
}

function CalendarTab({ career }) {
  return (
    <div className="tab-body">
      <ul className="calendar">
        {career.calendar.map((e, i) => {
          const r = career.results[e.id]
          const done = i < career.eventIndex
          return (
            <li key={e.id} className={`${done ? 'done' : ''} ${i === career.eventIndex ? 'current' : ''} tier-${e.tier}`}>
              <span className="cal-month">{MONTHS[e.month].slice(0, 3)}</span>
              <span className="cal-name">{e.name}</span>
              <span className="cal-result">
                {r ? (r.user ? <b>{r.user}</b> : <span className="muted">{playerLabel(career, r.champion)}</span>) : done ? <span className="muted">—</span> : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RankingsTab({ career }) {
  const [which, setWhich] = useState(career.players.user.tour === 'pro' ? 'pro' : 'ct')
  const y = career.year
  const list = which === 'pro' ? proRanking(career) : challengeRanking(career)
  const userRank = rankOf(list, 'user')
  const shown = list.slice(0, 100)
  return (
    <div className="tab-body">
      <div className="btn-row tight">
        <button className={`btn small ${which === 'pro' ? 'primary' : ''}`} onClick={() => setWhich('pro')}>Order of Merit (2 years)</button>
        <button className={`btn small ${which === 'ct' ? 'primary' : ''}`} onClick={() => setWhich('ct')}>Challenge Tour {y}</button>
      </div>
      {userRank && userRank > 100 && <p className="muted">You are #{userRank}.</p>}
      <table className="rank-table">
        <tbody>
          {shown.map((id, i) => {
            const p = career.players[id]
            const cut = which === 'pro' ? i + 1 === TOUR_CARD_KEEP_RANK : i + 1 === CHALLENGE_CARDS
            return (
              <tr key={id} className={`${id === 'user' ? 'me' : ''} ${cut ? 'cutline' : ''}`}>
                <td>{i + 1}</td>
                <td>{playerLabel(career, id)}</td>
                <td className="num">{money(which === 'pro' ? proMoney(p, y) : p.ctMoney[y])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatsTab({ career }) {
  const s = career.stats
  const user = career.players.user
  const avg = threeDartAverage(s)
  const items = [
    ['Matches won', `${s.won} / ${s.played + s.simulated}`],
    ['Played on the oche', s.played],
    ['Career average', avg ? avg.toFixed(2) : '–'],
    ['Best match average', s.bestAvg || '–'],
    ['180s', s.s180],
    ['140+', s.s140],
    ['100+', s.s100],
    ['Highest checkout', s.highCheckout || '–'],
    ['Legs', `${s.legsWon} won · ${s.legsLost} lost`],
  ]
  return (
    <div className="tab-body">
      <div className="card">
        <div className="stats-grid">
          {items.map(([k, v]) => (
            <div key={k}><b>{v}</b><span>{k}</span></div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-label">Titles</div>
        {user.titles.length ? <ul className="plain">{user.titles.map((t, i) => <li key={i}>🏆 {t}</li>)}</ul> : <p className="muted">None yet.</p>}
      </div>
      {career.seasons.length > 0 && (
        <div className="card">
          <div className="card-label">Seasons</div>
          <ul className="plain">
            {career.seasons.map((x) => (
              <li key={x.year}><b>{x.year}</b> · {x.outcome} · {money(x.money)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NewsTab({ career }) {
  return (
    <div className="tab-body">
      <ul className="news">
        {career.news.slice(0, 80).map((n, i) => (
          <li key={i}><span className="muted">{MONTHS[n.month].slice(0, 3)} {n.year}</span> {n.text}</li>
        ))}
      </ul>
    </div>
  )
}

function SettingsTab({ career, update, onDelete }) {
  const set = (fn) => update(fn)
  return (
    <div className="tab-body">
      <div className="card form">
        <label>
          Difficulty
          <select value={career.user.difficulty} onChange={(e) => set((c) => { c.user.difficulty = e.target.value })}>
            {Object.entries(DIFFICULTIES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
          <small>{DIFFICULTIES[career.user.difficulty]?.blurb}</small>
        </label>
        <label>
          Match length
          <select value={career.settings.matchLength} onChange={(e) => set((c) => { c.settings.matchLength = e.target.value })}>
            {Object.entries(MATCH_LENGTHS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
        <label>
          Your 3-dart average
          <input type="number" min="15" max="120" step="0.5" value={career.user.avg} onChange={(e) => set((c) => { c.user.avg = Number(e.target.value) || c.user.avg })} />
          <small>Opponents are scaled to this.</small>
        </label>
        <label className="check">
          <input type="checkbox" checked={career.user.autoAdjust} onChange={(e) => set((c) => { c.user.autoAdjust = e.target.checked })} />
          Adjust my average automatically after each match
        </label>
        <label className="check">
          <input type="checkbox" checked={career.settings.caller} onChange={(e) => set((c) => { c.settings.caller = e.target.checked })} />
          Match caller (spoken scores)
        </label>
      </div>
      <button className="btn danger" onClick={onDelete}>Delete career</button>
    </div>
  )
}
