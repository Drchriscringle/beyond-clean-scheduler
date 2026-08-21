import { CLUBS, CLUB_BY_ID, totalCapacity } from '../data/clubs.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { generateFreeAgents } from '../data/freeAgents.js'
import { generateFixtures } from './fixtures.js'
import { pickBestXI } from './lineup.js'
import { simulateMatch } from './matchSim.js'
import {
  weeklyWageBill,
  staffWageBill,
  maintenanceCost,
  sponsorshipIncome,
  tvIncomeForWeek,
  availableCapacity,
  matchdayIncome,
  estimatePlayerValue,
} from './finance.js'
import { requestBudget as evaluateBudgetRequest, driftConfidence } from './boardroom.js'
import { evaluateOffer, buildCost, buildWeeks } from './transfers.js'
import { PITCH_LEVELS, TRAINING_LEVELS, YOUTH_LEVELS, nextLevel } from '../data/facilities.js'
import { pushFormRating } from './form.js'

const LEDGER_LIMIT = 30

export function makeInitialState() {
  return {
    started: false,
    screen: 'new-game',
    managerName: '',
    playerClubId: null,
    season: 2025,
    week: 0,
    clubs: {},
    squads: {},
    standings: {},
    fixtures: [],
    lineups: {},
    freeAgents: [],
    transferLog: [],
    boardroomLog: [],
    lastMatch: null,
    weekResults: [],
    selectedPlayerId: null,
    viewingClubId: null,
    notice: null,
  }
}

function emptyStandingRow() {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
}

function applyResultToStandings(standings, clubId, gf, ga) {
  const row = standings[clubId] ?? emptyStandingRow()
  row.played += 1
  row.gf += gf
  row.ga += ga
  if (gf > ga) {
    row.won += 1
    row.points += 3
  } else if (gf === ga) {
    row.drawn += 1
    row.points += 1
  } else {
    row.lost += 1
  }
  standings[clubId] = row
}

export function standingsToTable(standings, clubIds) {
  return clubIds
    .map((id) => ({ clubId: id, ...(standings[id] ?? emptyStandingRow()) }))
    .sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf)
}

function leaguePositionOf(standings, clubIds, clubId) {
  const table = standingsToTable(standings, clubIds)
  return table.findIndex((row) => row.clubId === clubId) + 1
}

function startNewGame(state, { clubId, managerName }) {
  const clubs = {}
  const squads = {}
  const standings = {}
  const lineups = {}

  for (const staticClub of CLUBS) {
    clubs[staticClub.id] = {
      ...staticClub,
      budget: staticClub.startingBudget,
      bankBalance: staticClub.bankBalance,
      boardConfidence: 60,
      lastRequestWeek: null,
      pendingReason: 'general',
      facilities: { pitch: 1, training: 1, youth: 1 },
      stadiumProjects: {},
      ledger: [],
    }
    squads[staticClub.id] = generateSquadForClub(staticClub)
    standings[staticClub.id] = emptyStandingRow()
    lineups[staticClub.id] = { formation: '4-4-2', startingXI: pickBestXI(squads[staticClub.id], '4-4-2') }
  }

  const fixtures = generateFixtures(CLUBS.map((c) => c.id))

  return {
    ...state,
    started: true,
    screen: 'squad',
    managerName,
    playerClubId: clubId,
    season: 2025,
    week: 1,
    clubs,
    squads,
    standings,
    fixtures,
    lineups,
    freeAgents: generateFreeAgents('2025-1'),
    transferLog: [],
    boardroomLog: [],
    lastMatch: null,
    weekResults: [],
    notice: `You have been appointed manager of ${CLUB_BY_ID[clubId].name}.`,
  }
}

function applyFormRatings(squad, ratings) {
  return squad.map((p) => (ratings[p.id] != null ? pushFormRating(p, ratings[p.id]) : p))
}

function currentWeekFixtures(state) {
  return state.fixtures.find((f) => f.week === state.week)
}

