import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, totalCapacity } from '../data/clubs.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { generateFreeAgents } from '../data/freeAgents.js'
import { generateFixtures, combineFixturesByWeek } from './fixtures.js'
import { pickBestXI } from './lineup.js'
import { simulateMatch, simulateMatchSegment, finalizeRatings } from './matchSim.js'
import {
  weeklyWageBill,
  staffWageBill,
  maintenanceCost,
  tvIncomeForWeek,
  availableCapacity,
  matchdayIncome,
  estimatePlayerValue,
} from './finance.js'
import { requestBudget as evaluateBudgetRequest, driftConfidence } from './boardroom.js'
import { evaluateOffer, buildCost, buildWeeks } from './transfers.js'
import { PITCH_LEVELS, TRAINING_LEVELS, YOUTH_LEVELS, nextLevel } from '../data/facilities.js'
import { pushFormRating } from './form.js'
import { generateSponsorshipOffers, generateMerchandiseOffers } from '../data/commercial.js'
import { generateObjective, evaluateObjective } from './objectives.js'
import { initCupState, isCupWeek, roundIndexForWeek, playCupRound, prizeMoneyForRound, WINNER_BONUS } from './cup.js'
import { aiTransferTick } from './aiTransfers.js'
import { generateYouthIntake, assignFreeSquadNumbers } from './youthIntake.js'
import { evaluateContractOffer } from './contracts.js'
import { applyMatchStats, rollSeasonStatsIntoCareer } from './playerStats.js'
import { maybeGenerateOffer } from './incomingOffers.js'
import { maybeInjureStarters, tickInjuries } from './injuries.js'
import { applyBookings, tickSuspensions } from './discipline.js'
import { isTransferWindowOpen } from './transferWindows.js'
import { defaultTactics } from './tactics.js'
import { computeSeasonAwards } from './awards.js'
import { generateJobOffers } from './jobOffers.js'

const LEDGER_LIMIT = 30
const SACK_CONFIDENCE_THRESHOLD = 5
const OBJECTIVE_FAIL_STREAK_LIMIT = 2
const MATCH_TICK_MINUTES = 3
const MATCH_HALF_TIME_MINUTE = 45
const MATCH_FULL_TIME_MINUTE = 90
const MATCH_MAX_SUBS = 5

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
    tactics: {},
    freeAgents: [],
    transferLog: [],
    boardroomLog: [],
    lastMatch: null,
    weekResults: [],
    selectedPlayerId: null,
    viewingClubId: null,
    notice: null,
    cup: null,
    commercial: null,
    sackedInfo: null,
    incomingOffers: [],
    liveMatch: null,
    matchSpeed: 'instant',
    lastSeasonAwards: null,
    jobOffers: null,
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

function divisionClubIds(clubs, division) {
  return Object.values(clubs)
    .filter((c) => c.division === division)
    .map((c) => c.id)
}

// The club ids that make up whichever division the player's club currently
// sits in - used everywhere a league table/position needs to be computed for
// the player, since standings are shared across both divisions in one map.
export function playerLeagueClubIds(state) {
  const division = state.clubs[state.playerClubId]?.division ?? 'PL'
  return divisionClubIds(state.clubs, division)
}

function startNewGame(state, { clubId, managerName }) {
  const clubs = {}
  const squads = {}
  const standings = {}
  const lineups = {}
  const tactics = {}
  const season = 2025

  for (const staticClub of [...CLUBS, ...CHAMPIONSHIP_CLUBS]) {
    const sponsorshipDeal = generateSponsorshipOffers(staticClub.reputation)[0]
    const merchandiseDeal = generateMerchandiseOffers(staticClub.reputation)[0]
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
      objective: generateObjective(staticClub.reputation, Math.random, staticClub.division),
      objectiveMissedStreak: 0,
      sponsorshipDeal,
      merchandiseDeal,
    }
    squads[staticClub.id] = generateSquadForClub(staticClub)
    standings[staticClub.id] = emptyStandingRow()
    lineups[staticClub.id] = { formation: '4-4-2', startingXI: pickBestXI(squads[staticClub.id], '4-4-2') }
    tactics[staticClub.id] = defaultTactics(squads[staticClub.id], lineups[staticClub.id].startingXI)
  }

  const plIds = CLUBS.map((c) => c.id)
  const chIds = CHAMPIONSHIP_CLUBS.map((c) => c.id)
  const fixtures = combineFixturesByWeek(generateFixtures(plIds), generateFixtures(chIds))
  const playerClub = clubs[clubId]

  return {
    ...state,
    started: true,
    screen: 'commercial',
    managerName,
    playerClubId: clubId,
    season,
    week: 1,
    clubs,
    squads,
    standings,
    fixtures,
    lineups,
    tactics,
    freeAgents: generateFreeAgents(`${season}-1`),
    transferLog: [],
    boardroomLog: [],
    lastMatch: null,
    weekResults: [],
    cup: initCupState([...plIds, ...chIds], season),
    commercial: {
      sponsorshipOptions: generateSponsorshipOffers(playerClub.reputation),
      merchandiseOptions: generateMerchandiseOffers(playerClub.reputation),
    },
    sackedInfo: null,
    notice: `You have been appointed manager of ${CLUB_BY_ID[clubId].name}. Objective: ${playerClub.objective.label}.`,
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

    if (starterIds.includes(p.id)) {
      fitness = Math.max(35, fitness - (6 + Math.floor(Math.random() * 8)))
      if (resultPoints === 3) morale = Math.min(99, morale + 4)
      else if (resultPoints === 1) morale = Math.min(99, morale + 1)
      else morale = Math.max(5, morale - 5)
    } else {
      fitness = Math.min(100, fitness + 10)
      morale = morale + (morale < 60 ? 1 : morale > 60 ? -1 : 0)
    }

    return { ...p, fitness, morale }
  })
}

