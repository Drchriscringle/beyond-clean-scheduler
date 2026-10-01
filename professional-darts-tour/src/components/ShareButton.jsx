import { useState } from 'react'
import { shareImage } from '../share.js'

// Captures the element in `target` (a ref) and shares it as a picture.
export default function ShareButton({ target, name, text, label = 'Share as picture' }) {
  const [state, setState] = useState('')
  const go = async () => {
    if (!target.current) return
    setState('Preparing…')
    try {
      const r = await shareImage(target.current, { name, text })
      setState(r === 'downloaded' ? 'Saved to downloads' : '')
    } catch {
      setState('Couldn’t make the picture')
    }
    setTimeout(() => setState(''), 2500)
  }
  return (
    <button className="btn small share-btn" onClick={go} disabled={state === 'Preparing…'}>
      📤 {state || label}
    </button>
  )
}
