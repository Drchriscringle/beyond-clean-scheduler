import { useState } from 'react'
import Face, { defaultFace, FACE_LABELS, FACE_OPTIONS, faceFor } from './Face.jsx'
import { defaultShirt } from './Shirt.jsx'

const SWATCHES = ['skin', 'hairColour', 'eyes']

export default function FaceBuilder({ career, update }) {
  const [face, setFace] = useState(() => career.face ?? defaultFace())
  const [saved, setSaved] = useState(false)
  const shirt = career.shirt ?? defaultShirt(career)
  const set = (k, v) => {
    setFace((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }
  return (
    <div className="card face-builder">
      <div className="card-label">Your face</div>
      <div className="face-preview"><Face face={face} shirt={shirt} size={170} ring /></div>
      {Object.keys(FACE_OPTIONS).map((k) => (
        <div key={k} className="face-row">
          <div className="label">{FACE_LABELS[k]}</div>
          <div className="preset-row">
            {FACE_OPTIONS[k].map((v) => SWATCHES.includes(k)
              ? <button key={v} type="button" aria-label={v} className={`swatch ${face[k] === v ? 'on' : ''}`} style={{ background: v }} onClick={() => set(k, v)} />
              : <button key={v} type="button" className={`chip small ${face[k] === v ? 'on' : ''}`} onClick={() => set(k, v)}>{v}</button>)}
          </div>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn" onClick={() => { setFace(faceFor({ id: String(Math.random()), gender: career.players.user.gender, age: career.players.user.age })); setSaved(false) }}>🎲 Randomise</button>
        <button className="btn primary" onClick={() => { update((c) => { c.face = face }); setSaved(true) }}>{saved ? '✓ Face saved' : 'Save face'}</button>
      </div>
    </div>
  )
}