function driftMoraleAndFitness(squad, resultPoints, starterIds) {
  return squad.map((p) => {
    let fitness = p.fitness
    let morale = p.morale
    let injured = p.injured ?? false
    let injuryWeeks = p.injuryWeeks ?? 0

    if (starterIds.includes(p.id)) {
      fitness = Math.max(35, fitness - (6 + Math.floor(Math.random() * 8)))
      if (resultPoints === 3) morale = Math.min(99, morale + 4)
      else if (resultPoints === 1) morale = Math.min(99, morale + 1)
      else morale = Math.max(5, morale - 5)
    } else {
      fitness = Math.min(100, fitness + 10)
      morale = morale + (morale < 60 ? 1 : morale > 60 ? -1 : 0)
    }

    if (injured) {
      injuryWeeks = Math.max(0, injuryWeeks - 1)
      if (injuryWeeks === 0) injured = false
    }

    return { ...p, fitness, morale, injured, injuryWeeks }
  })
}

function maybeInjurePlayers(squad, starterIds, injuryRateMultiplier) {
  return squad.map((p) => {
    if (!starterIds.includes(p.id) || p.injured) return p
    const chance = 0.012 * injuryRateMultiplier
    if (Math.random() < chance) {
      return {
        ...p,
        injured: true,
        injuryWeeks: 2 + Math.floor(Math.random() * 4),
        fitness: 20 + Math.floor(Math.random() * 20),
      }
    }
    return p
  })
}

function facilityInjuryMultiplier(facilities) {
  const pitch = PITCH_LEVELS.find((l) => l.level === facilities.pitch) ?? PITCH_LEVELS[0]
  const training = TRAINING_LEVELS.find((l) => l.level === facilities.training) ?? TRAINING_LEVELS[0]
  return pitch.injuryRate * training.injuryRate
}

