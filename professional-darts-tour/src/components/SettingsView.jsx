import DifficultyPicker from './DifficultyPicker.jsx'
import { MATCH_LENGTHS } from '../career/formats.js'

export default function SettingsView({ career, update, onDelete }) {
  const d = career.user.difficulty
  const set = (fn) => update(fn)
  return (
    <div className="tab-body">
      <div className="card form">
        <div className="card-label">Opponent standard</div>
        <DifficultyPicker value={d} onChange={(v) => set((c) => { c.user.difficulty = v })} />
      </div>
      <div className="card form">
        <label>
          Match length
          <select value={career.settings.matchLength} onChange={(e) => set((c) => { c.settings.matchLength = e.target.value })}>
            {Object.entries(MATCH_LENGTHS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
        <label>
          Your 3-dart average (used when your matches are auto-simulated)
          <input type="number" min="15" max="120" step="0.5" value={career.user.avg} onChange={(e) => set((c) => { c.user.avg = Number(e.target.value) || c.user.avg })} />
        </label>
        <label className="check"><input type="checkbox" checked={career.user.autoAdjust} onChange={(e) => set((c) => { c.user.autoAdjust = e.target.checked })} /> Update my average from matches I play</label>
        <label className="check"><input type="checkbox" checked={career.user.trackDoubles} onChange={(e) => set((c) => { c.user.trackDoubles = e.target.checked })} /> Ask for darts at a double (checkout %)</label>
        <label className="check"><input type="checkbox" checked={career.settings.caller} onChange={(e) => set((c) => { c.settings.caller = e.target.checked })} /> Match caller (spoken scores)</label>
        <label className="check"><input type="checkbox" checked={career.settings.autoEnter} onChange={(e) => set((c) => { c.settings.autoEnter = e.target.checked })} /> Enter every event I qualify for automatically</label>
      </div>
      <button className="btn danger" onClick={onDelete}>Delete career</button>
    </div>
  )
}
