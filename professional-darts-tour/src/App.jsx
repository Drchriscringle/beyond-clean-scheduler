import { useRef, useState } from 'react'
import Hub from './components/Hub.jsx'
import EventScreen from './components/EventScreen.jsx'
import MatchScreen from './components/MatchScreen.jsx'
import NewCareer from './components/NewCareer.jsx'
import Practice from './components/Practice.jsx'
import { advance, autoPlayEvent, currentEvent, finishEvent, handleAction, newCareer, prepareLiveMatch, simulatePeriod, setEntry, simulateUntilUserMatch, simulateUserMatch, submitUserResult } from './career/career.js'
import { loadCareer, saveCareer } from './persistence.js'
import { defaultShirt } from './components/Shirt.jsx'

function liveSetup(career) {
  const live = career.active.live
  const user = career.players.user
  const opp = live.opponent.startsWith('T:') ? null : career.players[live.opponent]
  const team = live.oppPlayers?.map((id) => career.players[id].name)
  return {
    me: { name: user.name, nation: user.nation, nickname: user.nickname },
    opp: opp ? { name: opp.name, nickname: opp.nickname, nation: opp.nation } : { name: team.join(' & '), nation: live.opponent.slice(2) },
    oppNames: team,
    partner: live.partner ? { name: career.players[live.partner].name, avg: live.partnerAvg } : null,
    format: live.format,
    expectedAvg: live.expectedAvg,
    actualAvg: live.actualAvg,
    stage: live.stage,
    h2h: career.h2h[live.opponent],
    shirt: career.shirt ?? defaultShirt(career),
    sponsors: career.sponsors,
  }
}

export default function App() {
  const [career, setCareer] = useState(loadCareer)
  const [screen, setScreen] = useState(() => {
    const c = loadCareer()
    return c?.active?.live?.match ? 'match' : c?.active ? 'event' : 'hub'
  })
  const [practice, setPractice] = useState(null)
  const [simSummary, setSimSummary] = useState(null)
  const latest = useRef(career)
  latest.current = career

  // Always build on the latest career, even if two updates land before a re-render.
  function update(fn) {
    const next = structuredClone(latest.current)
    fn(next)
    latest.current = next
    saveCareer(next)
    setCareer(next)
    return next
  }

  function goNext(next) {
    setScreen(next.active ? 'event' : 'hub')
  }

  if (practice) {
    const p = practice
    if (p.playing) {
      return (
        <MatchScreen
          setup={{ me: { name: career?.players.user.name ?? 'You', nation: career?.players.user.nation }, opp: { name: 'Practice partner', nation: null, nickname: `${p.avg} average` }, format: p.format, expectedAvg: p.avg, actualAvg: p.avg, stage: 'Friendly' }}
          settings={{ caller: career?.settings.caller ?? true, trackDoubles: false }}
          onExit={() => setPractice(null)}
        />
      )
    }
    return (
      <div className="screen">
        <button className="btn ghost small back" onClick={() => setPractice(null)}>‹ Back</button>
        <Practice onPlay={(cfg) => setPractice({ ...cfg, playing: true })} />
      </div>
    )
  }

  if (!career) {
    return (
      <NewCareer
        onPractice={() => setPractice({})}
        onStart={(opts) => {
          const c = newCareer(opts)
          latest.current = c
          saveCareer(c)
          setCareer(c)
          setScreen('hub')
        }}
      />
    )
  }

  if (screen === 'match' && career.active?.live) {
    return (
      <MatchScreen
        key={career.active.live.stage + career.active.eventId}
        setup={liveSetup(career)}
        initialMatch={career.active.live.match}
        settings={{ caller: career.settings.caller, trackDoubles: career.user.trackDoubles && !career.active.live.partner }}
        onPersist={(match) => update((c) => { if (c.active?.live) c.active.live.match = match })}
        onExit={(result) => {
          if (result === 'pause') return setScreen('event')
          if (result === null) {
            update((c) => { c.active.live = null })
            return setScreen('event')
          }
          update((c) => {
            submitUserResult(c, { ...result, pairs: !!c.active.live?.partner })
            simulateUntilUserMatch(c)
          })
          setScreen('event')
        }}
      />
    )
  }

  if (screen === 'event' && career.active) {
    return (
      <EventScreen
        career={career}
        onBack={() => setScreen('hub')}
        onPlay={() => {
          if (!career.active.live) update((c) => { prepareLiveMatch(c) })
          setScreen('match')
        }}
        onSimMatch={() => update((c) => {
          c.active.live = null
          simulateUserMatch(c)
          simulateUntilUserMatch(c)
        })}
        onSimRest={() => update((c) => { simulateUntilUserMatch(c) })}
        onSimEvent={() => {
          update((c) => {
            c.seasonEnded = null
            autoPlayEvent(c)
          })
          setScreen('hub')
        }}
        onFinish={() => {
          update((c) => {
            c.seasonEnded = null
            finishEvent(c)
          })
          setScreen('hub')
        }}
      />
    )
  }

  const proceed = (c) => {
    advance(c)
    if (c.active) simulateUntilUserMatch(c)
  }

  return (
    <Hub
      career={career}
      update={update}
      onOpenEvent={() => setScreen('event')}
      simSummary={simSummary}
      onCloseSummary={() => setSimSummary(null)}
      onSimulate={(opts) => {
        let summary = null
        const next = update((c) => {
          c.seasonEnded = null
          summary = simulatePeriod(c, opts)
          if (c.active) simulateUntilUserMatch(c)
        })
        setSimSummary(summary)
        if (next.active) setScreen('event')
      }}
      onContinue={() => goNext(update((c) => { c.seasonEnded = null; proceed(c) }))}
      onAction={(mailId, action, payload) => {
        const next = update((c) => {
          handleAction(c, mailId, action, payload)
          const e = currentEvent(c)
          const decided = (action === 'confirmEntry' || action === 'withdrawEntry') && String(payload).split(',').includes(e?.id)
          if (decided || action === 'registerQschool' || action === 'skipQschool' || action === 'acceptPL' || action === 'declinePL') proceed(c)
        })
        if (next.active && ['confirmEntry', 'registerQschool', 'acceptPL'].includes(action)) setScreen('event')
      }}
      onEntry={(eventId, state, go = false) => {
        const next = update((c) => {
          setEntry(c, eventId, state)
          if (go) proceed(c)
        })
        if (go) goNext(next)
      }}
      onPractice={(cfg) => setPractice({ ...cfg, playing: true })}
      onDelete={() => {
        if (!window.confirm('Delete this career? This cannot be undone.')) return
        saveCareer(null)
        setCareer(null)
        setScreen('hub')
      }}
    />
  )
}

