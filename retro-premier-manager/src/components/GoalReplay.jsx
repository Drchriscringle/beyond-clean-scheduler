import { useEffect } from 'react'

const REPLAY_DURATION_MS = 2600

// A stylised, Sensible-Soccer-style top-down replay: a handful of generic
// attacker/defender dots converge on goal while the scorer breaks away and
// the ball is struck home. It isn't a reconstruction of the actual passage
// of play - the match engine only tracks aggregate stats, not player
// positions - just a celebratory flourish for the moment a goal goes in.
export default function GoalReplay({ scorerName, clubName, minute, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, REPLAY_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="goal-replay-panel">
      <div className="goal-replay-pitch">
        <svg className="goal-replay-svg" viewBox="0 0 220 140" preserveAspectRatio="none">
          <rect x="0" y="0" width="220" height="140" fill="var(--green)" />
          <rect x="2" y="2" width="216" height="136" fill="none" stroke="var(--white)" strokeWidth="1.5" />
          <line x1="90" y1="2" x2="90" y2="138" stroke="var(--white)" strokeWidth="1.5" />
          <circle cx="90" cy="70" r="16" fill="none" stroke="var(--white)" strokeWidth="1.5" />
          <rect x="178" y="35" width="40" height="70" fill="none" stroke="var(--white)" strokeWidth="1.5" />
          <rect x="204" y="55" width="14" height="30" fill="none" stroke="var(--white)" strokeWidth="1.5" />
          <rect x="217" y="58" width="3" height="24" fill="var(--white)" opacity="0.85" />
        </svg>

        <div className="goal-replay-dot attacker attacker-1" />
        <div className="goal-replay-dot attacker attacker-2" />
        <div className="goal-replay-dot attacker attacker-3" />
        <div className="goal-replay-dot defender defender-1" />
        <div className="goal-replay-dot defender defender-2" />
        <div className="goal-replay-dot defender defender-3" />
        <div className="goal-replay-dot scorer" />
        <div className="goal-replay-ball" />

        <div className="goal-replay-caption">
          GOAL! {scorerName}
          <br />
          {clubName} — {minute}'
        </div>
      </div>
    </div>
  )
}