function availablePlayerLineup(startingXI, squad, formation) {
  const unavailable = new Set(squad.filter((p) => p.injured || p.suspended).map((p) => p.id))
  const filtered = (startingXI ?? []).filter((id) => !unavailable.has(id))
  return filtered.length > 0 ? filtered : pickBestXI(squad, formation)
}

function facilityInjuryMultiplier(facilities) {
  const pitch = PITCH_LEVELS.find((l) => l.level === facilities.pitch) ?? PITCH_LEVELS[0]
  const training = TRAINING_LEVELS.find((l) => l.level === facilities.training) ?? TRAINING_LEVELS[0]
  return pitch.injuryRate * training.injuryRate
}

function simulateCupTie(homeId, awayId, { clubs, squads, lineups, tactics, playerClubId }) {
  const homeSquad = squads[homeId]
  const awaySquad = squads[awayId]
  const homeLineup =
    homeId === playerClubId
      ? availablePlayerLineup(lineups[homeId]?.startingXI, homeSquad, lineups[homeId]?.formation)
      : pickBestXI(homeSquad, lineups[homeId]?.formation ?? '4-4-2')
  const awayLineup =
    awayId === playerClubId
      ? availablePlayerLineup(lineups[awayId]?.startingXI, awaySquad, lineups[awayId]?.formation)
      : pickBestXI(awaySquad, lineups[awayId]?.formation ?? '4-4-2')

  const result = simulateMatch({
    homeClub: clubs[homeId],
    awayClub: clubs[awayId],
    homeSquad,
    awaySquad,
    homeLineup,
    awayLineup,
    homeTactics: tactics?.[homeId],
    awayTactics: tactics?.[awayId],
  })
  const winner =
    result.homeGoals === result.awayGoals ? (Math.random() < 0.5 ? homeId : awayId) : result.homeGoals > result.awayGoals ? homeId : awayId
  return { winner, homeGoals: result.homeGoals, awayGoals: result.awayGoals }
}

// --- Live matchday (watch-at-speed, with half-time/manual pauses for subs
// and tactical changes) ---------------------------------------------------
//
// Only the player's own league fixture is ever watched live; every other
// match that week, and any cup tie, is resolved instantly exactly as before.
// The live match is simulated a few minutes at a time via
// simulateMatchSegment (see matchSim.js) so a substitution or style change
// made at a pause takes effect for the rest of the match; once it reaches
// full-time, finishMatchday folds the accumulated result back into the
// normal advanceWeek pipeline via the `precomputed` parameter above, so
// finance/injuries/standings/etc. are computed exactly as they always were.

function startMatchday(state) {
  const week = currentWeekFixtures(state)
  const match = week?.matches.find((m) => m.home === state.playerClubId || m.away === state.playerClubId)
  if (!match) return advanceWeek(state)

  const homeSquad = state.squads[match.home]
  const awaySquad = state.squads[match.away]
  const homeLineup =
    match.home === state.playerClubId
      ? availablePlayerLineup(state.lineups[match.home]?.startingXI, homeSquad, state.lineups[match.home]?.formation)
      : pickBestXI(homeSquad, state.lineups[match.home]?.formation ?? '4-4-2')
  const awayLineup =
    match.away === state.playerClubId
      ? availablePlayerLineup(state.lineups[match.away]?.startingXI, awaySquad, state.lineups[match.away]?.formation)
      : pickBestXI(awaySquad, state.lineups[match.away]?.formation ?? '4-4-2')

  return {
    ...state,
    screen: 'matchday',
    liveMatch: {
      matchId: match.id,
      homeId: match.home,
      awayId: match.away,
      homeLineup,
      awayLineup,
      homeTactics: state.tactics[match.home],
      awayTactics: state.tactics[match.away],
      homeFeatured: [...homeLineup],
      awayFeatured: [...awayLineup],
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      currentMinute: 0,
      homeGoals: 0,
      awayGoals: 0,
      commentary: [],
      goals: [],
      bookings: [],
      speed: state.matchSpeed ?? 'instant',
      paused: false,
      halfTimeHandled: false,
    },
  }
}