function advanceWeek(state) {
  const week = currentWeekFixtures(state)
  if (!week) {
    return seasonRollover(state)
  }

  const clubs = { ...state.clubs }
  const squads = { ...state.squads }
  const standings = { ...state.standings }
  const clubIds = CLUBS.map((c) => c.id)
  const weekResults = []
  let lastMatch = state.lastMatch
  let playerResultPoints = null
  let playerPlayedThisWeek = false
  let playerWasHome = false

  for (const match of week.matches) {
    const homeClub = clubs[match.home]
    const awayClub = clubs[match.away]
    const homeSquad = squads[match.home]
    const awaySquad = squads[match.away]

    const homeLineup =
      match.home === state.playerClubId
        ? (state.lineups[match.home]?.startingXI ?? pickBestXI(homeSquad, '4-4-2'))
        : pickBestXI(homeSquad, state.lineups[match.home]?.formation ?? '4-4-2')
    const awayLineup =
      match.away === state.playerClubId
        ? (state.lineups[match.away]?.startingXI ?? pickBestXI(awaySquad, '4-4-2'))
        : pickBestXI(awaySquad, state.lineups[match.away]?.formation ?? '4-4-2')

    const result = simulateMatch({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup })

    squads[match.home] = applyFormRatings(squads[match.home], result.homeRatings)
    squads[match.away] = applyFormRatings(squads[match.away], result.awayRatings)

    applyResultToStandings(standings, match.home, result.homeGoals, result.awayGoals)
    applyResultToStandings(standings, match.away, result.awayGoals, result.homeGoals)

    weekResults.push({
      home: match.home,
      away: match.away,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
    })

    const involvesPlayer = match.home === state.playerClubId || match.away === state.playerClubId
    if (involvesPlayer) {
      lastMatch = {
        homeClubId: match.home,
        awayClubId: match.away,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        commentary: result.commentary,
      }
      playerPlayedThisWeek = true
      playerWasHome = match.home === state.playerClubId
      const gf = playerWasHome ? result.homeGoals : result.awayGoals
      const ga = playerWasHome ? result.awayGoals : result.homeGoals
      playerResultPoints = gf > ga ? 3 : gf === ga ? 1 : 0

      const starterIds = playerWasHome ? homeLineup : awayLineup
      const injuryMult = facilityInjuryMultiplier(clubs[state.playerClubId].facilities)
      let updatedSquad = maybeInjurePlayers(squads[state.playerClubId], starterIds, injuryMult)
      updatedSquad = driftMoraleAndFitness(updatedSquad, playerResultPoints, starterIds)
      squads[state.playerClubId] = updatedSquad
    }
  }

  // --- Player club finances for the week ---
  const playerClubId = state.playerClubId
  const club = clubs[playerClubId]
  const squad = squads[playerClubId]
  const position = leaguePositionOf(standings, clubIds, playerClubId)

  const wages = weeklyWageBill(squad)
  const staff = staffWageBill(club)
  const maintenance = maintenanceCost(totalCapacity(club))
  const interest = club.bankBalance < 0 ? Math.round(Math.abs(club.bankBalance) * 0.002) : 0

  let constructionSpend = 0
  const stadiumProjects = { ...club.stadiumProjects }
  for (const standId of Object.keys(stadiumProjects)) {
    const project = stadiumProjects[standId]
    if (project.weeksRemaining > 0) {
      constructionSpend += project.weeklyCost
      const weeksRemaining = project.weeksRemaining - 1
      if (weeksRemaining <= 0) {
        delete stadiumProjects[standId]
        club.stands = club.stands.map((s) =>
          s.id === standId ? { ...s, capacity: s.capacity + project.capacityAdd } : s,
        )
      } else {
        stadiumProjects[standId] = { ...project, weeksRemaining }
      }
    }
  }

  const sponsorship = sponsorshipIncome(club)
  const tv = tvIncomeForWeek(position)

  let matchday = { attendance: 0, attendancePct: 0, gateRevenue: 0 }
  if (playerPlayedThisWeek && playerWasHome) {
    const formGoodwill = (playerResultPoints === 3 ? 0.02 : playerResultPoints === 0 ? -0.02 : 0)
    matchday = matchdayIncome({
      club,
      capacity: availableCapacity(club, stadiumProjects),
      ticketPrice: club.ticketPrice,
      leaguePosition: position,
      formGoodwill,
    })
  }

  const income = sponsorship + tv + matchday.gateRevenue
  const expenditure = wages + staff + maintenance + constructionSpend + interest
  const net = income - expenditure
  const bankBalance = club.bankBalance + net

  const boardConfidence =
    playerResultPoints != null
      ? driftConfidence({
          boardConfidence: club.boardConfidence,
          leaguePosition: position,
          reputation: club.reputation,
          resultPoints: playerResultPoints,
        })
      : club.boardConfidence

  const ledgerEntry = {
    week: state.week,
    season: state.season,
    income: { matchday: matchday.gateRevenue, tv, sponsorship },
    expenditure: { wages, staff, maintenance, construction: constructionSpend, interest },
    net,
    balance: bankBalance,
  }

  clubs[playerClubId] = {
    ...club,
    bankBalance,
    boardConfidence,
    stadiumProjects,
    ledger: [ledgerEntry, ...club.ledger].slice(0, LEDGER_LIMIT),
  }

  const nextWeek = state.week + 1

  return {
    ...state,
    clubs,
    squads,
    standings,
    week: nextWeek,
    lastMatch,
    weekResults,
    notice: playerPlayedThisWeek
      ? `Full-time: ${CLUB_BY_ID[lastMatch.homeClubId].name} ${lastMatch.homeGoals}-${lastMatch.awayGoals} ${CLUB_BY_ID[lastMatch.awayClubId].name}`
      : 'A quiet week — no fixture for your side.',
  }
}

