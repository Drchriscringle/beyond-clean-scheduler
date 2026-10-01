import { DIFFICULTY_MODES, LEVEL_BANDS, rangeBands } from '../career/difficulty.js'

// value: { mode, fixedAvg, rangeMin, rangeMax }
export default function DifficultyPicker({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const b = rangeBands(value.rangeMin, value.rangeMax)
  return (
    <div className="difficulty">
      {Object.entries(DIFFICULTY_MODES).map(([k, label]) => (
        <label key={k} className="check">
          <input type="radio" name="difficulty-mode" checked={value.mode === k} onChange={() => set({ mode: k })} /> {label}
        </label>
      ))}
      {value.mode === 'range' && (
        <div className="range-box">
          <label>Lowest opponent average: <b>{value.rangeMin}</b>
            <input type="range" min="15" max="115" value={value.rangeMin} onChange={(e) => { const v = Number(e.target.value); set({ rangeMin: v, rangeMax: Math.max(v + 2, value.rangeMax) }) }} />
          </label>
          <label>Highest opponent average: <b>{value.rangeMax}</b>
            <input type="range" min="17" max="120" value={value.rangeMax} onChange={(e) => { const v = Number(e.target.value); set({ rangeMax: v, rangeMin: Math.min(v - 2, value.rangeMin) }) }} />
          </label>
          <small>Early rounds: {Math.round(b.early[0])}–{Math.round(b.early[1])}. Semi-finals and finals: {Math.round(b.late[0])}–{Math.round(b.late[1])}. Tip: set it around your own average so you can win, and nudge it up as you improve.</small>
        </div>
      )}
      {value.mode === 'fixed' && (
        <label>Opponent average: <b>{value.fixedAvg}</b><input type="range" min="15" max="120" value={value.fixedAvg} onChange={(e) => set({ fixedAvg: Number(e.target.value) })} /></label>
      )}
      {value.mode === 'progressive' && (
        <table className="band-table small-text"><thead><tr><th></th><th>Early rounds</th><th>Semis & final</th></tr></thead><tbody>
          {Object.values(LEVEL_BANDS).map((x) => <tr key={x.label}><td>{x.label}</td><td>{x.early.join('–')}</td><td>{x.late.join('–')}</td></tr>)}
        </tbody></table>
      )}
    </div>
  )
}