function tickLiveMatch(state, { instant = false } = {}) {
  const lm = state.liveMatch
  if (!lm || lm.currentMinute >= MATCH_FULL_TIME_MINUTE) return state

  const clubs = state.clubs
  const squads = state.squads

  let currentMinute = lm.currentMinute
  let homeGoals = lm.homeGoals
  let awayGoals = lm.awayGoals
  let commentary = lm.commentary
  let goals = lm.goals
  let bookings = lm.bookings
  let halfTimeHandled = lm.halfTimeHandled
  let paused = false

  function runSegment(fromMin, toMin) {
    const segment = simulateMatchSegment({
      homeClub: clubs[lm.homeId],
      awayClub: clubs[lm.awayId],
      homeSquad: squads[lm.homeId],
      awaySquad: squads[lm.awayId],
      homeLineup: lm.homeLineup,
      awayLineup: lm.awayLineup,
      homeTactics: lm.homeTactics,
      awayTactics: lm.awayTactics,
      startMinute: fromMin,
      endMinute: toMin,
    })
    currentMinute = toMin
    homeGoals += segment.homeGoals
    awayGoals += segment.awayGoals
    commentary = [...commentary, ...segment.commentary]
    goals = [...goals, ...segment.goals]
    bookings = [...bookings, ...segment.bookings]
  }

  if (instant) {
    let from = currentMinute + 1
    while (from <= MATCH_FULL_TIME_MINUTE) {
      const to = Math.min(from + MATCH_TICK_MINUTES - 1, MATCH_FULL_TIME_MINUTE)
      runSegment(from, to)
      from = to + 1
    }
    halfTimeHandled = true
  } else {
    const from = currentMinute + 1
    const to = Math.min(from + MATCH_TICK_MINUTES - 1, MATCH_FULL_TIME_MINUTE)
    runSegment(from, to)
    if (currentMinute >= MATCH_HALF_TIME_MINUTE && !halfTimeHandled) {
      paused = true
      halfTimeHandled = true
    }
  }

  return {
    ...state,
    liveMatch: { ...lm, currentMinute, homeGoals, awayGoals, commentary, goals, bookings, halfTimeHandled, paused },
  }
}

function setLiveMatchPaused(state, paused) {
  if (!state.liveMatch) return state
  return { ...state, liveMatch: { ...state.liveMatch, paused } }
}

function setLiveMatchSpeed(state, speed) {
  if (!state.liveMatch) return state
  return { ...state, matchSpeed: speed, liveMatch: { ...state.liveMatch, speed } }
}

function liveSubstitution(state, { outId, inId }) {
  const lm = state.liveMatch
  if (!lm || !lm.paused) return state
  const isHome = lm.homeId === state.playerClubId
  const lineupKey = isHome ? 'homeLineup' : 'awayLineup'
  const featuredKey = isHome ? 'homeFeatured' : 'awayFeatured'
  const subsKey = isHome ? 'homeSubsUsed' : 'awaySubsUsed'

  if (lm[subsKey] >= MATCH_MAX_SUBS) return { ...state, notice: 'No substitutions remaining.' }
  if (!lm[lineupKey].includes(outId)) return state

  const newLineup = lm[lineupKey].map((id) => (id === outId ? inId : id))
  return {
    ...state,
    liveMatch: {
      ...lm,
      [lineupKey]: newLineup,
      [featuredKey]: [...new Set([...lm[featuredKey], inId])],
      [subsKey]: lm[subsKey] + 1,
    },
  }
}

function liveSetTactics(state, payload) {
  const lm = state.liveMatch
  if (!lm || !lm.paused) return state
  const isHome = lm.homeId === state.playerClubId
  const tacticsKey = isHome ? 'homeTactics' : 'awayTactics'
  return { ...state, liveMatch: { ...lm, [tacticsKey]: { ...lm[tacticsKey], ...payload } } }
}

function finishMatchday(state) {
  const lm = state.liveMatch
  if (!lm) return state

  const commentary = [
    ...lm.commentary,
    `90' — Full-time: ${state.clubs[lm.homeId].name} ${lm.homeGoals}-${lm.awayGoals} ${state.clubs[lm.awayId].name}`,
  ]
  const ratings = finalizeRatings({
    homeLineup: lm.homeFeatured,
    awayLineup: lm.awayFeatured,
    homeGoals: lm.homeGoals,
    awayGoals: lm.awayGoals,
    goals: lm.goals,
    homeClubId: lm.homeId,
    awayClubId: lm.awayId,
  })
  const result = {
    homeGoals: lm.homeGoals,
    awayGoals: lm.awayGoals,
    commentary,
    goals: lm.goals,
    bookings: lm.bookings,
    ...ratings,
  }

  const nextState = advanceWeek(
    { ...state, liveMatch: null, screen: 'fixtures' },
    { matchId: lm.matchId, result, homeFeaturedIds: lm.homeFeatured, awayFeaturedIds: lm.awayFeatured },
  )
  return { ...nextState, liveMatch: null }
}

