import { useRef, useState } from 'react'
import Hub from './components/Hub.jsx'
import EventScreen from './components/EventScreen.jsx'
import MatchScreen from './components/MatchScreen.jsx'
import NewCareer from './components/NewCareer.jsx'
import { advance, finishEvent, newCareer, prepareLiveMatch, simulateUntilUserMatch, simulateUserMatch, submitUserResult } from './career/career.js'
import { loadCareer, saveCareer } from './persistence.js'

export default function App() {
  const [career, setCareer] = useState(loadCareer)
  const [screen, setScreen] = useState(() => {
    const c = loadCareer()
    return c?.active?.live?.match ? 'match' : c?.active ? 'event' : 'hub'
  })

  // Always build on the latest career, even if two updates land before a re-render.
  const latest = useRef(career)
  latest.current = career

  function update(fn) {
    const next = structuredClone(latest.current)
    fn(next)
    latest.current = next
    saveCareer(next)
    setCareer(next)
    return next
  }

  if (!career) {
    return (
      <NewCareer
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
        career={career}
        update={update}
        onExit={(result) => {
          if (result === 'pause') return setScreen('event')
          if (result === null) {
            update((c) => { c.active.live = null })
            return setScreen('event')
          }
          update((c) => {
            submitUserResult(c, result)
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

  return (
    <Hub
      career={career}
      update={update}
      onOpenEvent={() => setScreen('event')}
      onContinue={() => {
        const next = update((c) => {
          c.seasonEnded = null
          advance(c)
          if (c.active) simulateUntilUserMatch(c)
        })
        if (next.active) setScreen('event')
      }}
      onDelete={() => {
        if (!window.confirm('Delete this career? This cannot be undone.')) return
        saveCareer(null)
        setCareer(null)
        setScreen('hub')
      }}
    />
  )
}