function seasonRollover(state) {
  const clubs = { ...state.clubs }
  const squads = { ...state.squads }

  for (const id of Object.keys(squads)) {
    const club = clubs[id]
    const training = TRAINING_LEVELS.find((l) => l.level === club.facilities.training) ?? TRAINING_LEVELS[0]
    squads[id] = squads[id]
      .map((p) => {
        const age = p.age + 1
        let ability = p.ability
        if (age <= 26 && p.potential > p.ability) {
          const growth = Math.round((p.potential - p.ability) * 0.22 * training.developmentRate)
          ability = Math.min(p.potential, p.ability + Math.max(1, growth))
        } else if (age >= 32) {
          ability = Math.max(30, p.ability - (2 + Math.floor(Math.random() * 3)))
        }
        return {
          ...p,
          age,
          ability,
          contractYears: Math.max(0, p.contractYears - 1),
          fitness: 90,
          morale: Math.max(40, Math.min(80, p.morale)),
        }
      })
      .filter((p) => p.contractYears > 0 || p.age < 34)
  }

  const standings = {}
  for (const c of CLUBS) standings[c.id] = emptyStandingRow()

  const season = state.season + 1
  const fixtures = generateFixtures(CLUBS.map((c) => c.id))

  return {
    ...state,
    clubs,
    squads,
    standings,
    fixtures,
    season,
    week: 1,
    freeAgents: generateFreeAgents(`${season}-1`),
    lastMatch: null,
    weekResults: [],
    notice: `The ${state.season}/${String(state.season + 1).slice(2)} season has ended. Welcome to the new campaign.`,
  }
}

function handleRequestBudget(state, { amount, reason }) {
  const club = state.clubs[state.playerClubId]
  const position = leaguePositionOf(state.standings, CLUBS.map((c) => c.id), state.playerClubId)
  const result = evaluateBudgetRequest({
    club: { ...club, pendingReason: reason },
    boardConfidence: club.boardConfidence,
    lastRequestWeek: club.lastRequestWeek,
    currentWeek: state.week,
    leaguePosition: position,
    amount,
  })

  const grantedBudget =
    result.outcome === 'granted' || result.outcome === 'partial' ? club.budget + result.grantedAmount : club.budget
  const lastRequestWeek = result.outcome === 'too-soon' ? club.lastRequestWeek : state.week
  const boardConfidence = Math.max(0, Math.min(100, club.boardConfidence + result.confidenceDelta))

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        budget: grantedBudget,
        lastRequestWeek,
        boardConfidence,
      },
    },
    boardroomLog: [
      { week: state.week, amount, reason, outcome: result.outcome, grantedAmount: result.grantedAmount, message: result.message },
      ...state.boardroomLog,
    ].slice(0, 20),
    notice: result.message,
  }
}

function handleMakeOffer(state, { playerId, fromClubId, fee }) {
  const player = state.squads[fromClubId]?.find((p) => p.id === playerId)
  if (!player) return state
  const club = state.clubs[state.playerClubId]
  if (fee > club.budget || fee > club.bankBalance) {
    return { ...state, notice: 'The board will not sanction spending beyond the funds available.' }
  }

  const result = evaluateOffer(player, fee)
  const logEntry = { week: state.week, playerName: player.name, fee, outcome: result.accepted ? 'accepted' : 'rejected', message: result.message }

  if (!result.accepted) {
    return {
      ...state,
      transferLog: [logEntry, ...state.transferLog].slice(0, 20),
      notice: result.message,
    }
  }

  const sellerSquad = state.squads[fromClubId].filter((p) => p.id !== playerId)
  const buyerSquad = [...state.squads[state.playerClubId], { ...player, listed: false }]
  const sellerClub = state.clubs[fromClubId]

  return {
    ...state,
    squads: {
      ...state.squads,
      [fromClubId]: sellerSquad,
      [state.playerClubId]: buyerSquad,
    },
    clubs: {
      ...state.clubs,
      [fromClubId]: { ...sellerClub, bankBalance: sellerClub.bankBalance + fee },
      [state.playerClubId]: { ...club, budget: club.budget - fee, bankBalance: club.bankBalance - fee },
    },
    transferLog: [logEntry, ...state.transferLog].slice(0, 20),
    notice: result.message,
  }
}

function handleSignFreeAgent(state, { playerId, contractYears }) {
  const player = state.freeAgents.find((p) => p.id === playerId)
  if (!player) return state
  const signed = { ...player, contractYears: contractYears ?? 2, listed: false }
  return {
    ...state,
    freeAgents: state.freeAgents.filter((p) => p.id !== playerId),
    squads: {
      ...state.squads,
      [state.playerClubId]: [...state.squads[state.playerClubId], signed],
    },
    notice: `${player.name} has signed on a free transfer.`,
  }
}