// `precomputed`, when supplied, is the already-simulated result of a match
// watched live on the Matchday screen (see finishMatchday below) - the match
// with that id is not re-simulated, and its featured-player lists (starters
// plus any subs brought on) stand in for the normal starting XI wherever
// appearances/injuries/morale are applied for that fixture.
function advanceWeek(state, precomputed = null) {
  const week = currentWeekFixtures(state)
  if (!week) {
    return seasonRollover(state)
  }

  const clubs = { ...state.clubs }
  let squads = { ...state.squads }
  const standings = { ...state.standings }
  const allClubIds = Object.keys(state.squads)
  const leagueClubIds = playerLeagueClubIds(state)
  const weekResults = []
  let lastMatch = state.lastMatch
  let playerResultPoints = null
  let playerPlayedThisWeek = false
  let playerWasHome = false
  const freshInjuryIds = {}
  const freshSuspensionIds = {}

  const windowOpen = isTransferWindowOpen(state.week)
  const aiResult = aiTransferTick({ clubs, squads, freeAgents: state.freeAgents, playerClubId: state.playerClubId, week: state.week, windowOpen })
  squads = aiResult.squads
  const freeAgents = aiResult.freeAgents
  const transferLog =
    aiResult.events.length > 0
      ? [...aiResult.events.map((e) => ({ week: e.week, playerName: e.playerName, fee: e.fee, outcome: e.outcome, message: e.message })), ...state.transferLog].slice(0, 20)
      : state.transferLog

  const newOffer = windowOpen
    ? maybeGenerateOffer({
        squad: squads[state.playerClubId],
        clubIds: allClubIds,
        playerClubId: state.playerClubId,
        week: state.week,
      })
    : null
  const incomingOffers = newOffer ? [...state.incomingOffers, newOffer].slice(-5) : state.incomingOffers

  let cup = state.cup
  let cupNotice = null
  if (cup && !cup.champion && isCupWeek(state.week) && roundIndexForWeek(state.week) === cup.roundIndex) {
    const involvedBefore = cup.matches.some((m) => m.home === state.playerClubId || m.away === state.playerClubId)
    const roundIndexPlayed = cup.roundIndex
    const nextCup = playCupRound(cup, (h, a) => simulateCupTie(h, a, { clubs, squads, lineups: state.lineups, tactics: state.tactics, playerClubId: state.playerClubId }))
    if (involvedBefore) {
      const playedRound = nextCup.history[nextCup.history.length - 1]
      const tie = playedRound.matches.find((m) => m.home === state.playerClubId || m.away === state.playerClubId)
      const wasHome = tie.home === state.playerClubId
      const oppId = wasHome ? tie.away : tie.home
      const won = tie.winner === state.playerClubId
      const prize = prizeMoneyForRound(roundIndexPlayed)
      const bonus = won && nextCup.champion === state.playerClubId ? WINNER_BONUS : 0
      clubs[state.playerClubId] = {
        ...clubs[state.playerClubId],
        bankBalance: clubs[state.playerClubId].bankBalance + prize + bonus,
      }
      if (nextCup.champion === state.playerClubId) {
        cupNotice = `FA Cup Final: WON ${tie.homeGoals}-${tie.awayGoals} vs ${CLUB_BY_ID[oppId].name} — you are FA Cup Champions!`
      } else if (won) {
        cupNotice = `FA Cup ${playedRound.round}: Won ${tie.homeGoals}-${tie.awayGoals} vs ${CLUB_BY_ID[oppId].name} — through to the next round!`
      } else {
        cupNotice = `FA Cup ${playedRound.round}: Lost ${tie.homeGoals}-${tie.awayGoals} to ${CLUB_BY_ID[oppId].name} — you're out of the cup.`
      }
    }
    cup = nextCup
  }

  for (const match of week.matches) {
    const isLiveMatch = precomputed && precomputed.matchId === match.id
    const homeClub = clubs[match.home]
    const awayClub = clubs[match.away]
    const homeSquad = squads[match.home]
    const awaySquad = squads[match.away]

    const homeLineup = isLiveMatch
      ? precomputed.homeFeaturedIds
      : match.home === state.playerClubId
        ? availablePlayerLineup(state.lineups[match.home]?.startingXI, homeSquad, state.lineups[match.home]?.formation)
        : pickBestXI(homeSquad, state.lineups[match.home]?.formation ?? '4-4-2')
    const awayLineup = isLiveMatch
      ? precomputed.awayFeaturedIds
      : match.away === state.playerClubId
        ? availablePlayerLineup(state.lineups[match.away]?.startingXI, awaySquad, state.lineups[match.away]?.formation)
        : pickBestXI(awaySquad, state.lineups[match.away]?.formation ?? '4-4-2')

    const result = isLiveMatch
      ? precomputed.result
      : simulateMatch({
          homeClub,
          awayClub,
          homeSquad,
          awaySquad,
          homeLineup,
          awayLineup,
          homeTactics: state.tactics[match.home],
          awayTactics: state.tactics[match.away],
        })

    squads[match.home] = applyFormRatings(squads[match.home], result.homeRatings)
    squads[match.away] = applyFormRatings(squads[match.away], result.awayRatings)
    squads[match.home] = applyMatchStats(squads[match.home], { lineupIds: homeLineup, goals: result.goals, motmId: result.motmId })
    squads[match.away] = applyMatchStats(squads[match.away], { lineupIds: awayLineup, goals: result.goals, motmId: result.motmId })

    const homeInjuryMult = facilityInjuryMultiplier(clubs[match.home].facilities)
    const awayInjuryMult = facilityInjuryMultiplier(clubs[match.away].facilities)
    const homeInjuryResult = maybeInjureStarters(squads[match.home], homeLineup, homeInjuryMult)
    const awayInjuryResult = maybeInjureStarters(squads[match.away], awayLineup, awayInjuryMult)
    squads[match.home] = homeInjuryResult.squad
    squads[match.away] = awayInjuryResult.squad
    freshInjuryIds[match.home] = new Set([...(freshInjuryIds[match.home] ?? []), ...homeInjuryResult.freshIds])
    freshInjuryIds[match.away] = new Set([...(freshInjuryIds[match.away] ?? []), ...awayInjuryResult.freshIds])

    const homeBookings = result.bookings.filter((b) => b.side === 'home')
    const awayBookings = result.bookings.filter((b) => b.side === 'away')
    const homeBookingResult = applyBookings(squads[match.home], homeBookings)
    const awayBookingResult = applyBookings(squads[match.away], awayBookings)
    squads[match.home] = homeBookingResult.squad
    squads[match.away] = awayBookingResult.squad
    freshSuspensionIds[match.home] = new Set([...(freshSuspensionIds[match.home] ?? []), ...homeBookingResult.freshIds])
    freshSuspensionIds[match.away] = new Set([...(freshSuspensionIds[match.away] ?? []), ...awayBookingResult.freshIds])

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
      const motmPlayer = result.motmClubId ? squads[result.motmClubId]?.find((p) => p.id === result.motmId) : null
      lastMatch = {
        homeClubId: match.home,
        awayClubId: match.away,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        commentary: result.commentary,
        motmName: motmPlayer?.name ?? null,
        motmClubId: result.motmClubId,
      }
      playerPlayedThisWeek = true
      playerWasHome = match.home === state.playerClubId
      const gf = playerWasHome ? result.homeGoals : result.awayGoals
      const ga = playerWasHome ? result.awayGoals : result.homeGoals
      playerResultPoints = gf > ga ? 3 : gf === ga ? 1 : 0

      const starterIds = playerWasHome ? homeLineup : awayLineup
      squads[state.playerClubId] = driftMoraleAndFitness(squads[state.playerClubId], playerResultPoints, starterIds)
    }
  }

  // Weekly injury/suspension countdown for every club, once per week
  // regardless of how many matches (league + cup) they played. Anyone only
  // just injured/booked this same week is excluded so the countdown starts
  // next week, not immediately.
  for (const id of allClubIds) {
    squads[id] = tickInjuries(squads[id], freshInjuryIds[id] ?? new Set())
    squads[id] = tickSuspensions(squads[id], freshSuspensionIds[id] ?? new Set())
  }

  // --- Player club finances for the week ---
  const playerClubId = state.playerClubId
  const club = clubs[playerClubId]
  const squad = squads[playerClubId]
  const position = leaguePositionOf(standings, leagueClubIds, playerClubId)

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

  const sponsorship = club.sponsorshipDeal?.weeklyIncome ?? 0
  const merchandise = club.merchandiseDeal?.weeklyIncome ?? 0
  const tv = tvIncomeForWeek(position, club.division)

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

  const income = sponsorship + merchandise + tv + matchday.gateRevenue
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
    income: { matchday: matchday.gateRevenue, tv, sponsorship, merchandise },
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

  const weekReturn = {
    ...state,
    clubs,
    squads,
    standings,
    freeAgents,
    transferLog,
    incomingOffers,
    cup,
    week: nextWeek,
    lastMatch,
    weekResults,
    notice:
      cupNotice ??
      (playerPlayedThisWeek
        ? `Full-time: ${CLUB_BY_ID[lastMatch.homeClubId].name} ${lastMatch.homeGoals}-${lastMatch.awayGoals} ${CLUB_BY_ID[lastMatch.awayClubId].name}`
        : 'A quiet week — no fixture for your side.'),
  }

  if (boardConfidence <= SACK_CONFIDENCE_THRESHOLD) {
    return {
      ...weekReturn,
      screen: 'sacked',
      sackedInfo: {
        clubName: CLUB_BY_ID[playerClubId].name,
        reason: 'The board have lost all faith in your management.',
        finalPosition: position,
      },
    }
  }

  return weekReturn
}

