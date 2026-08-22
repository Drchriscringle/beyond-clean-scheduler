import { useEffect, useRef, useState } from 'react'
import { saveGame, loadGame, hasSave, clearSave } from '../state/persistence.js'

const MENU_GROUPS = [
  {
    key: 'club',
    label: 'Club',
    items: [
      { key: 'squad', label: 'Squad' },
      { key: 'lineup', label: 'Team' },
      { key: 'tactics', label: 'Tactics' },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    items: [
      { key: 'transfers', label: 'Transfers' },
      { key: 'boardroom', label: 'Boardroom' },
      { key: 'finances', label: 'Finances' },
      { key: 'stadium', label: 'Stadium' },
    ],
  },
  {
    key: 'league',
    label: 'League',
    items: [
      { key: 'fixtures', label: 'Fixtures' },
      { key: 'news', label: 'News' },
      { key: 'career', label: 'Career' },
    ],
  },
]

export default function MenuBar({ state, dispatch }) {
  const seasonOver = !state.fixtures.some((f) => f.week === state.week)
  const [openMenu, setOpenMenu] = useState(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function toggleMenu(key) {
    setOpenMenu((open) => (open === key ? null : key))
  }

  function navigate(screen) {
    dispatch({ type: 'NAVIGATE', payload: { screen, clubId: null } })
    setOpenMenu(null)
  }

  function handleSave() {
    const ok = saveGame(state)
    dispatch({ type: 'NOTICE', payload: { message: ok ? 'Game saved.' : 'Could not save — browser storage unavailable.' } })
    setOpenMenu(null)
  }

  function handleLoadLast() {
    const saved = loadGame()
    if (saved) dispatch({ type: 'LOAD_GAME', payload: { state: saved.state, savedAt: saved.savedAt } })
    setOpenMenu(null)
  }

  function handleQuit() {
    saveGame(state)
    dispatch({ type: 'QUIT_TO_MENU' })
    setOpenMenu(null)
  }

  function handleDeleteSave() {
    clearSave()
    setOpenMenu(null)
  }

  return (
    <div className="menubar" ref={wrapperRef}>
      <div className="brand">RPM 25/26</div>
      <div className="menu-item-wrapper">
        <button className={`menu-item${openMenu === 'file' ? ' active' : ''}`} onClick={() => toggleMenu('file')}>
          File
        </button>
        {openMenu === 'file' && (
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
      {MENU_GROUPS.map((group) => {
        const groupActive = group.items.some((item) => item.key === state.screen)
        return (
          <div className="menu-item-wrapper" key={group.key}>
            <button
              className={`menu-item${groupActive || openMenu === group.key ? ' active' : ''}`}
              onClick={() => toggleMenu(group.key)}
            >
              {group.label} ▾
            </button>
            {openMenu === group.key && (
              <div className="dropdown-panel">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    className={`dropdown-item${state.screen === item.key ? ' active' : ''}`}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="menu-spacer" />
      <button
        className="continue-btn"
        onClick={() => dispatch({ type: seasonOver ? 'ADVANCE_WEEK' : 'START_MATCHDAY' })}
      >
        {seasonOver ? 'New Season ▶' : 'Continue Week ▶'}
      </button>
    </div>
  )
}
