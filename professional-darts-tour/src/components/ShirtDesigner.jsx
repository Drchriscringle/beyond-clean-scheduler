import { useRef, useState } from 'react'
import ShareButton from './ShareButton.jsx'
import Shirt, { defaultShirt, FONTS, PATTERNS, THEMES } from './Shirt.jsx'

export default function ShirtDesigner({ career, update }) {
  const [draft, setDraft] = useState(() => career.shirt ?? defaultShirt(career))
  const [saved, setSaved] = useState(false)
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
  }
  const sponsors = career.sponsors
  const shirtRef = useRef(null)
  return (
    <div className="tab-body">
      <div className="card shirt-preview">
        <div className="shirt-pair" ref={shirtRef}>
          <div><Shirt shirt={draft} sponsors={sponsors} nation={career.players.user.nation} side="front" size={150} /><span className="muted small-text">Front</span></div>
          <div><Shirt shirt={draft} sponsors={sponsors} nation={career.players.user.nation} side="back" size={150} /><span className="muted small-text">Back</span></div>
        </div>
        {!sponsors.length && <p className="small-text muted">Sponsor logos appear here once you sign deals.</p>}
        <ShareButton target={shirtRef} name={`${draft.name || 'my'}-shirt`} text="My Professional Darts Tour shirt" label="Share my shirt" />
      </div>
      <div className="card form">
        <label>Name on the back<input value={draft.name} maxLength={14} onChange={(e) => set({ name: e.target.value.toUpperCase() })} /></label>
        <label>Nickname line<input value={draft.nickname} maxLength={24} onChange={(e) => set({ nickname: e.target.value })} placeholder="e.g. The Flying Scotsman" /></label>
        <div>
          <div className="label">Pattern</div>
          <div className="preset-row">{PATTERNS.map((p) => <button key={p} type="button" className={`chip small ${draft.pattern === p ? 'on' : ''}`} onClick={() => set({ pattern: p })}>{p}</button>)}</div>
        </div>
        <div className="colour-row">
          <label>Main<input type="color" value={draft.primary} onChange={(e) => set({ primary: e.target.value })} /></label>
          <label>Second<input type="color" value={draft.secondary} onChange={(e) => set({ secondary: e.target.value })} /></label>
          <label>Lettering<input type="color" value={draft.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
        </div>
        <div>
          <div className="label">Colour themes</div>
          <div className="preset-row">
            {THEMES.map(([name, a, b, c]) => (
              <button key={name} type="button" className="chip small theme" onClick={() => set({ primary: a, secondary: b, accent: c })}>
                <i style={{ background: a }} /><i style={{ background: b }} /> {name}
              </button>
            ))}
          </div>
        </div>
        <label>
          Lettering style
          <select value={draft.font} onChange={(e) => set({ font: e.target.value })}>{Object.keys(FONTS).map((f) => <option key={f} value={f}>{f}</option>)}</select>
        </label>
        <label className="check"><input type="checkbox" checked={draft.showFlag} onChange={(e) => set({ showFlag: e.target.checked })} /> Show my flag on the chest</label>
        <button className="btn primary big" onClick={() => { update((c) => { c.shirt = draft }); setSaved(true) }}>{saved ? '✓ Shirt saved' : 'Save shirt'}</button>
      </div>
    </div>
  )
}