// Bottom 3 of the Premier League go down; top 2 of the Championship go up
// automatically, and the 3rd-6th placed Championship clubs contest a
// single-match play-off (two semis, then a final) for the third promotion
// spot - the real English pyramid's rule, simplified to instant results.
function resolvePromotionRelegation(state, clubs) {
  const oldPlIds = divisionClubIds(state.clubs, 'PL')
  const oldChIds = divisionClubIds(state.clubs, 'CH')
  const plTable = standingsToTable(state.standings, oldPlIds)
  const chTable = standingsToTable(state.standings, oldChIds)

  const relegatedIds = plTable.slice(-3).map((r) => r.clubId)
  const autoPromotedIds = chTable.slice(0, 2).map((r) => r.clubId)

  let playoffWinnerId = null
  let playoffNotice = ''
  const contenders = chTable.slice(2, 6).map((r) => r.clubId)
  if (contenders.length === 4) {
    const ctx = { clubs, squads: state.squads, lineups: state.lineups, tactics: state.tactics, playerClubId: state.playerClubId }
    const [p3, p4, p5, p6] = contenders
    const semi1 = simulateCupTie(p3, p6, ctx)
    const semi2 = simulateCupTie(p4, p5, ctx)
    const final = simulateCupTie(semi1.winner, semi2.winner, ctx)
    playoffWinnerId = final.winner
    playoffNotice = ` Championship play-off final: ${CLUB_BY_ID[semi1.winner].name} ${final.homeGoals}-${final.awayGoals} ${CLUB_BY_ID[semi2.winner].name} — ${CLUB_BY_ID[playoffWinnerId].name} are promoted.`
  }

  const promotedIds = playoffWinnerId ? [...autoPromotedIds, playoffWinnerId] : autoPromotedIds

  for (const id of relegatedIds) clubs[id] = { ...clubs[id], division: 'CH' }
  for (const id of promotedIds) clubs[id] = { ...clubs[id], division: 'PL' }

  const playerClubId = state.playerClubId
  let headline = ''
  if (relegatedIds.includes(playerClubId)) headline = 'YOU HAVE BEEN RELEGATED TO THE CHAMPIONSHIP. '
  else if (promotedIds.includes(playerClubId)) headline = 'YOU HAVE WON PROMOTION TO THE PREMIER LEAGUE! '

  const notice =
    `${headline}Relegated to the Championship: ${relegatedIds.map((id) => CLUB_BY_ID[id].name).join(', ')}. ` +
    `Promoted to the Premier League: ${autoPromotedIds.map((id) => CLUB_BY_ID[id].name).join(', ')} (automatic)` +
    `${playoffWinnerId ? ` and ${CLUB_BY_ID[playoffWinnerId].name} (play-offs)` : ''}.` +
    playoffNotice

  return { notice }
}

