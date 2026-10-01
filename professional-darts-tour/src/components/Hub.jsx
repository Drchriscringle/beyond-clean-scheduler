import { useState } from 'react'
import { COMPETITIONS } from '../career/data/competitions.js'
import { currentEvent } from '../career/career.js'
import { eligibility } from '../career/entry.js'
import { formatLabel, prizeFund, roundFormat } from '../career/formats.js'
import { unreadCount } from '../career/inbox.js'
import { flag } from '../career/players.js'
import { ranking, rankOf, rankingValue } from '../career/rankings.js'
import { dateLabel, KEY_LABELS, money, statusText, TIER_LABELS } from './common.jsx'
import Inbox from './Inbox.jsx'
import CalendarView from './CalendarView.jsx'
import Rankings from './Rankings.jsx'
import StatsView from './StatsView.jsx'
import MoneyView from './MoneyView.jsx'
import SettingsView from './SettingsView.jsx'
import Practice from './Practice.jsx'
import Tutorial from './Tutorial.jsx'
import Honours from './Honours.jsx'
import ShirtDesigner from './ShirtDesigner.jsx'
import { defaultShirt } from './Shirt.jsx'
import Face from './Face.jsx'
import FaceBuilder from './FaceBuilder.jsx'
import SimulatePanel, { SimSummary } from './SimulatePanel.jsx'
import { ACHIEVEMENTS } from '../career/achievements.js'
import PressConference from './PressConference.jsx'

const TABS = ['Home', 'Inbox', 'Calendar', 'Rankings', 'News', 'Honours', 'Stats', 'Money', 'Look', 'Practice', 'Settings']

export function eventStatus(career, e) {
  const state = career.entries[e.id]
  if (career.results[e.id]) return { label: career.results[e.id].user ?? 'Not entered', kind: career.results[e.id].user ? 'done' : 'muted' }
  if (career.active?.eventId === e.id) return { label: 'In progress', kind: 'in' }
  if (state === 'confirmed') return { label: 'Entered', kind: 'in' }
  if (state === 'withdrawn') return { label: 'Withdrawn', kind: 'muted' }
  if (state === 'pending') return { label: 'Confirm entry', kind: 'pending' }
  const el = eligibility(career, e)
  if (el.status === 'in') return { label: 'Qualified', kind: 'in' }
  if (el.status === 'qualifier') return { label: 'Qualifier available', kind: 'pending' }
  if (el.status === 'reserve') return { label: 'Reserve list', kind: 'muted' }
  if (el.status === 'skip') return { label: '—', kind: 'muted' }
  return { label: 'Not eligible', kind: 'muted' }
}

export default function Hub(props) {
  const { career } = props
  const [tab, setTab] = useState('Home')
  const [openMail, setOpenMail] = useState(null)
  const readMail = (id) => {
    setOpenMail(id)
    setTab('Inbox')
    props.update((c) => { const m = c.inbox.find((x) => x.id === id); if (m) m.read = true })
  }
  const unread = unreadCount(career)
  const [honoursView, setHonoursView] = useState('me')
  const fresh = (career.newAchievements ?? []).map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean)
  const clearFresh = () => props.update((c) => { c.newAchievements = [] })
  return (
    <div className="screen hub">
      <header className="hub-head">
        <div className="logo">PROFESSIONAL DARTS TOUR</div>
        <div className="season">{career.year} season</div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => { setOpenMail(null); setHonoursView('me'); setTab(t) }}>
            {t}{t === 'Inbox' && unread ? <span className="badge">{unread}</span> : null}
          </button>
        ))}
      </nav>
      {tab === 'Home' && <Home {...props} goTab={setTab} readMail={readMail} />}
      {tab === 'Inbox' && <Inbox key={openMail ?? 'list'} career={career} update={props.update} onAction={props.onAction} initialOpen={openMail} />}
      {tab === 'Calendar' && <CalendarView career={career} onEntry={props.onEntry} />}
      {tab === 'Rankings' && <Rankings career={career} />}
      {tab === 'News' && <News career={career} />}
      {tab === 'Stats' && <StatsView career={career} />}
      {tab === 'Money' && <MoneyView career={career} onAction={props.onAction} />}
      {tab === 'Honours' && <Honours key={honoursView} career={career} initialView={honoursView} />}
      {tab === 'Look' && <><div className="tab-body"><FaceBuilder career={career} update={props.update} /></div><ShirtDesigner career={career} update={props.update} /></>}
      {tab === 'Practice' && <Practice onPlay={props.onPractice} />}
      {tab === 'Settings' && <SettingsView career={career} update={props.update} onDelete={props.onDelete} onRestore={props.onRestore} />}
      {fresh.length > 0 && career.seenTutorial && (
        <div className="ach-toast" role="status">
          <button className="ach-toast-body" onClick={() => { setHonoursView('ach'); setTab('Honours'); clearFresh() }}>
            <span className="ach-icon">{fresh[0].icon}</span>
            <span><b>Achievement unlocked{fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}</b><br />{fresh[0].name}: {fresh[0].desc}</span>
          </button>
          <button className="ach-toast-x" aria-label="Dismiss" onClick={clearFresh}>✕</button>
        </div>
      )}
      <PressConference career={career} onAnswer={props.onPress} />
      {!career.seenTutorial && <Tutorial onDone={() => props.update((c) => { c.seenTutorial = true })} />}
    </div>
  )
}

