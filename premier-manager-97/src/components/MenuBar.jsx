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

  return (
    <div className="menubar">
      <div className="brand">PM'97</div>
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