function handleBuildStand(state, { standId, capacityAdd }) {
  const club = state.clubs[state.playerClubId]
  const cost = buildCost(capacityAdd, club.reputation)
  if (cost > club.bankBalance) {
    return { ...state, notice: 'The bank balance will not cover a project of that size.' }
  }
  const weeks = buildWeeks(capacityAdd)
  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        bankBalance: club.bankBalance - cost,
        stadiumProjects: {
          ...club.stadiumProjects,
          [standId]: { capacityAdd, cost, weeksRemaining: weeks, totalWeeks: weeks, weeklyCost: Math.round(cost / weeks) },
        },
      },
    },
    notice: `Work begins on expanding the stand. Expected completion in ${weeks} weeks.`,
  }
}

function facilityLevels(facility) {
  if (facility === 'pitch') return PITCH_LEVELS
  if (facility === 'training') return TRAINING_LEVELS
  return YOUTH_LEVELS
}

function handleUpgradeFacility(state, { facility }) {
  const club = state.clubs[state.playerClubId]
  const currentLevel = club.facilities[facility]
  const levels = facilityLevels(facility)
  const next = nextLevel(levels, currentLevel)
  if (!next) return { ...state, notice: 'Already at the highest level available.' }
  if (next.cost > club.bankBalance) {
    return { ...state, notice: 'Not enough in the bank for that upgrade.' }
  }
  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        bankBalance: club.bankBalance - next.cost,
        facilities: { ...club.facilities, [facility]: next.level },
      },
    },
    notice: `${facility[0].toUpperCase()}${facility.slice(1)} upgraded to ${next.label}.`,
  }
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_NEW_GAME':
      return startNewGame(state, action.payload)
    case 'NAVIGATE':
      return {
        ...state,
        screen: action.payload.screen,
        selectedPlayerId: action.payload.playerId ?? null,
        viewingClubId: 'clubId' in action.payload ? action.payload.clubId : state.viewingClubId,
      }
    case 'SET_FORMATION':
      return {
        ...state,
        lineups: {
          ...state.lineups,
          [state.playerClubId]: {
            formation: action.payload.formation,
            startingXI: pickBestXI(state.squads[state.playerClubId], action.payload.formation),
          },
        },
      }
    case 'SET_STARTING_XI':
      return {
        ...state,
        lineups: {
          ...state.lineups,
          [state.playerClubId]: { ...state.lineups[state.playerClubId], startingXI: action.payload.ids },
        },
      }
    case 'TOGGLE_LISTED':
      return {
        ...state,
        squads: {
          ...state.squads,
          [state.playerClubId]: state.squads[state.playerClubId].map((p) =>
            p.id === action.payload.playerId ? { ...p, listed: !p.listed } : p,
          ),
        },
      }
    case 'SET_TICKET_PRICE':
      return {
        ...state,
        clubs: {
          ...state.clubs,
          [state.playerClubId]: { ...state.clubs[state.playerClubId], ticketPrice: action.payload.price },
        },
      }
    case 'REQUEST_BUDGET':
      return handleRequestBudget(state, action.payload)
    case 'MAKE_OFFER':
      return handleMakeOffer(state, action.payload)
    case 'SIGN_FREE_AGENT':
      return handleSignFreeAgent(state, action.payload)
    case 'BUILD_STAND':
      return handleBuildStand(state, action.payload)
    case 'UPGRADE_FACILITY':
      return handleUpgradeFacility(state, action.payload)
    case 'ADVANCE_WEEK':
      return advanceWeek(state)
    case 'CLEAR_NOTICE':
      return { ...state, notice: null }
    case 'NOTICE':
      return { ...state, notice: action.payload.message }
    case 'LOAD_GAME': {
      const savedAt = action.payload.savedAt
      const when = savedAt ? new Date(savedAt).toLocaleString() : null
      return {
        ...makeInitialState(),
        ...action.payload.state,
        notice: when ? `Save from ${when} loaded.` : 'Save loaded.',
      }
    }
    case 'QUIT_TO_MENU':
      return makeInitialState()
    default:
      return state
  }
}

export { estimatePlayerValue, leaguePositionOf }
