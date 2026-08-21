import { useEffect, useReducer, useRef } from 'react'
import { gameReducer, makeInitialState, leaguePositionOf } from './state/gameReducer.js'
import { saveGame } from './state/persistence.js'
import { CLUBS, CLUB_BY_ID } from './data/clubs.js'
import MenuBar from './components/MenuBar.jsx'
import { NoticeBanner, Money } from './components/shared.jsx'
import NewGameScreen from './components/NewGameScreen.jsx'
import SquadScreen from './components/SquadScreen.jsx'
import LineupScreen from './components/LineupScreen.jsx'
import TransfersScreen from './components/TransfersScreen.jsx'
import BoardroomScreen from './components/BoardroomScreen.jsx'
import FinancesScreen from './components/FinancesScreen.jsx'
import StadiumScreen from './components/StadiumScreen.jsx'
import FixturesScreen from './components/FixturesScreen.jsx'
import PlayerDetail from './components/PlayerDetail.jsx'

const SCREENS = {
  squad: SquadScreen,
  lineup: LineupScreen,
  transfers: TransfersScreen,
  boardroom: BoardroomScreen,
  finances: FinancesScreen,
  stadium: StadiumScreen,
  fixtures: FixturesScreen,
  'player-detail': PlayerDetail,
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, makeInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!state.started) return
    const timeout = setTimeout(() => saveGame(state), 600)
    return () => clearTimeout(timeout)
  }, [state])

  useEffect(() => {
    function flush() {
      if (stateRef.current.started) saveGame(stateRef.current)
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  if (!state.started) {
    return (
      <div className="pm97-app">
        <NewGameScreen dispatch={dispatch} />
      </div>
    )
  }

  const club = state.clubs[state.playerClubId]
  const clubIds = CLUBS.map((c) => c.id)
  const position = leaguePositionOf(state.standings, clubIds, state.playerClubId)
  const ScreenComponent = SCREENS[state.screen] ?? SquadScreen

  return (
    <div className="pm97-app">
      <MenuBar state={state} dispatch={dispatch} />
      <div className="statusbar">
        <span>{state.managerName} — {CLUB_BY_ID[state.playerClubId].name}</span>
        <span>Season {state.season}/{String(state.season + 1).slice(2)}</span>
        <span>Week {Math.min(state.week, 38)}/38</span>
        <span>League position: {position}</span>
        <span>Bank: <Money value={club.bankBalance} /></span>
      </div>
      <NoticeBanner notice={state.notice} onClear={() => dispatch({ type: 'CLEAR_NOTICE' })} />
      <ScreenComponent state={state} dispatch={dispatch} />
    </div>
  )
}
