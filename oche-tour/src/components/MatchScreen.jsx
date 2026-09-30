import { useEffect, useRef, useState } from 'react'
import Dartboard from './Dartboard.jsx'
import { playVisit, sigmaForAverage } from '../engine/bot.js'
import { checkoutRoute, minDartsToFinish } from '../engine/checkout.js'
import { applyVisit, createMatch, interpretEnteredScore, threeDartAverage } from '../engine/match.js'
import { formatLabel } from '../career/calendar.js'
import { NATION_FLAGS } from '../career/players.js'
import { callScore, numberWords, say } from '../caller.js'

const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180]
const DART_DELAY = 650

function bestLeg(stats) {
  return stats.legDarts.length ? Math.min(...stats.legDarts) : null
}

export default function MatchScreen({ career, update, onExit }) {
  const live = career.active.live
  const user = career.players.user
  const opp = career.players[live.opponent]
  const callerOn = career.settings.caller
  const [match, setMatch] = useState(live.match)
  const [entry, setEntry] = useState('')
  const [error, setError] = useState('')
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [botDarts, setBotDarts] = useState([])
  const [botThrowing, setBotThrowing] = useState(false)
  const [banner, setBanner] = useState('')
  const history = useRef([])
  const sigma = sigmaForAverage(live.actualAvg)

  // Persist every change so a refresh (or a phone call) resumes the match.
  useEffect(() => {
    if (match !== live.match) update((c) => { c.active.live.match = match })
  }, [match])

  // The virtual player's visit: throw dart by dart, then commit the visit.
  useEffect(() => {
    if (!match || match.winner !== null || match.turn !== 1) return
    const visit = playVisit(match.scores[1], sigma)
    const timers = []
    setBotThrowing(true)
    setBotDarts([])
    visit.darts.forEach((d, i) => {
      timers.push(setTimeout(() => setBotDarts((prev) => [...prev, d]), DART_DELAY * (i + 1)))
    })
    timers.push(
      setTimeout(() => {
        const next = applyVisit(match, { scored: visit.scored, bust: visit.bust, checkout: visit.checkout, dartsThrown: visit.darts.length, darts: visit.darts.map((d) => d.label) })
        if (visit.bust) say('Bust', callerOn)
        else if (visit.checkout) announceLegEnd(match, next, 1)
        else callScore(visit.scored, callerOn)
        if (!visit.checkout && next.scores[0] <= 170 && minDartsToFinish(next.scores[0])) {
          setTimeout(() => say(`${user.name.split(' ')[0]}, you require ${numberWords(next.scores[0])}`, callerOn), 1300)
        }
        setBotThrowing(false)
        setMatch(next)
      }, DART_DELAY * (visit.darts.length + 1) + 300),
    )
    return () => timers.forEach(clearTimeout)
  }, [match])

  function announceLegEnd(prev, next, player) {
    const name = player === 0 ? user.name : opp.name
    if (next.winner !== null) {
      setBanner(`Game shot and the match — ${name}!`)
      say(`Game shot, and the match, ${name}`, callerOn)
    } else {
      const setWon = !!next.format.sets && next.sets[0] + next.sets[1] > prev.sets[0] + prev.sets[1]
      setBanner(`Game shot and the ${setWon ? 'set' : 'leg'} — ${name}`)
      say(`Game shot, and the ${setWon ? 'set' : 'leg'}, ${name}`, callerOn)
      setTimeout(() => setBanner(''), 3000)
    }
  }

  function startMatch(startingPlayer) {
    const m = createMatch({ format: live.format, startingPlayer })
    say(`${live.stage}. ${startingPlayer === 0 ? user.name : opp.name} to throw first. Game on!`, callerOn)
    setMatch(m)
  }

  function submit(score, dartsUsed) {
    if (!match || match.turn !== 0 || match.winner !== null) return
    const remaining = match.scores[0]
    if (score === remaining && dartsUsed === undefined) {
      const res = interpretEnteredScore(remaining, score, 3)
      if (res.error) return flash(res.error)
      const min = minDartsToFinish(remaining)
      if (min === 3) return submit(score, 3)
      return setPendingCheckout({ score, min })
    }
    const res = interpretEnteredScore(remaining, score, dartsUsed ?? 3)
    if (res.error) return flash(res.error)
    history.current.push(match)
    const next = applyVisit(match, res)
    if (res.bust) say('Bust', callerOn)
    else if (res.checkout) announceLegEnd(match, next, 0)
    else callScore(res.scored, callerOn)
    setPendingCheckout(null)
    setEntry('')
    setError('')
    setMatch(next)
  }

  function bust() {
    if (!match || match.turn !== 0 || match.winner !== null) return
    history.current.push(match)
    say('Bust', callerOn)
    setEntry('')
    setMatch(applyVisit(match, { scored: 0, bust: true, checkout: false, dartsThrown: 3 }))
  }

  function flash(msg) {
    setError(msg)
    setTimeout(() => setError(''), 2500)
  }

  function undo() {
    if (botThrowing || !history.current.length) return
    setMatch(history.current.pop())
    setBotDarts([])
    setBanner('')
  }

  function finish() {
    const s = match.stats
    const result = {
      userWon: match.winner === 0,
      score: match.format.sets ? match.sets : match.legs,
      legs: [s[0].checkouts, s[1].checkouts],
      userAvg: threeDartAverage(s[0]),
      oppAvg: threeDartAverage(s[1]),
      userStats: s[0],
      simulated: false,
    }
    onExit(result)
  }

  function concede() {
    if (!window.confirm('Concede this match?')) return
    const s = match?.stats
    onExit({
      userWon: false,
      score: match ? (match.format.sets ? [match.sets[0], live.format.sets] : [match.legs[0], live.format.legs]) : [0, live.format.sets || live.format.legs],
      legs: match ? [s[0].checkouts, s[1].checkouts] : [0, 0],
      userAvg: match ? threeDartAverage(s[0]) : 0,
      oppAvg: match ? threeDartAverage(s[1]) : 0,
      userStats: s?.[0] ?? { darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, legDarts: [] },
      simulated: !match,
    })
  }

  if (!match) {
    return (
      <div className="screen match-pre">
        <div className="stage-tag">{live.stage}</div>
        <div className="versus">
          <div className="vs-player">
            <div className="vs-name">{user.name}</div>
            {user.nickname && <div className="vs-nick">“{user.nickname}”</div>}
            <div className="vs-meta">Your average ≈ {career.user.avg}</div>
          </div>
          <div className="vs-mid">VS</div>
          <div className="vs-player">
            <div className="vs-name">{NATION_FLAGS[opp.nation]} {opp.name}</div>
            <div className="vs-nick">“{opp.nickname}”</div>
            <div className="vs-meta">Expected average ≈ {live.expectedAvg}</div>
          </div>
        </div>
        <p className="format">{formatLabel(live.format)} · 501 double out</p>
        <p className="hint">Throw for the bull on your board, then pick who throws first.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => startMatch(0)}>I throw first</button>
          <button className="btn" onClick={() => startMatch(1)}>{opp.name.split(' ')[0]} throws first</button>
          <button className="btn ghost" onClick={() => startMatch(Math.random() < 0.5 ? 0 : 1)}>Random</button>
        </div>
        <button className="btn ghost small" onClick={() => onExit(null)}>Back</button>
      </div>
    )
  }

  const route = match.turn === 0 && match.scores[0] <= 170 ? checkoutRoute(match.scores[0]) : null
  const lastBot = match.lastVisit[1]

  return (
    <div className="screen match">
      <div className="match-head">
        <span>{live.stage}</span>
        <span>{formatLabel(match.format)}</span>
      </div>
      <div className="scoreboard">
        {[0, 1].map((p) => {
          const st = match.stats[p]
          const name = p === 0 ? user.name : opp.name
          return (
            <div key={p} className={`sb-side ${match.turn === p && match.winner === null ? 'active' : ''}`}>
              <div className="sb-name">
                {match.legStarter === p && <span className="throw-dot" title="Started this leg">●</span>} {name}
              </div>
              <div className="sb-rem">{match.scores[p]}</div>
              <div className="sb-legs">
                {match.format.sets ? <span>Sets {match.sets[p]} · </span> : null}
                Legs {match.legs[p]}
              </div>
              <div className="sb-stats">
                <span>Avg {threeDartAverage(st).toFixed(1)}</span>
                <span>Last {match.lastVisit[p] ? (match.lastVisit[p].bust ? 'BUST' : match.lastVisit[p].scored) : '–'}</span>
              </div>
              {p === 0 && route && <div className="sb-route">{route.join(' · ')}</div>}
            </div>
          )
        })}
      </div>

      {banner && <div className="banner">{banner}</div>}

      {match.winner !== null ? (
        <MatchSummary match={match} names={[user.name, opp.name]} onContinue={finish} />
      ) : (
        <>
          <div className="bot-area">
            <Dartboard darts={botDarts} size={210} />
            <div className="bot-readout">
              <div className="bot-label">{opp.name}</div>
              {botThrowing ? (
                <div className="bot-darts">{botDarts.map((d) => d.label).join(' · ') || 'Stepping up…'}</div>
              ) : lastBot ? (
                <div className="bot-darts">
                  {lastBot.darts?.join(' · ')} = <b>{lastBot.bust ? 'BUST' : lastBot.scored}</b>
                </div>
              ) : (
                <div className="bot-darts muted">Waiting</div>
              )}
            </div>
          </div>

          {match.turn === 0 && !pendingCheckout && (
            <div className="input-area">
              <div className="entry-display">
                <span className={entry ? '' : 'muted'}>{entry || 'Your score'}</span>
                {error && <span className="error">{error}</span>}
              </div>
              <div className="quick-row">
                {QUICK.map((q) => (
                  <button key={q} className="chip" onClick={() => submit(q)}>{q}</button>
                ))}
              </div>
              <div className="keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button key={n} className="key" onClick={() => setEntry((e) => (e + n).slice(0, 3))}>{n}</button>
                ))}
                <button className="key alt" onClick={() => setEntry((e) => e.slice(0, -1))}>⌫</button>
                <button className="key" onClick={() => setEntry((e) => (e + '0').slice(0, 3))}>0</button>
                <button className="key ok" onClick={() => submit(Number(entry || 0))}>{entry ? 'Enter' : 'No score'}</button>
              </div>
              <div className="btn-row tight">
                <button className="btn small" onClick={() => submit(match.scores[0])} disabled={!minDartsToFinish(match.scores[0])}>Checkout</button>
                <button className="btn small" onClick={bust}>Bust</button>
                <button className="btn small ghost" onClick={undo} disabled={!history.current.length}>Undo</button>
              </div>
            </div>
          )}
          {pendingCheckout && (
            <div className="input-area">
              <p className="hint">Checked out {pendingCheckout.score}! How many darts did you use?</p>
              <div className="btn-row">
                {[1, 2, 3].filter((d) => d >= pendingCheckout.min).map((d) => (
                  <button key={d} className="btn primary" onClick={() => submit(pendingCheckout.score, d)}>{d} dart{d > 1 ? 's' : ''}</button>
                ))}
                <button className="btn ghost" onClick={() => setPendingCheckout(null)}>Cancel</button>
              </div>
            </div>
          )}
          {match.turn === 1 && <div className="waiting">{opp.name.split(' ')[0]} is at the oche…</div>}
          <div className="btn-row tight footer-actions">
            <button className="btn ghost small" onClick={() => onExit('pause')}>Pause</button>
            <button className="btn ghost small danger" onClick={concede}>Concede</button>
          </div>
        </>
      )}
    </div>
  )
}

function MatchSummary({ match, names, onContinue }) {
  const s = match.stats
  const score = match.format.sets ? match.sets : match.legs
  const rows = [
    ['3-dart average', (i) => threeDartAverage(s[i]).toFixed(2)],
    ['180s', (i) => s[i].s180],
    ['140+', (i) => s[i].s140],
    ['100+', (i) => s[i].s100],
    ['Highest checkout', (i) => s[i].highCheckout || '–'],
    ['Best leg (darts)', (i) => bestLeg(s[i]) ?? '–'],
    ['Legs won', (i) => s[i].checkouts],
  ]
  return (
    <div className="summary">
      <h2>{match.winner === 0 ? 'You win!' : `${names[1]} wins`}</h2>
      <div className="final-score">{score[0]} – {score[1]}</div>
      <table className="stat-table">
        <thead>
          <tr><th>{names[0]}</th><th></th><th>{names[1]}</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}><td>{f(0)}</td><th>{label}</th><td>{f(1)}</td></tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary" onClick={onContinue}>Continue</button>
    </div>
  )
}
