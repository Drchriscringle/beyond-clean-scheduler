import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'
import Dartboard from './Dartboard.jsx'
import Shirt from './Shirt.jsx'
import { playVisit, sigmaForAverage } from '../engine/bot.js'
import { checkoutRoute, minDartsToFinish } from '../engine/checkout.js'
import { applyVisit, createMatch, interpretEnteredScore, pairsThrower, threeDartAverage } from '../engine/match.js'
import { formatLabel } from '../career/formats.js'
import { flag } from '../career/players.js'
import { callScore, numberWords, say } from '../caller.js'
import { applause, roar, startAmbience, stopAmbience } from '../crowd.js'
import { heard, listen, voiceAvailable } from '../voice.js'

const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180]
const DART_DELAY = 650
const DOUBLES = ['D20', 'D16', 'D8', 'D10', 'D18', 'D12', 'D4', 'D2', 'D1', 'D6', 'D14', 'D3', 'D5', 'D7', 'D9', 'D11', 'D13', 'D15', 'D17', 'D19', 'DB']

// Keep the screen on while you're at the board.
function useWakeLock() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      KeepAwake.keepAwake().catch(() => {})
      return () => { KeepAwake.allowSleep().catch(() => {}) }
    }
    let lock = null
    navigator.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [])
}

// setup: { me: {name, nation}, opp: {name, nickname, nation}, partner?: {name, avg}, oppNames?: [a, b],
//          format, expectedAvg, actualAvg, stage }
export default function MatchScreen({ setup, initialMatch, settings, onPersist, onExit }) {
  useWakeLock()
  const { me, opp, format } = setup
  const pairs = !!format.pairs
  const callerOn = settings.caller
  const [match, setMatch] = useState(initialMatch ?? null)
  const [entry, setEntry] = useState('')
  const [error, setError] = useState('')
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [atDouble, setAtDouble] = useState(0)
  const [aiDarts, setAiDarts] = useState([])
  const [aiThrowing, setAiThrowing] = useState(false)
  const [banner, setBanner] = useState('')
  const [celebration, setCelebration] = useState(null)
  const [walkOn, setWalkOn] = useState(null)
  const [entryMode, setEntryMode] = useState('score') // 'score' | 'left'
  const [listening, setListening] = useState(false)
  const [heardText, setHeardText] = useState('')
  const history = useRef([])
  const crowdOn = settings.crowd !== false

  // Background crowd for the whole match.
  useEffect(() => {
    if (crowdOn) startAmbience(setup.ambience ?? 'hall')
    return () => stopAmbience()
  }, [])

  function celebrate(text, big = false) {
    setCelebration({ text, big })
    setTimeout(() => setCelebration(null), big ? 4500 : 1800)
  }

  // Crowd and on-screen reaction to a visit. side 0 = you (or your team).
  function react(prev, next, side, scored, checkout) {
    if (!crowdOn && side !== 0) return
    const mine = side === 0
    if (checkout) {
      const legDarts = next.stats[side].legDarts.at(-1)
      if (mine && legDarts === 9) {
        celebrate('NINE-DART FINISH!', true)
        if (crowdOn) roar(1, 6)
        say('Nine darts! Perfection!', callerOn)
      } else if (scored === 170) {
        if (mine) celebrate('THE BIG FISH! 170', true)
        if (crowdOn) roar(0.95, 4)
      } else if (scored >= 100) {
        if (mine) celebrate(`TON-PLUS FINISH: ${scored}`)
        if (crowdOn) roar(0.7, 3)
      } else if (crowdOn) applause(next.winner !== null ? 3.5 : 2)
      if (next.winner !== null && crowdOn) roar(0.85, 4.5)
      return
    }
    if (scored === 180) {
      if (mine) celebrate('180!')
      if (crowdOn) roar(0.85, 3)
    } else if (scored >= 140 && crowdOn) roar(0.4, 1.8)
  }
  const oppSigma = sigmaForAverage(setup.actualAvg)
  const partnerSigma = setup.partner ? sigmaForAverage(setup.partner.avg) : null

  useEffect(() => {
    if (match && match !== initialMatch) onPersist?.(match)
  }, [match])

  // Whose darts are these? Side 1 is always virtual; in pairs, side 0 alternates you / your partner.
  const aiTurn = match && match.winner === null && (match.turn === 1 || (pairs && pairsThrower(match, 0) === 1))
  const throwerName = !match ? '' : match.turn === 1 ? (pairs ? setup.oppNames[pairsThrower(match, 1)] : opp.name) : pairs && pairsThrower(match, 0) === 1 ? setup.partner.name : me.name

  useEffect(() => {
    if (!aiTurn) return
    const side = match.turn
    const sigma = side === 1 ? oppSigma : partnerSigma
    const visit = playVisit(match.scores[side], sigma, Math.random, { needIn: !!format.doubleIn && !match.opened[side] })
    const timers = []
    setAiThrowing(true)
    setAiDarts([])
    visit.darts.forEach((d, i) => timers.push(setTimeout(() => setAiDarts((prev) => [...prev, d]), DART_DELAY * (i + 1))))
    timers.push(setTimeout(() => {
      const next = applyVisit(match, { scored: visit.scored, bust: visit.bust, checkout: visit.checkout, dartsThrown: visit.darts.length, darts: visit.darts.map((d) => d.label), thrower: pairs ? pairsThrower(match, side) : 0 })
      if (visit.bust) say('Bust', callerOn)
      else if (visit.checkout) announceLegEnd(match, next, side)
      else callScore(visit.scored, callerOn)
      react(match, next, side, visit.scored, visit.checkout)
      const mine = next.winner === null && next.turn === 0 && !(pairs && pairsThrower(next, 0) === 1)
      if (mine && !visit.checkout && next.scores[0] <= 170 && minDartsToFinish(next.scores[0])) {
        setTimeout(() => say(`${me.name.split(' ')[0]}, you require ${numberWords(next.scores[0])}`, callerOn), 1300)
      }
      setAiThrowing(false)
      setMatch(next)
    }, DART_DELAY * (visit.darts.length + 1) + 300))
    return () => timers.forEach(clearTimeout)
  }, [match])

  function announceLegEnd(prev, next, side) {
    const name = side === 0 ? (pairs ? 'your team' : me.name) : opp.name
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

  function requestStart(startingPlayer) {
    if (settings.walkOns !== false && setup.walkOnShow) {
      setWalkOn({ startingPlayer })
      if (crowdOn) roar(0.55, 6)
      const song = setup.walkOnSong ? `, walking on to ${setup.walkOnSong},` : ''
      say(`Ladies and gentlemen, welcome to the ${setup.eventName ?? setup.stage}. It's the ${setup.stage.replace(/,.*/, '')}. Walking on first${song} ${me.nickname ? `it's ${me.nickname}, ` : ''}${me.name}! And the opponent, ${opp.nickname ? `${opp.nickname}, ` : ''}${opp.name}!`, callerOn)
      return
    }
    startMatch(startingPlayer)
  }

  function startMatch(startingPlayer) {
    setWalkOn(null)
    say(`${setup.stage}. ${startingPlayer === 0 ? me.name : opp.name} to throw first. Game on!`, callerOn)
    setMatch(createMatch({ format, startingPlayer }))
  }

  const myTurnNow = match && !aiTurn && match.winner === null && match.turn === 0 && !pendingCheckout

  async function voice() {
    if (listening) return
    setListening(true)
    setHeardText('')
    try {
      const h = heard(await listen())
      if (!h) {
        flash("Didn't catch a score. Try again or use the keypad.")
        return
      }
      setHeardText(`Heard: “${h.text}”`)
      if (h.bust) bust()
      else if (h.checkout) submit(match.scores[0])
      else submit(h.score)
    } catch (e) {
      flash(e.message)
    } finally {
      setListening(false)
    }
  }

  // Hands-free: start listening shortly after your turn begins (once the caller has spoken).
  useEffect(() => {
    if (!settings.voice || !myTurnNow) return
    const t = setTimeout(() => voice(), 1800)
    return () => clearTimeout(t)
  }, [settings.voice, myTurnNow, match?.visits.length, match?.legNumber])

  function typed(value) {
    if (entryMode === 'left') {
      const left = Number(value || 0)
      if (left >= match.scores[0]) return flash('That leaves more than you had')
      return submit(match.scores[0] - left)
    }
    submit(Number(value || 0))
  }

  const canTrack = settings.trackDoubles && match && match.scores[0] <= 170 && !!minDartsToFinish(match.scores[0])

  function submit(score, dartsUsed, double) {
    if (!match || aiTurn || match.winner !== null) return
    const remaining = match.scores[0]
    if (score === remaining && dartsUsed === undefined) {
      const res = interpretEnteredScore(remaining, score, 3)
      if (res.error) return flash(res.error)
      const route = checkoutRoute(remaining)
      return setPendingCheckout({ score, min: minDartsToFinish(remaining), darts: null, double: route ? route[route.length - 1] : 'D20' })
    }
    const res = interpretEnteredScore(remaining, score, dartsUsed ?? 3)
    if (res.error) return flash(res.error)
    history.current.push(match)
    const tracked = canTrack ? (res.checkout ? Math.max(1, atDouble) : atDouble) : 0
    const next = applyVisit(match, { ...res, double, dartsAtDouble: tracked })
    if (res.bust) say('Bust', callerOn)
    else if (res.checkout) announceLegEnd(match, next, 0)
    else callScore(res.scored, callerOn)
    react(match, next, 0, res.scored, res.checkout)
    setPendingCheckout(null)
    setEntry('')
    setError('')
    setAtDouble(0)
    setMatch(next)
  }

  function bust() {
    if (!match || aiTurn || match.winner !== null) return
    history.current.push(match)
    say('Bust', callerOn)
    setEntry('')
    setMatch(applyVisit(match, { scored: 0, bust: true, checkout: false, dartsThrown: 3, dartsAtDouble: canTrack ? atDouble : 0 }))
    setAtDouble(0)
  }

  function flash(msg) {
    setError(msg)
    setTimeout(() => setError(''), 2500)
  }

  function undo() {
    if (aiThrowing || !history.current.length) return
    setMatch(history.current.pop())
    setAiDarts([])
    setBanner('')
  }

  function result(conceded = false) {
    const s = match?.stats
    const legs = s ? [s[0].checkouts, s[1].checkouts] : [0, 0]
    return {
      userWon: !conceded && match.winner === 0,
      score: conceded ? (format.sets ? [match?.sets[0] ?? 0, format.sets] : [match?.legs[0] ?? 0, format.legs]) : format.sets ? match.sets : match.legs,
      legs,
      userAvg: s ? threeDartAverage(s[0]) : 0,
      oppAvg: s ? threeDartAverage(s[1]) : 0,
      userStats: s?.[0] ?? { darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, legDarts: [], dartsAtDouble: 0, doubles: {} },
      simulated: !match,
    }
  }

  function concede() {
    if (!window.confirm('Concede this match?')) return
    onExit(result(true))
  }

  if (!match && walkOn) {
    return (
      <div className="screen walk-on" onClick={() => startMatch(walkOn.startingPlayer)}>
        <div className="spot spot-a" /><div className="spot spot-b" />
        <div className="walk-stage">{setup.eventName ? `${setup.eventName} · ` : ''}{setup.stage}</div>
        {setup.shirt && <Shirt shirt={setup.shirt} sponsors={setup.sponsors} nation={me.nation} side="back" size={170} />}
        <div className="walk-name">{me.name}</div>
        {me.nickname && <div className="walk-nick">“{me.nickname}”</div>}
        {setup.walkOnSong && <div className="walk-song">♪ {setup.walkOnSong} ♪</div>}
        <div className="walk-vs">v {opp.name}{opp.nickname ? ` “${opp.nickname}”` : ''}</div>
        <button className="btn primary big" onClick={(e) => { e.stopPropagation(); startMatch(walkOn.startingPlayer) }}>Game on!</button>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="screen match-pre">
        <div className="stage-tag">{setup.stage}</div>
        <div className="versus">
          <div className="vs-player">
            {setup.shirt && <Shirt shirt={setup.shirt} sponsors={setup.sponsors} nation={me.nation} side="front" size={70} />}
            <div className="vs-name">{flag(me.nation)} {me.name}</div>
            {setup.partner && <div className="vs-nick">with {setup.partner.name}</div>}
            {me.nickname && <div className="vs-nick">“{me.nickname}”</div>}
          </div>
          <div className="vs-mid">VS</div>
          <div className="vs-player">
            <div className="vs-name">{flag(opp.nation)} {opp.name}</div>
            {opp.nickname && <div className="vs-nick">“{opp.nickname}”</div>}
            <div className="vs-meta">Expected average ≈ {setup.expectedAvg}</div>
            {setup.h2h && <div className="vs-meta">Head to head: {setup.h2h.w}–{setup.h2h.l}</div>}
          </div>
        </div>
        <p className="format">{formatLabel(format)} · 501 {format.doubleIn ? 'double in, ' : ''}double out</p>
        {format.doubleIn && <p className="hint">Double in: your score only starts counting from the first double you hit each leg.</p>}
        {pairs && <p className="hint">Pairs: you and {setup.partner.name} take alternate visits for your team.</p>}
        <p className="hint">Throw for the bull on your board, then pick who throws first.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => requestStart(0)}>{pairs ? 'We throw first' : 'I throw first'}</button>
          <button className="btn" onClick={() => requestStart(1)}>{opp.name.split(' ')[0]} throw{pairs ? '' : 's'} first</button>
          <button className="btn ghost" onClick={() => requestStart(Math.random() < 0.5 ? 0 : 1)}>Random</button>
        </div>
        <button className="btn ghost small" onClick={() => onExit(null)}>Back</button>
      </div>
    )
  }

  const myTurn = !aiTurn && match.winner === null && match.turn === 0
  const route = myTurn && match.scores[0] <= 170 && (!format.doubleIn || match.opened[0]) ? checkoutRoute(match.scores[0]) : null
  const last = match.visits.at(-1)

  return (
    <div className="screen match">
      <div className="match-head">
        <span>{setup.stage}</span>
        <span>{formatLabel(match.format)}</span>
      </div>
      <div className="scoreboard">
        {[0, 1].map((p) => {
          const st = match.stats[p]
          const name = p === 0 ? (pairs ? `${me.name.split(' ')[0]} & ${setup.partner.name.split(' ')[0]}` : me.name) : opp.name
          return (
            <div key={p} className={`sb-side ${match.turn === p && match.winner === null ? 'active' : ''}`}>
              <div className="sb-name">
                {match.legStarter === p && <span className="throw-dot" title="Started this leg">●</span>} {name}
              </div>
              <div className="sb-rem">{match.scores[p]}</div>
              <div className="sb-legs">
                {match.format.sets ? <span>Sets {match.sets[p]} · </span> : null}
                Legs {match.legs[p]}
                {format.doubleIn && !match.opened[p] ? <span className="muted"> · not in</span> : null}
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
      {celebration && <div className={`celebration ${celebration.big ? 'big' : ''}`}>{celebration.text}</div>}

      {match.winner !== null ? (
        <MatchSummary match={match} names={[pairs ? 'Your team' : me.name, opp.name]} onContinue={() => onExit(result())} />
      ) : (
        <>
          <div className="bot-area">
            <Dartboard darts={aiDarts} size={210} />
            <div className="bot-readout">
              <div className="bot-label">{aiThrowing ? throwerName : last && (last.player === 1 || last.thrower === 1) ? (last.player === 1 ? (pairs ? setup.oppNames[last.thrower] : opp.name) : setup.partner?.name) : 'Virtual thrower'}</div>
              {aiThrowing ? (
                <div className="bot-darts">{aiDarts.map((d) => d.label).join(' · ') || 'Stepping up…'}</div>
              ) : last?.darts ? (
                <div className="bot-darts">{last.darts.join(' · ')} = <b>{last.bust ? 'BUST' : last.scored}</b></div>
              ) : (
                <div className="bot-darts muted">Waiting</div>
              )}
            </div>
          </div>

          {myTurn && !pendingCheckout && (
            <div className="input-area">
              <div className="entry-tools">
                <div className="seg">
                  <button className={`chip small ${entryMode === 'score' ? 'on' : ''}`} onClick={() => setEntryMode('score')}>Score</button>
                  <button className={`chip small ${entryMode === 'left' ? 'on' : ''}`} onClick={() => setEntryMode('left')}>What's left</button>
                </div>
                {voiceAvailable() && <button className={`btn small mic ${listening ? 'live' : ''}`} onClick={voice}>{listening ? '🎙 Listening…' : '🎤 Say score'}</button>}
              </div>
              <div className="entry-display">
                <span className={entry ? '' : 'muted'}>{entry || (entryMode === 'left' ? `Left from ${match.scores[0]}` : 'Your score')}</span>
                {error ? <span className="error">{error}</span> : heardText ? <span className="muted small-text">{heardText}</span> : null}
              </div>
              {canTrack && (
                <div className="at-double">
                  <span>Darts at a double:</span>
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} className={`chip small ${atDouble === n ? 'on' : ''}`} onClick={() => setAtDouble(n)}>{n}</button>
                  ))}
                </div>
              )}
              <div className="quick-row">
                {entryMode === 'score' && QUICK.map((q) => (
                  <button key={q} className="chip" onClick={() => submit(q)}>{q}</button>
                ))}
              </div>
              <div className={`keypad ${settings.bigKeys ? 'big' : ''} ${settings.leftHanded ? 'lefty' : ''}`}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button key={n} className="key" onClick={() => setEntry((e) => (e + n).slice(0, 3))}>{n}</button>
                ))}
                {(() => {
                  const del = <button key="del" className="key alt" onClick={() => setEntry((e) => e.slice(0, -1))}>⌫</button>
                  const zero = <button key="zero" className="key" onClick={() => setEntry((e) => (e + '0').slice(0, 3))}>0</button>
                  const ok = <button key="ok" className="key ok" onClick={() => typed(entry)}>{entry ? 'Enter' : entryMode === 'left' ? 'Checkout' : 'No score'}</button>
                  return settings.leftHanded ? [ok, zero, del] : [del, zero, ok]
                })()}
              </div>
              <div className={`btn-row tight ${settings.leftHanded ? '' : 'righty'}`}>
                <button className="btn small" onClick={() => submit(match.scores[0])} disabled={!minDartsToFinish(match.scores[0])}>Checkout</button>
                <button className="btn small" onClick={bust}>Bust</button>
                <button className="btn small ghost" onClick={undo} disabled={!history.current.length}>Undo</button>
              </div>
            </div>
          )}
          {pendingCheckout && (
            <div className="input-area">
              <p className="hint">Checked out {pendingCheckout.score}! Which double, and how many darts?</p>
              <div className="doubles-grid">
                {DOUBLES.map((d) => (
                  <button key={d} className={`chip small ${pendingCheckout.double === d ? 'on' : ''}`} onClick={() => setPendingCheckout({ ...pendingCheckout, double: d })}>{d === 'DB' ? 'Bull' : d}</button>
                ))}
              </div>
              <div className="btn-row">
                {[1, 2, 3].filter((d) => d >= pendingCheckout.min).map((d) => (
                  <button key={d} className="btn primary" onClick={() => submit(pendingCheckout.score, d, pendingCheckout.double)}>{d} dart{d > 1 ? 's' : ''}</button>
                ))}
                <button className="btn ghost" onClick={() => setPendingCheckout(null)}>Cancel</button>
              </div>
            </div>
          )}
          {aiTurn && <div className="waiting">{throwerName} is at the oche…</div>}
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
  const best = (st) => (st.legDarts.length ? Math.min(...st.legDarts) : '–')
  const rows = [
    ['3-dart average', (i) => threeDartAverage(s[i]).toFixed(2)],
    ['180s', (i) => s[i].s180],
    ['140+', (i) => s[i].s140],
    ['100+', (i) => s[i].s100],
    ['Highest checkout', (i) => s[i].highCheckout || '–'],
    ['Best leg (darts)', (i) => best(s[i])],
    ['Legs won', (i) => s[i].checkouts],
  ]
  if (s[0].dartsAtDouble) rows.push(['Checkout %', (i) => (i === 0 ? `${Math.round((s[0].checkouts / s[0].dartsAtDouble) * 100)}%` : '–')])
  return (
    <div className="summary">
      <h2>{match.winner === 0 ? 'You win!' : `${names[1]} wins`}</h2>
      <div className="final-score">{score[0]} – {score[1]}</div>
      <table className="stat-table">
        <thead><tr><th>{names[0]}</th><th></th><th>{names[1]}</th></tr></thead>
        <tbody>{rows.map(([label, f]) => <tr key={label}><td>{f(0)}</td><th>{label}</th><td>{f(1)}</td></tr>)}</tbody>
      </table>
      <button className="btn primary" onClick={onContinue}>Continue</button>
    </div>
  )
}