function seasonRollover(state) {
  const leagueClubIds = playerLeagueClubIds(state)
  const playerClubId = state.playerClubId
  const finalPosition = leaguePositionOf(state.standings, leagueClubIds, playerClubId)
  const playerClubBefore = state.clubs[playerClubId]
  const objectiveResult = evaluateObjective(playerClubBefore.objective, finalPosition)
  const confidenceAfterObjective = Math.max(0, Math.min(100, playerClubBefore.boardConfidence + objectiveResult.confidenceDelta))
  const objectiveMissedStreak = objectiveResult.met ? 0 : playerClubBefore.objectiveMissedStreak + 1

  if (confidenceAfterObjective <= SACK_CONFIDENCE_THRESHOLD || objectiveMissedStreak >= OBJECTIVE_FAIL_STREAK_LIMIT) {
    return {
      ...state,
      clubs: {
        ...state.clubs,
        [playerClubId]: { ...playerClubBefore, boardConfidence: confidenceAfterObjective, objectiveMissedStreak },
      },
      screen: 'sacked',
      sackedInfo: {
        clubName: CLUB_BY_ID[playerClubId].name,
        reason: objectiveResult.message,
        finalPosition,
      },
    }
  }

  const clubs = { ...state.clubs }
  const seasonAwards = {
    PL: computeSeasonAwards(state.squads, clubs, 'PL'),
    CH: computeSeasonAwards(state.squads, clubs, 'CH'),
  }
  const jobOfferClubIds = generateJobOffers({
    club: state.clubs[playerClubId],
    objectiveMet: objectiveResult.met,
    finalPosition,
    divisionSize: leagueClubIds.length,
    allClubs: state.clubs,
    playerClubId,
  })
  const { notice: promotionRelegationNotice } = resolvePromotionRelegation(state, clubs)
  const squads = {}
  const season = state.season + 1
  let releasedFromPlayerClub = []

  for (const id of Object.keys(state.squads)) {
    const club = clubs[id]
    const training = TRAINING_LEVELS.find((l) => l.level === club.facilities.training) ?? TRAINING_LEVELS[0]

    let aged = state.squads[id].map((p) => {
      const age = p.age + 1
      let ability = p.ability
      if (age <= 26 && p.potential > p.ability) {
        const growth = Math.round((p.potential - p.ability) * 0.22 * training.developmentRate)
        ability = Math.min(p.potential, p.ability + Math.max(1, growth))
      } else if (age >= 32) {
        ability = Math.max(30, p.ability - (2 + Math.floor(Math.random() * 3)))
      }
      return rollSeasonStatsIntoCareer({
        ...p,
        age,
        ability,
        contractYears: Math.max(0, p.contractYears - 1),
        fitness: 90,
        morale: Math.max(40, Math.min(80, p.morale)),
        yellowCards: 0,
      })
    })

    if (id === playerClubId) {
      releasedFromPlayerClub = aged.filter((p) => p.contractYears <= 0)
      aged = aged.filter((p) => p.contractYears > 0)
    } else {
      aged = aged.map((p) => (p.contractYears <= 0 ? { ...p, contractYears: 2 + Math.floor(Math.random() * 3) } : p))
    }

    const youth = assignFreeSquadNumbers(aged, generateYouthIntake(club, season))
    const room = Math.max(0, 30 - aged.length)
    squads[id] = [...aged, ...youth.slice(0, room)]
  }

  const standings = {}
  for (const id of Object.keys(clubs)) standings[id] = emptyStandingRow()

  const newPlIds = divisionClubIds(clubs, 'PL')
  const newChIds = divisionClubIds(clubs, 'CH')
  const fixtures = combineFixturesByWeek(generateFixtures(newPlIds), generateFixtures(newChIds))
  const playerClub = {
    ...clubs[playerClubId],
    boardConfidence: confidenceAfterObjective,
    objectiveMissedStreak,
    objective: generateObjective(clubs[playerClubId].reputation, Math.random, clubs[playerClubId].division),
  }
  clubs[playerClubId] = playerClub

  return {
    ...state,
    clubs,
    squads,
    standings,
    fixtures,
    season,
    week: 1,
    freeAgents: [...generateFreeAgents(`${season}-1`), ...releasedFromPlayerClub],
    lastMatch: null,
    weekResults: [],
    cup: initCupState([...newPlIds, ...newChIds], season),
    commercial: {
      sponsorshipOptions: generateSponsorshipOffers(playerClub.reputation),
      merchandiseOptions: generateMerchandiseOffers(playerClub.reputation),
    },
    lastSeasonAwards: { season: state.season, ...seasonAwards },
    jobOffers: jobOfferClubIds.length > 0 ? jobOfferClubIds : null,
    screen: jobOfferClubIds.length > 0 ? 'job-offers' : 'commercial',
    notice: `${objectiveResult.message} The ${state.season}/${String(state.season + 1).slice(2)} season has ended. ${promotionRelegationNotice}`,
  }
}

