import DifficultyPicker from './DifficultyPicker.jsx'
import BackupPanel from './BackupPanel.jsx'
import { MATCH_LENGTHS } from '../career/formats.js'

export default function SettingsView({ career, update, onDelete, onRestore }) {
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
      <div className="card form">
        <div className="card-label">You</div>
        <label>Nickname<input value={career.players.user.nickname} maxLength={28} onChange={(e) => set((c) => { c.players.user.nickname = e.target.value })} /></label>
        <label>Walk-on song (shown and announced at TV events)<input value={career.players.user.walkOn ?? ''} maxLength={40} placeholder="e.g. Chase the Sun" onChange={(e) => set((c) => { c.players.user.walkOn = e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={career.players.user.gender === 'f'} onChange={(e) => set((c) => { c.players.user.gender = e.target.checked ? 'f' : 'm'; c.moneyStamp = (c.moneyStamp ?? 0) + 1 })} /> I'm eligible for the PDC Women's Series</label>
      </div>
      <div className="card form">
        <div className="card-label">At the board</div>
        <label className="check"><input type="checkbox" checked={!!career.settings.voice} onChange={(e) => set((c) => { c.settings.voice = e.target.checked })} /> Hands-free voice scoring (listens automatically on your turn)</label>
        <label className="check"><input type="checkbox" checked={!!career.settings.bigKeys} onChange={(e) => set((c) => { c.settings.bigKeys = e.target.checked })} /> Big keypad</label>
        <label className="check"><input type="checkbox" checked={!!career.settings.leftHanded} onChange={(e) => set((c) => { c.settings.leftHanded = e.target.checked })} /> Left-handed layout</label>
        <label className="check"><input type="checkbox" checked={career.settings.crowd !== false} onChange={(e) => set((c) => { c.settings.crowd = e.target.checked })} /> Crowd sounds</label>
        <label className="check"><input type="checkbox" checked={career.settings.walkOns !== false} onChange={(e) => set((c) => { c.settings.walkOns = e.target.checked })} /> Walk-ons at televised events</label>
      </div>
      <BackupPanel career={career} onRestore={onRestore} />
      <button className="btn" onClick={() => set((c) => { c.seenTutorial = false })}>Show the tutorial again</button>
      <button className="btn danger" onClick={onDelete}>Delete career</button>
    </div>
  )
}
