import { useState } from 'react'

const SLIDES = [
  ['🎯 Welcome to the Tour', 'You play real darts at your own board. Throw your three darts, enter your score, and your virtual opponent throws back on screen. Your career follows the real professional season, from Q-School in January to the World Championship in December.'],
  ['🎓 Q-School first', 'Without a Tour Card you start at Q-School (register from your inbox). Reach a Final Stage day’s final, or finish high on the Q-School Order of Merit, to win a two-year card. Miss out and you play the Challenge Tour, where the top two win cards.'],
  ['✉️ Your inbox runs your career', 'Confirm or withdraw from each event, answer Premier League invitations and sponsor offers, and read The Oche Times after every event. The calendar shows everything coming up and whether you’re in.'],
  ['🎤 Scoring at the board', 'Tap your score, use the quick buttons, or press “Say score” and just say it: “one hundred and forty”, “no score”, “bust”, “game shot”. You can also enter what you’ve got left. Undo fixes mistakes.'],
  ['🏆 Keep your card', 'Prize money builds your Order of Merit ranking. When your card expires you need to be inside the top 64. Set the opponent standard to suit you in Settings, simulate events when you can’t play, and back up your save from Settings.'],
]

export default function Tutorial({ onDone }) {
  const [i, setI] = useState(0)
  const [title, text] = SLIDES[i]
  const last = i === SLIDES.length - 1
  return (
    <div className="tutorial-backdrop">
      <div className="card tutorial">
        <div className="tut-dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="btn-row">
          {!last && <button className="btn ghost" onClick={onDone}>Skip</button>}
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn primary" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? "Let's go" : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