function handleRequestBudget(state, { amount, reason }) {
  const club = state.clubs[state.playerClubId]
  const position = leaguePositionOf(state.standings, playerLeagueClubIds(state), state.playerClubId)
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

function handleConfirmCommercialDeals(state, { sponsorshipId, merchandiseId }) {
  const club = state.clubs[state.playerClubId]
  const sponsorshipDeal = state.commercial.sponsorshipOptions.find((o) => o.id === sponsorshipId) ?? club.sponsorshipDeal
  const merchandiseDeal = state.commercial.merchandiseOptions.find((o) => o.id === merchandiseId) ?? club.merchandiseDeal
  const signingBonuses = sponsorshipDeal.signingBonus + merchandiseDeal.signingBonus

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        sponsorshipDeal,
        merchandiseDeal,
        bankBalance: club.bankBalance + signingBonuses,
      },
    },
    commercial: null,
    screen: 'squad',
    notice: `Signed with ${sponsorshipDeal.partner} (shirt sponsor) and ${merchandiseDeal.partner} (merchandise).`,
  }
}

function handleRespondToJobOffer(state, { clubId }) {
  if (!clubId) {
    return { ...state, jobOffers: null, screen: 'commercial' }
  }

  const oldClubId = state.playerClubId
  const newClub = state.clubs[clubId]
  const clubs = {
    ...state.clubs,
    [oldClubId]: { ...state.clubs[oldClubId], boardConfidence: 60 },
    [clubId]: { ...newClub, boardConfidence: Math.max(65, newClub.boardConfidence) },
  }

  return {
    ...state,
    clubs,
    playerClubId: clubId,
    jobOffers: null,
    commercial: {
      sponsorshipOptions: generateSponsorshipOffers(clubs[clubId].reputation),
      merchandiseOptions: generateMerchandiseOffers(clubs[clubId].reputation),
    },
    screen: 'commercial',
    notice: `You have been appointed the new manager of ${CLUB_BY_ID[clubId].name}.`,
  }
}

