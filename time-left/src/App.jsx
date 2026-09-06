import { useEffect, useMemo, useState } from 'react'
import SetupPanel from './components/SetupPanel.jsx'
import Clock from './components/Clock.jsx'
import Progress from './components/Progress.jsx'
import CounterGrid from './components/CounterGrid.jsx'
import WeekGrid from './components/WeekGrid.jsx'
import Milestones from './components/Milestones.jsx'
import { buildCounters, buildLivedCounters, buildMilestones } from './lib/counters.js'
import { daysBetween, exactAge } from './lib/dates.js'
import { MODES, estimate, factorAdjustment, lifeLivedFraction } from './lib/lifespan.js'
import { formatAge, formatCount, formatLongDate, formatYears } from './lib/format.js'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resolveInputs,
  saveSettings,
  todayISO,
} from './lib/settings.js'

const TICK_MS = 100

export default function App() {
  const storage = typeof window === 'undefined' ? null : window.localStorage
  const [settings, setSettings] = useState(() => loadSettings(storage))
  const [showFactors, setShowFactors] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    saveSettings(storage, settings)
  }, [storage, settings])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const factors = useMemo(() => factorAdjustment(settings.factors), [settings.factors])

  // The clock re-renders ten times a second; only the countdown itself may
  // depend on `now`. Everything counted in days or longer hangs off the date,
  // so the life table is solved once a day rather than ten times a second.
  const dayKey = now.toDateString()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inputs = useMemo(() => resolveInputs(settings, now), [settings, dayKey])
  const result = useMemo(() => {
    if (!inputs.ok) return null
    return estimate({
      birth: inputs.birth,
      now,
      lifeExpectancyAtBirth: inputs.lifeExpectancyAtBirth,
      mode: settings.mode,
      factorYears: factors.years,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.ok, inputs.birth, inputs.lifeExpectancyAtBirth, settings.mode, factors.years, dayKey])

  // The same sum worked the other way, so the page can offer a second opinion
  // when the two readings disagree by enough to matter.
  const otherMode = settings.mode === 'simple' ? 'survival' : 'simple'
  const alternative = useMemo(() => {
    if (!inputs.ok) return null
    return estimate({
      birth: inputs.birth,
      now,
      lifeExpectancyAtBirth: inputs.lifeExpectancyAtBirth,
      mode: otherMode,
      factorYears: factors.years,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.ok, inputs.birth, inputs.lifeExpectancyAtBirth, otherMode, factors.years, dayKey])

  const derived = useMemo(() => {
    if (!result || !inputs.ok) return null
    const reference = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return {
      age: exactAge(inputs.birth, reference),
      counters: buildCounters({
        now: reference,
        endDate: result.endDate,
        birth: inputs.birth,
        hemisphere: inputs.hemisphere,
      }),
      lived: buildLivedCounters({
        birth: inputs.birth,
        now: reference,
        hemisphere: inputs.hemisphere,
      }),
      milestones: buildMilestones({
        birth: inputs.birth,
        now: reference,
        endDate: result.endDate,
      }),
      weeksLived: Math.floor(daysBetween(inputs.birth, reference) / 7),
      weeksTotal: Math.round((result.expectancyYears * 365.2425) / 7),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, inputs.ok, inputs.birth, inputs.hemisphere, dayKey])

  return (
    <div className="app">
      <header className="masthead">
        <h1>Time Left</h1>
        <p>
          Your age, and where you live, turned into the one number nobody prints on a birthday
          card.
        </p>
      </header>

      <SetupPanel
        settings={settings}
        onChange={setSettings}
        showFactors={showFactors}
        onToggleFactors={() => setShowFactors((open) => !open)}
        factorYears={factors.years}
        error={inputs.error}
        today={todayISO()}
        onReset={() => setSettings({ ...DEFAULT_SETTINGS })}
      />

      {!result || !derived ? (
        <section className="panel">
          <h2 className="panel-title">Waiting on you</h2>
          <p className="panel-note" style={{ margin: 0 }}>
            Put in your date of birth and where you live, and the clock starts.
          </p>
        </section>
      ) : (
        <>
          {result.overdue ? (
            <Clock from={result.endDateFromBirth} to={now} counting="up">
              You are <strong>{formatAge(derived.age)}</strong> old, which is already past the{' '}
              {formatYears(result.baseExpectancy)} the averages gave you in {inputs.placeLabel}.
              That clock counts up. On the other reckoning — the one that accounts for having got
              this far — you have about <strong>{formatYears(result.remainingYears)}</strong> in
              front of you, and everything below is counted from that.
            </Clock>
          ) : (
            <Clock from={now} to={result.endDate}>
              You are <strong>{formatAge(derived.age)}</strong> old. In {inputs.placeLabel} the
              figure is <strong>{formatYears(inputs.lifeExpectancyAtBirth)}</strong>
              {factors.years !== 0 ? `, and your answers move it by ${factors.years > 0 ? '+' : ''}${Math.round(factors.years * 10) / 10} years` : ''}
              , which puts the estimate on <strong>{formatLongDate(result.endDate)}</strong>.
              {alternative && Math.abs(alternative.remainingYears - result.remainingYears) > 2 ? (
                <span className="clock-alt">
                  Worked out the other way it comes to{' '}
                  {formatYears(alternative.remainingYears)}.{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setSettings({ ...settings, mode: otherMode })}
                  >
                    Try {MODES.find((entry) => entry.id === otherMode).label.toLowerCase()}
                  </button>
                </span>
              ) : null}
            </Clock>
          )}

          <Progress
            fraction={lifeLivedFraction(result)}
            age={result.age}
            expectancyYears={result.expectancyYears}
            endDate={result.endDate}
            survivorsShare={result.survivorsShare}
          />

          <CounterGrid groups={derived.counters} />

          <WeekGrid weeksLived={derived.weeksLived} weeksTotal={derived.weeksTotal} />

          <Milestones milestones={derived.milestones} />

          <section className="panel">
            <h2 className="panel-title">Already behind you</h2>
            <p className="panel-note">The same counting, run the other way.</p>
            <div className="lived-grid">
              {derived.lived.map((item) => (
                <div className="counter" key={item.id}>
                  <div className="counter-value">{formatCount(item.value)}</div>
                  <div className="counter-label">{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <footer className="footer">
        <p>
          <strong>This is an average, not a prophecy.</strong> Life expectancy describes what
          happened to a whole population, and half of that population lived longer than the number.
          Nothing here knows anything about your health, and none of it is medical advice.
        </p>
        <p>
          Figures for countries are approximate recent estimates; UK nations come from ONS national
          life tables and US states from CDC/NCHS. {inputs.ok ? `Source for ${inputs.placeLabel}: ${inputs.source}.` : ''}
        </p>
        <p>
          If the clock lands badly, that is worth taking seriously — talk to someone you trust. In
          the UK you can call Samaritans free on 116 123, any time; in the US, call or text 988.
        </p>
      </footer>
    </div>
  )
}
