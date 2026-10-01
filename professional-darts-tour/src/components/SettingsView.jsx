import DifficultyPicker from './DifficultyPicker.jsx'
import BackupPanel from './BackupPanel.jsx'
import { setStoreNamePreview, STORE_BUILD, storeNames } from '../brand.js'
import { ANNOUNCERS, pickAnnouncer, speakParts } from '../caller.js'
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
        <label>
          Match MC (announcer)
          <select value={career.settings.announcer ?? 'random'} onChange={(e) => set((c) => { c.settings.announcer = e.target.value })}>
            <option value="random">Random each match</option>
            {ANNOUNCERS.map((a) => <option key={a.id} value={a.id}>{a.name}: {a.blurb}</option>)}
          </select>
        </label>
        <button className="btn small" type="button" onClick={() => { pickAnnouncer(career.settings.announcer ?? 'random'); speakParts([{ text: 'One hundred', pitch: 1, rate: 0.75 }, { text: 'and', pitch: 1.05, rate: 0.7 }, { text: 'eight-y!', pitch: 1.45, rate: 0.5 }]) }}>🔊 Hear a 180</button>
        <label className="check"><input type="checkbox" checked={career.settings.crowd !== false} onChange={(e) => set((c) => { c.settings.crowd = e.target.checked })} /> Crowd sounds</label>
        <label className="check"><input type="checkbox" checked={career.settings.walkOns !== false} onChange={(e) => set((c) => { c.settings.walkOns = e.target.checked })} /> Walk-ons at televised events</label>
      </div>
      <BackupPanel career={career} onRestore={onRestore} />
      <button className="btn" onClick={() => set((c) => { c.seenTutorial = false })}>Show the tutorial again</button>
      {!STORE_BUILD && (
        <label className="check small-text">
          <input type="checkbox" defaultChecked={storeNames()} onChange={(e) => { setStoreNamePreview(e.target.checked); window.location.reload() }} />
          Preview the app-store names (renames trademarked event names, e.g. World Matchplay → Blackpool Matchplay)
        </label>
      )}
      <a className="btn ghost small" href="privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
      <button className="btn danger" onClick={onDelete}>Delete career</button>
    </div>
  )
}
