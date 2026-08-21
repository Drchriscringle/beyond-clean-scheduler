import { useEffect, useRef, useState } from 'react'
import { saveGame, loadGame, hasSave, clearSave } from '../state/persistence.js'

const MENU = [
  { key: 'squad', label: 'Squad' },
  { key: 'lineup', label: 'Team' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'boardroom', label: 'Boardroom' },
  { key: 'finances', label: 'Finances' },
  { key: 'stadium', label: 'Stadium' },
  { key: 'fixtures', label: 'Fixtures' },
]

export default function MenuBar({ state, dispatch }) {
  const seasonOver = !state.fixtures.some((f) => f.week === state.week)
  const [fileOpen, setFileOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setFileOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleSave() {
    const ok = saveGame(state)
    dispatch({ type: 'NOTICE', payload: { message: ok ? 'Game saved.' : 'Could not save — browser storage unavailable.' } })
    setFileOpen(false)
  }

  function handleLoadLast() {
    const saved = loadGame()
    if (saved) dispatch({ type: 'LOAD_GAME', payload: { state: saved.state, savedAt: saved.savedAt } })
    setFileOpen(false)
  }

  function handleQuit() {
    saveGame(state)
    dispatch({ type: 'QUIT_TO_MENU' })
    setFileOpen(false)
  }

  function handleDeleteSave() {
    clearSave()
    setFileOpen(false)
  }

  return (
    <div className="menubar">
      <div className="brand">PM'97</div>
      <div className="menu-item-wrapper" ref={wrapperRef}>
        <button className={`menu-item${fileOpen ? ' active' : ''}`} onClick={() => setFileOpen((o) => !o)}>
          File
        </button>
        {fileOpen && (
          <div className="dropdown-panel">
            <button className="dropdown-item" onClick={handleSave}>
              Save Game
            </button>
            <button className="dropdown-item" onClick={handleLoadLast} disabled={!hasSave()}>
              Load Last Save
            </button>
            <button className="dropdown-item" onClick={handleQuit}>
              Quit to Main Menu
            </button>
            <button className="dropdown-item" onClick={handleDeleteSave} disabled={!hasSave()}>
              Delete Save
            </button>
          </div>
        )}
      </div>
      {MENU.map((m) => (
        <button
          key={m.key}
          className={`menu-item${state.screen === m.key ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'NAVIGATE', payload: { screen: m.key, clubId: null } })}
        >
          {m.label}
        </button>
      ))}
      <div className="menu-spacer" />
      <button className="continue-btn" onClick={() => dispatch({ type: 'ADVANCE_WEEK' })}>
        {seasonOver ? 'New Season ▶' : 'Continue Week ▶'}
      </button>
    </div>
  )
}
