import { useEffect, useReducer, useRef } from 'react'
import { gameReducer, makeInitialState, leaguePositionOf, playerLeagueClubIds } from './state/gameReducer.js'
import { saveGame } from './state/persistence.js'
import { CLUB_BY_ID, DIVISION_LABELS } from './data/clubs.js'
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
import CommercialScreen from './components/CommercialScreen.jsx'
import SackedScreen from './components/SackedScreen.jsx'
import TacticsScreen from './components/TacticsScreen.jsx'
import NewsScreen from './components/NewsScreen.jsx'
import MatchdayScreen from './components/MatchdayScreen.jsx'
import JobOfferScreen from './components/JobOfferScreen.jsx'
import CareerScreen from './components/CareerScreen.jsx'
import InternationalScreen from './components/InternationalScreen.jsx'
import { flagBackgroundStyle } from './utils/flags.js'

const SCREENS = {
  squad: SquadScreen,
  lineup: LineupScreen,
  tactics: TacticsScreen,
  transfers: TransfersScreen,
  boardroom: BoardroomScreen,
  finances: FinancesScreen,
  stadium: StadiumScreen,
  fixtures: FixturesScreen,
  news: NewsScreen,
  career: CareerScreen,
  international: InternationalScreen,
  'player-detail': PlayerDetail,
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, makeInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!state.started) return
    const timeout = setTimeout(() => saveGame(state, state.saveSlot), 600)
    return () => clearTimeout(timeout)
  }, [state])

  useEffect(() => {
    function flush() {
      if (stateRef.current.started) saveGame(stateRef.current, stateRef.current.saveSlot)
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  if (state.screen === 'sacked') {
    return <SackedScreen state={state} dispatch={dispatch} />
  }

  if (state.screen === 'matchday') {
    return <MatchdayScreen state={state} dispatch={dispatch} />
  }

  if (state.screen === 'job-offers') {
    return <JobOfferScreen state={state} dispatch={dispatch} />
  }

  if (!state.started) {
    return (
      <div className="pm97-app">
        <NewGameScreen dispatch={dispatch} />
      </div>
    )
  }

  const club = state.clubs[state.playerClubId]
  const clubIds = playerLeagueClubIds(state)
  const position = leaguePositionOf(state.standings, clubIds, state.playerClubId)
  const divisionName = DIVISION_LABELS[club.division]

  if (state.screen === 'commercial') {
    return (
      <div className="pm97-app" style={flagBackgroundStyle(club.division)}>
        <div className="statusbar">
          <span>{state.managerName} — {CLUB_BY_ID[state.playerClubId].name}</span>
          <span>Season {state.season}/{String(state.season + 1).slice(2)}</span>
        </div>
        <NoticeBanner notice={state.notice} onClear={() => dispatch({ type: 'CLEAR_NOTICE' })} />
        <CommercialScreen state={state} dispatch={dispatch} />
      </div>
    )
  }

  const ScreenComponent = SCREENS[state.screen] ?? SquadScreen

  return (
    <div className="pm97-app" style={flagBackgroundStyle(club.division)}>
      <MenuBar state={state} dispatch={dispatch} />
      <div className="statusbar">
        <span>{state.managerName} — {CLUB_BY_ID[state.playerClubId].name}</span>
        <span>Season {state.season}/{String(state.season + 1).slice(2)}</span>
        <span>Week {Math.min(state.week, 38)}/38</span>
        <span>{divisionName}: {position}</span>
        <span>Bank: <Money value={club.bankBalance} /></span>
      </div>
      <NoticeBanner notice={state.notice} onClear={() => dispatch({ type: 'CLEAR_NOTICE' })} />
      <ScreenComponent state={state} dispatch={dispatch} />
    </div>
  )
}