function Home({ career, onContinue, onOpenEvent, onAction, onEntry, onSimulate, simSummary, onCloseSummary, goTab, readMail }) {
  const user = career.players.user
  const y = career.year
  const oom = ranking(career, 'oom')
  const event = currentEvent(career)
  const comp = event ? COMPETITIONS[event.key] : null
  const qsMail = career.inbox.find((m) => m.key === `qs-${y}` && !m.resolved)
  const plMail = career.inbox.find((m) => m.key === `pl-${y}` && !m.resolved)
  const needQs = event && (event.key === 'qsFirst' || event.key === 'qsFinal') && career.qschool.registered === null
  const needPl = event && event.key === 'premier' && career.pl.pending
  const pendingEntry = event && career.entries[event.id] === 'pending' && !career.active
  const upcoming = career.calendar.slice(career.eventIndex + 1, career.eventIndex + 7)

  return (
    <div className="tab-body">
      <SimSummary summary={simSummary} onClose={onCloseSummary} />
      {career.seasonEnded && (
        <div className="card review">
          <div className="card-label">Season {career.seasonEnded.year} review</div>
          <p>{career.seasonEnded.outcome}</p>
          <p className="muted">Earnings {money(career.seasonEnded.money)}{career.seasonEnded.titles.length ? ` · Titles: ${career.seasonEnded.titles.join(', ')}` : ''}</p>
        </div>
      )}
      <div className="card status">
        <div className="status-shirt" onClick={() => goTab('Look')} title="Change your look">
          <Face face={career.face} shirt={career.shirt ?? defaultShirt(career)} size={68} ring />
        </div>
        <div className="player-name">{flag(user.nation)} {user.name}{user.nickname ? <span className="nick"> “{user.nickname}”</span> : null}</div>
        <div className="pill">{statusText(career)}</div>
        <div className="status-grid">
          <div><b>{rankOf(oom, 'user') && (user.earn[y]?.ranked || user.earn[y - 1]?.ranked || user.tour === 'pro') ? `#${rankOf(oom, 'user')}` : '—'}</b><span>Order of Merit</span></div>
          {user.tour === 'pro'
            ? <div><b>{money(rankingValue(user, y, 'oom'))}</b><span>2-year ranking money</span></div>
            : <div><b>{user.earn[y]?.ct ? `#${rankOf(ranking(career, 'ct'), 'user')}` : '—'}</b><span>Challenge Tour</span></div>}
          <div><b>{money(career.finance.bank)}</b><span>Bank balance</span></div>
          <div><b>{career.user.avg}</b><span>Your average</span></div>
        </div>
        <p className="goal">{goalText(career)}</p>
      </div>

      {event && (
        <div className="card next-event">
          <div className="card-label">Next up · {dateLabel(event)} · {KEY_LABELS[event.key]}</div>
          <h2>{event.name}</h2>
          <div className="event-meta">{event.venue ?? ''}</div>
          <div className="event-meta">{TIER_LABELS[event.tier]}{prizeFund(event.key, career.prizeScale) ? ` · Prize fund ${money(prizeFund(event.key, career.prizeScale))}` : ''}</div>
          <div className="event-meta">{formatLabel(roundFormat(event, 0, career.settings.matchLength))} in round one</div>
          {career.active ? (
            <button className="btn primary big" onClick={onOpenEvent}>Go to event</button>
          ) : needQs ? (
            <>
              <div className="entry out">Q-School registration is open: decide before 5 January.</div>
              <div className="btn-row">{qsMail?.actions.map((act) => <button key={act.action} className={`btn ${act.action === 'registerQschool' ? 'primary' : ''}`} onClick={() => onAction(qsMail.id, act.action, act.payload)}>{act.label}</button>)}</div>
            </>
          ) : needPl ? (
            <>
              <div className="entry in">You've been invited to the Premier League.</div>
              <div className="btn-row">{plMail?.actions.map((act) => <button key={act.action} className={`btn ${act.action === 'acceptPL' ? 'primary' : ''}`} onClick={() => onAction(plMail.id, act.action, act.payload)}>{act.label}</button>)}</div>
            </>
          ) : pendingEntry ? (
            <>
              <div className="entry in">{eligibility(career, event).status === 'qualifier' ? `Qualifier: ${eligibility(career, event).reason}` : 'Entry confirmation needed.'}</div>
              <div className="btn-row">
                <button className="btn primary" onClick={() => onEntry(event.id, 'confirmed', true)}>Confirm & play</button>
                <button className="btn" onClick={() => onEntry(event.id, 'withdrawn', true)}>Withdraw</button>
              </div>
            </>
          ) : (
            <button className="btn primary big" onClick={onContinue}>Continue</button>
          )}
          {comp && <details><summary className="muted small-text">About this event</summary><p className="small-text">{comp.blurb}</p></details>}
        </div>
      )}

      {!career.active && <SimulatePanel career={career} onSimulate={onSimulate} />}

      {unreadCount(career) > 0 && (
        <button className="card inbox-teaser" onClick={() => goTab('Inbox')}>
          ✉️ {unreadCount(career)} unread email{unreadCount(career) > 1 ? 's' : ''}: <b>{career.inbox.find((m) => !m.read)?.subject}</b>
        </button>
      )}

      <div className="card">
        <div className="card-label">Coming up</div>
        <ul className="upcoming">
          {upcoming.map((e) => {
            const st = eventStatus(career, e)
            return (
              <li key={e.id}>
                <span className="muted">{dateLabel(e)}</span>
                <span>{e.name}</span>
                <span className={`tag ${st.kind}`}>{st.label}</span>
              </li>
            )
          })}
        </ul>
        <button className="btn ghost small" onClick={() => goTab('Calendar')}>Full calendar</button>
      </div>

      {career.rankSnapshot?.rows?.length > 0 && (
        <div className="card">
          <div className="card-label">Ranking update · after {career.rankSnapshot.eventName}</div>
          <table className="rank-update"><tbody>
            {career.rankSnapshot.rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label.replace(' Order of Merit', '')}</td>
                <td className="num"><b>#{r.pos}</b></td>
                <td className={`move ${r.move > 0 ? 'up' : r.move < 0 ? 'down' : ''}`}>{r.move ? (r.move > 0 ? `▲ ${r.move}` : `▼ ${-r.move}`) : r.prev ? '–' : 'new'}</td>
                <td className="num muted small-text">{r.gap ? `${money(r.gap)} to top ${r.target}` : r.pos <= r.target ? `top ${r.target} ✓` : ''}</td>
              </tr>
            ))}
          </tbody></table>
          <button className="btn ghost small" onClick={() => goTab('Rankings')}>Full rankings</button>
        </div>
      )}

      {career.lastResult && (
        <div className="card">
          <div className="card-label">Last event</div>
          <p><b>{career.lastResult.eventName}</b>: {career.lastResult.text ?? 'Not entered'}{career.lastResult.prize ? ` · ${money(career.lastResult.prize)}` : ''}</p>
          {(() => {
            const paper = career.inbox.find((m) => m.article)
            return paper && career.lastResult.text ? <button className="btn small" onClick={() => readMail(paper.id)}>📰 Read {paper.from}: “{paper.article.headline}”</button> : null
          })()}
        </div>
      )}
    </div>
  )
}

function goalText(career) {
  const user = career.players.user
  const qs = career.qschool
  if (qs.registered && !qs.done && user.tour !== 'pro') return qs.userStage === 'final' ? 'Q-School Final Stage: reach a day’s final, or finish high on the Q-School Order of Merit, for a two-year Tour Card.' : 'Q-School First Stage: reach the last 16 on any day (or finish top of the points list) to reach the Final Stage.'
  if (user.tour !== 'pro') return `Finish top 2 on the Challenge Tour${user.age <= 24 ? ' or Development Tour' : ''} Order of Merit to earn a Tour Card. Top 3 also go to the World Championship.`
  const r = rankOf(ranking(career, 'oom'), 'user')
  if (user.cardExpiry === career.year) return `Your card is up at the end of this season: be inside the top 64 (you're #${r}) to keep it.`
  return `Build your two-year prize money: you'll need to be top 64 at the end of ${user.cardExpiry} to keep your card.`
}

function News({ career }) {
  return (
    <div className="tab-body">
      <ul className="news">
        {career.news.slice(0, 150).map((n, i) => <li key={i}><span className="muted">{n.date}</span> {n.text}</li>)}
      </ul>
    </div>
  )
}
