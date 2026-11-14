import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const KEY = 'bc_splash_seen'

function seen() {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}

/**
 * Opening screen: the Beyond Clean logo, full screen. Tap anywhere to go to the home page.
 * Shown once each time the app is opened on the home page, never over a link from an email.
 */
export default function Splash() {
  const { pathname } = useLocation()
  const [show, setShow] = useState(() => pathname === '/' && !seen())
  const [leaving, setLeaving] = useState(false)

  function enter() {
    if (leaving) return
    try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ }
    setLeaving(true)
    setTimeout(() => setShow(false), 350)
  }

  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter() } }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  })

  if (!show) return null
  return (
    <button type="button" onClick={enter} aria-label="Beyond Clean. Tap to enter"
      className={`splash fixed inset-0 z-50 w-full flex flex-col items-center justify-center gap-6 px-6 bg-white cursor-pointer
        transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <img src="./logo.jpg" alt="" className="splash-logo w-64 max-w-[70vw] aspect-square rounded-full" />
      <div className="text-center">
        <div className="text-slate-600 text-lg">Professional cleaning in Ayrshire</div>
      </div>
      <div className="splash-hint mt-4 rounded-full bg-brand-600 text-white font-bold px-6 py-3 shadow-lg">Tap to enter</div>
      <div className="absolute bottom-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-600 via-brand-500 to-leaf-500" />
    </button>
  )
}