function handleOfferContract(state, { playerId, wage, years }) {
  const squad = state.squads[state.playerClubId]
  const player = squad.find((p) => p.id === playerId)
  if (!player) return state

  const result = evaluateContractOffer(player, wage, years)
  if (!result.accepted) {
    return { ...state, notice: result.message }
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.map((p) => (p.id === playerId ? { ...p, wage, contractYears: years } : p)),
    },
    notice: result.message,
  }
}

function handleReleasePlayer(state, { playerId }) {
  const squad = state.squads[state.playerClubId]
  const player = squad.find((p) => p.id === playerId)
  if (!player) return state

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.filter((p) => p.id !== playerId),
    },
    freeAgents: [...state.freeAgents, { ...player, contractYears: 0, listed: false }],
    notice: `${player.name} has been released and joins the free agent pool.`,
  }
}

function handleRespondToOffer(state, { offerId, accept }) {
  const offer = state.incomingOffers.find((o) => o.id === offerId)
  if (!offer) return state
  const remaining = state.incomingOffers.filter((o) => o.id !== offerId)

  if (!accept) {
    return { ...state, incomingOffers: remaining, notice: `Offer for ${offer.playerName} turned down.` }
  }

  const squad = state.squads[state.playerClubId]
  const player = squad.find((p) => p.id === offer.playerId)
  if (!player) {
    return { ...state, incomingOffers: remaining }
  }

  const club = state.clubs[state.playerClubId]
  const buyerClub = state.clubs[offer.fromClubId]

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.filter((p) => p.id !== offer.playerId),
    },
    clubs: {
      ...state.clubs,
      [state.playerClubId]: { ...club, bankBalance: club.bankBalance + offer.fee },
      [offer.fromClubId]: { ...buyerClub, bankBalance: buyerClub.bankBalance - offer.fee },
    },
    incomingOffers: remaining,
    notice: `Sold ${player.name} to ${CLUB_BY_ID[offer.fromClubId].name} for ${offer.fee.toLocaleString('en-GB')}.`,
  }
}

function handleMakeOffer(state, { playerId, fromClubId, fee }) {
  if (!isTransferWindowOpen(state.week)) {
    return { ...state, notice: 'The transfer window is closed — you cannot buy players until it reopens.' }
  }
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
    case 'SET_TACTICS':
      return {
        ...state,
        tactics: {
          ...state.tactics,
          [state.playerClubId]: { ...state.tactics[state.playerClubId], ...action.payload },
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
    case 'CONFIRM_COMMERCIAL_DEALS':
      return handleConfirmCommercialDeals(state, action.payload)
    case 'RESPOND_TO_JOB_OFFER':
      return handleRespondToJobOffer(state, action.payload)
    case 'OFFER_CONTRACT':
      return handleOfferContract(state, action.payload)
    case 'MAKE_OFFER':
      return handleMakeOffer(state, action.payload)
    case 'RELEASE_PLAYER':
      return handleReleasePlayer(state, action.payload)
    case 'RESPOND_TO_OFFER':
      return handleRespondToOffer(state, action.payload)
    case 'SIGN_FREE_AGENT':
      return handleSignFreeAgent(state, action.payload)
    case 'BUILD_STAND':
      return handleBuildStand(state, action.payload)
    case 'UPGRADE_FACILITY':
      return handleUpgradeFacility(state, action.payload)
    case 'ADVANCE_WEEK':
      return advanceWeek(state)
    case 'START_MATCHDAY':
      return startMatchday(state)
    case 'TICK_MATCH':
      return tickLiveMatch(state, action.payload ?? {})
    case 'PAUSE_MATCH':
      return setLiveMatchPaused(state, true)
    case 'RESUME_MATCH':
      return setLiveMatchPaused(state, false)
    case 'SET_MATCH_SPEED':
      return setLiveMatchSpeed(state, action.payload.speed)
    case 'LIVE_SUBSTITUTION':
      return liveSubstitution(state, action.payload)
    case 'LIVE_SET_TACTICS':
      return liveSetTactics(state, action.payload)
    case 'FINISH_MATCHDAY':
      return finishMatchday(state)
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
