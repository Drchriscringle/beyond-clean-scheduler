import { CLUBS, CHAMPIONSHIP_CLUBS, CLUB_BY_ID, DIVISION_LABELS, totalCapacity } from '../data/clubs.js'
import { FOREIGN_CLUBS } from '../data/foreignClubs.js'
import { SCOTTISH_PREMIERSHIP_CLUBS, SCOTTISH_CHAMPIONSHIP_CLUBS } from '../data/scottishClubs.js'
import { LA_LIGA_CLUBS } from '../data/laLigaClubs.js'
import { SEGUNDA_CLUBS } from '../data/segundaClubs.js'
import { SERIE_A_CLUBS } from '../data/serieAClubs.js'
import { SERIE_B_CLUBS } from '../data/serieBClubs.js'
import { BUNDESLIGA_CLUBS } from '../data/bundesligaClubs.js'
import { BUNDESLIGA_2_CLUBS } from '../data/bundesliga2Clubs.js'
import { rollWeather } from '../data/weather.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { generateFreeAgents } from '../data/freeAgents.js'
import { generateSeasonFixtures, combineFixturesByWeek } from './fixtures.js'
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
import { evaluateOffer, evaluateClubInterest, settleSellOnClauses, buildCost, buildWeeks } from './transfers.js'
import { PITCH_LEVELS, TRAINING_LEVELS, YOUTH_LEVELS, nextLevel } from '../data/facilities.js'
import { pushFormRating } from './form.js'
import { generateSponsorshipOffers, generateMerchandiseOffers } from '../data/commercial.js'
import { generateObjective, evaluateObjective } from './objectives.js'
import {
  initCupState,
  isCupWeek,
  roundIndexForWeek,
  playCupRound,
  prizeMoneyForRound,
  WINNER_BONUS,
  isScottishCupWeek,
  scottishRoundIndexForWeek,
  scottishPrizeMoneyForRound,
  SCOTTISH_CUP_SIZE,
  SCOTTISH_CUP_ROUND_NAMES,
  SCOTTISH_WINNER_BONUS,
} from './cup.js'
import { aiTransferTick } from './aiTransfers.js'
import { generateYouthIntake, assignFreeSquadNumbers } from './youthIntake.js'
import { evaluateContractOffer, computeBonusPayout } from './contracts.js'
import { applyMatchStats, rollSeasonStatsIntoCareer } from './playerStats.js'
import { maybeGenerateOffer, generateDeadlineDayOffers } from './incomingOffers.js'
import { maybeInjureStarters, tickInjuries } from './injuries.js'
import { applyBookings, tickSuspensions } from './discipline.js'
import { isTransferWindowOpen, isDeadlineDay } from './transferWindows.js'
import { defaultTactics } from './tactics.js'
import { computeSeasonAwards } from './awards.js'
import { generateJobOffers } from './jobOffers.js'
import { recordSeason } from './careerHistory.js'
import { SCOUT_COST } from './scouting.js'
import { evaluateResponse } from './pressConference.js'
import { evaluateLoanOffer, evaluateLoanRequest, tickLoans } from './loans.js'
import { moraleSwingMultiplier, isLeader } from './personality.js'
import { qualificationForPosition, scottishQualificationForPosition, initEuropeanCampaign, playEuropeanRound, EURO_ROUND_WEEKS } from './europe.js'
import { aiAbilityMultiplier, sackConfidenceThreshold, objectiveFailStreakLimit } from './difficulty.js'
import {
  INTERNATIONAL_WEEKS,
  isEligibleForInternationalJob,
  maybeOfferInternationalJob,
  initInternationalJob,
  playInternationalFixture,
} from './international.js'

const LEDGER_LIMIT = 30
const SEASON_WEEKS = 38
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
    scottishCup: null,
    commercial: null,
    sackedInfo: null,
    incomingOffers: [],
    liveMatch: null,
    matchSpeed: 'instant',
    lastSeasonAwards: null,
    jobOffers: null,
    careerHistory: [],
    pressConferenceHandled: true,
    europe: null,
    difficulty: 'normal',
    saveSlot: 1,
    international: null,
    internationalOffer: false,
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

// A club's last `count` results ('W'/'D'/'L'), oldest first - reads straight
// off the season-long fixtures list (see advanceWeek, which stamps each
// played match's score onto it) rather than needing any separate history,
// so it works for any club in any division, not just the player's own.
export function recentFormForClub(fixtures, clubId, count = 5) {
  const results = []
  for (const wk of fixtures) {
    const match = wk.matches.find((m) => m.home === clubId || m.away === clubId)
    if (!match || match.homeGoals == null) continue
    const isHome = match.home === clubId
    const gf = isHome ? match.homeGoals : match.awayGoals
    const ga = isHome ? match.awayGoals : match.homeGoals
    results.push(gf > ga ? 'W' : gf < ga ? 'L' : 'D')
  }
  return results.slice(-count)
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

function startNewGame(state, { clubId, managerName, difficulty = 'normal', saveSlot = 1 }) {
  const clubs = {}
  const squads = {}
  const standings = {}
  const lineups = {}
  const tactics = {}
  const season = 2025
  const abilityMultiplier = aiAbilityMultiplier(difficulty)

  for (const staticClub of [
    ...CLUBS,
    ...CHAMPIONSHIP_CLUBS,
    ...SCOTTISH_PREMIERSHIP_CLUBS,
    ...SCOTTISH_CHAMPIONSHIP_CLUBS,
    ...LA_LIGA_CLUBS,
    ...SEGUNDA_CLUBS,
    ...SERIE_A_CLUBS,
    ...SERIE_B_CLUBS,
    ...BUNDESLIGA_CLUBS,
    ...BUNDESLIGA_2_CLUBS,
  ]) {
    const sponsorshipDeal = generateSponsorshipOffers(staticClub.reputation)[0]
    const merchandiseDeal = generateMerchandiseOffers(staticClub.reputation)[0]
    clubs[staticClub.id] = {
      ...staticClub,
      budget: staticClub.startingBudget,
      bankBalance: staticClub.bankBalance,
      concessionPrice: Math.round(staticClub.ticketPrice * 0.35),
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
    squads[staticClub.id] = generateSquadForClub(staticClub, { abilityMultiplier: staticClub.id === clubId ? 1 : abilityMultiplier })
    standings[staticClub.id] = emptyStandingRow()
    lineups[staticClub.id] = { formation: '4-4-2', startingXI: pickBestXI(squads[staticClub.id], '4-4-2') }
    tactics[staticClub.id] = defaultTactics(squads[staticClub.id], lineups[staticClub.id].startingXI)
  }

  // Foreign clubs get a real, persistent squad and bank balance so they can
  // be bought from and sold to like any other club, but no fixtures/table
  // entry of their own - they never field a lineup or contest a league.
  for (const foreignClub of FOREIGN_CLUBS) {
    clubs[foreignClub.id] = { ...foreignClub }
    squads[foreignClub.id] = generateSquadForClub(foreignClub)
  }

  const plIds = CLUBS.map((c) => c.id)
  const chIds = CHAMPIONSHIP_CLUBS.map((c) => c.id)
  const splIds = SCOTTISH_PREMIERSHIP_CLUBS.map((c) => c.id)
  const schIds = SCOTTISH_CHAMPIONSHIP_CLUBS.map((c) => c.id)
  const laLigaIds = LA_LIGA_CLUBS.map((c) => c.id)
  const segundaIds = SEGUNDA_CLUBS.map((c) => c.id)
  const serieAIds = SERIE_A_CLUBS.map((c) => c.id)
  const serieBIds = SERIE_B_CLUBS.map((c) => c.id)
  const bundesligaIds = BUNDESLIGA_CLUBS.map((c) => c.id)
  const bundesliga2Ids = BUNDESLIGA_2_CLUBS.map((c) => c.id)
  const fixtures = combineFixturesByWeek(
    generateSeasonFixtures(plIds, SEASON_WEEKS),
    generateSeasonFixtures(chIds, SEASON_WEEKS),
    generateSeasonFixtures(splIds, SEASON_WEEKS),
    generateSeasonFixtures(schIds, SEASON_WEEKS),
    generateSeasonFixtures(laLigaIds, SEASON_WEEKS),
    generateSeasonFixtures(segundaIds, SEASON_WEEKS),
    generateSeasonFixtures(serieAIds, SEASON_WEEKS),
    generateSeasonFixtures(serieBIds, SEASON_WEEKS),
    generateSeasonFixtures(bundesligaIds, SEASON_WEEKS),
    generateSeasonFixtures(bundesliga2Ids, SEASON_WEEKS),
  )
  const playerClub = clubs[clubId]

  // The squad you inherit is already known to you - only fresh youth intake,
  // free agents and every other club's players need scouting.
  squads[clubId] = squads[clubId].map((p) => ({ ...p, scouted: true }))

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
    scottishCup: initCupState([...splIds, ...schIds], season, SCOTTISH_CUP_SIZE),
    commercial: {
      sponsorshipOptions: generateSponsorshipOffers(playerClub.reputation),
      merchandiseOptions: generateMerchandiseOffers(playerClub.reputation),
    },
    sackedInfo: null,
    difficulty,
    saveSlot,
    notice: `You have been appointed manager of ${CLUB_BY_ID[clubId].name}. Objective: ${playerClub.objective.label}.`,
  }
}

function applyFormRatings(squad, ratings) {
  return squad.map((p) => (ratings[p.id] != null ? pushFormRating(p, ratings[p.id]) : p))
}

function currentWeekFixtures(state) {
  return state.fixtures.find((f) => f.week === state.week)
}

function driftMoraleAndFitness(squad, resultPoints, starterIds, captainId = null) {
  const captainIsLeader = resultPoints === 3 && isLeader(squad.find((p) => p.id === captainId)?.personality)
  return squad.map((p) => {
    let fitness = p.fitness
    let morale = p.morale
    const swing = moraleSwingMultiplier(p.personality)

    if (starterIds.includes(p.id)) {
      fitness = Math.max(35, fitness - (6 + Math.floor(Math.random() * 8)))
      if (resultPoints === 3) morale = Math.min(99, morale + Math.round(4 * swing))
      else if (resultPoints === 1) morale = Math.min(99, morale + Math.round(1 * swing))
      else morale = Math.max(5, morale - Math.round(5 * swing))
    } else {
      fitness = Math.min(100, fitness + 10)
      morale = morale + (morale < 60 ? 1 : morale > 60 ? -1 : 0)
    }

    if (captainIsLeader) morale = Math.min(99, morale + 1)

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
    homeFormation: lineups[homeId]?.formation,
    awayFormation: lineups[awayId]?.formation,
    weather: rollWeather(),
    homePitchLevel: clubs[homeId]?.facilities?.pitch,
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
      // Rolled once at kick-off and held fixed for the rest of the match -
      // every later tick (see tickLiveMatch below) reuses this same value.
      weather: rollWeather(),
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
      homeFormation: state.lineups[lm.homeId]?.formation,
      awayFormation: state.lineups[lm.awayId]?.formation,
      weather: lm.weather,
      homePitchLevel: clubs[lm.homeId]?.facilities?.pitch,
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
  const matchResultsById = {}
  let lastMatch = state.lastMatch
  let playerResultPoints = null
  let playerPlayedThisWeek = false
  let playerWasHome = false
  let bonusPayout = 0
  const freshInjuryIds = {}
  const freshSuspensionIds = {}

  const windowOpen = isTransferWindowOpen(state.week)
  const deadlineDay = windowOpen && isDeadlineDay(state.week)
  const aiResult = aiTransferTick({
    clubs,
    squads,
    freeAgents: state.freeAgents,
    playerClubId: state.playerClubId,
    week: state.week,
    windowOpen,
    isDeadlineDay: deadlineDay,
  })
  squads = aiResult.squads
  const freeAgents = aiResult.freeAgents
  const transferLog =
    aiResult.events.length > 0
      ? [...aiResult.events.map((e) => ({ week: e.week, playerName: e.playerName, fee: e.fee, outcome: e.outcome, message: e.message })), ...state.transferLog].slice(0, 20)
      : state.transferLog

  let newOffers = []
  if (windowOpen && deadlineDay) {
    newOffers = generateDeadlineDayOffers({ squad: squads[state.playerClubId], clubIds: allClubIds, playerClubId: state.playerClubId, week: state.week })
  } else if (windowOpen) {
    const single = maybeGenerateOffer({ squad: squads[state.playerClubId], clubIds: allClubIds, playerClubId: state.playerClubId, week: state.week })
    if (single) newOffers = [single]
  }
  const incomingOffers = newOffers.length > 0 ? [...state.incomingOffers, ...newOffers].slice(-5) : state.incomingOffers
  const deadlineDayNotice =
    deadlineDay && (aiResult.events.length > 0 || newOffers.length > 0)
      ? `DEADLINE DAY: ${aiResult.events.length} move(s) across the league${newOffers.length > 0 ? `, plus ${newOffers.length} offer(s) in for your listed player(s)` : ''}!`
      : null

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

  let scottishCup = state.scottishCup
  let scottishCupNotice = null
  if (scottishCup && !scottishCup.champion && isScottishCupWeek(state.week) && scottishRoundIndexForWeek(state.week) === scottishCup.roundIndex) {
    const involvedBefore = scottishCup.matches.some((m) => m.home === state.playerClubId || m.away === state.playerClubId)
    const roundIndexPlayed = scottishCup.roundIndex
    const nextScottishCup = playCupRound(
      scottishCup,
      (h, a) => simulateCupTie(h, a, { clubs, squads, lineups: state.lineups, tactics: state.tactics, playerClubId: state.playerClubId }),
      SCOTTISH_CUP_ROUND_NAMES,
    )
    if (involvedBefore) {
      const playedRound = nextScottishCup.history[nextScottishCup.history.length - 1]
      const tie = playedRound.matches.find((m) => m.home === state.playerClubId || m.away === state.playerClubId)
      const wasHome = tie.home === state.playerClubId
      const oppId = wasHome ? tie.away : tie.home
      const won = tie.winner === state.playerClubId
      const prize = scottishPrizeMoneyForRound(roundIndexPlayed)
      const bonus = won && nextScottishCup.champion === state.playerClubId ? SCOTTISH_WINNER_BONUS : 0
      clubs[state.playerClubId] = {
        ...clubs[state.playerClubId],
        bankBalance: clubs[state.playerClubId].bankBalance + prize + bonus,
      }
      if (nextScottishCup.champion === state.playerClubId) {
        scottishCupNotice = `Scottish Cup Final: WON ${tie.homeGoals}-${tie.awayGoals} vs ${CLUB_BY_ID[oppId].name} — you are Scottish Cup Champions!`
      } else if (won) {
        scottishCupNotice = `Scottish Cup ${playedRound.round}: Won ${tie.homeGoals}-${tie.awayGoals} vs ${CLUB_BY_ID[oppId].name} — through to the next round!`
      } else {
        scottishCupNotice = `Scottish Cup ${playedRound.round}: Lost ${tie.homeGoals}-${tie.awayGoals} to ${CLUB_BY_ID[oppId].name} — you're out of the cup.`
      }
    }
    scottishCup = nextScottishCup
  }

  let europe = state.europe
  let europeNotice = null
  if (europe && !europe.eliminated && !europe.champion && EURO_ROUND_WEEKS.includes(state.week)) {
    const playerLineup = availablePlayerLineup(
      state.lineups[state.playerClubId]?.startingXI,
      squads[state.playerClubId],
      state.lineups[state.playerClubId]?.formation,
    )
    const roundResult = playEuropeanRound(europe, {
      playerClub: clubs[state.playerClubId],
      playerSquad: squads[state.playerClubId],
      playerLineup,
      playerTactics: state.tactics[state.playerClubId],
      allSquads: squads,
    })
    clubs[state.playerClubId] = {
      ...clubs[state.playerClubId],
      bankBalance: clubs[state.playerClubId].bankBalance + roundResult.prize,
    }
    europe = roundResult.europe
    europeNotice = roundResult.notice
  }

  let international = state.international
  let internationalNotice = null
  if (international && INTERNATIONAL_WEEKS.includes(state.week)) {
    const playerLineup = availablePlayerLineup(
      state.lineups[state.playerClubId]?.startingXI,
      squads[state.playerClubId],
      state.lineups[state.playerClubId]?.formation,
    )
    const fixtureResult = playInternationalFixture(international, {
      playerSquad: squads[state.playerClubId],
      playerLineup,
      playerTactics: state.tactics[state.playerClubId],
    })
    international = fixtureResult.international
    internationalNotice = fixtureResult.notice
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
          homeFormation: state.lineups[match.home]?.formation,
          awayFormation: state.lineups[match.away]?.formation,
          weather: rollWeather(),
          homePitchLevel: homeClub?.facilities?.pitch,
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
    matchResultsById[match.id] = { homeGoals: result.homeGoals, awayGoals: result.awayGoals }

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
      const captainId = state.tactics[state.playerClubId]?.captainId
      squads[state.playerClubId] = driftMoraleAndFitness(squads[state.playerClubId], playerResultPoints, starterIds, captainId)
      bonusPayout = computeBonusPayout(squads[state.playerClubId], result.goals)
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
  squads = tickLoans(squads)

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

  let matchday = { attendance: 0, attendancePct: 0, gateRevenue: 0, concessionRevenue: 0 }
  if (playerPlayedThisWeek && playerWasHome) {
    const formGoodwill = (playerResultPoints === 3 ? 0.02 : playerResultPoints === 0 ? -0.02 : 0)
    matchday = matchdayIncome({
      club,
      capacity: availableCapacity(club, stadiumProjects),
      ticketPrice: club.ticketPrice,
      concessionPrice: club.concessionPrice,
      leaguePosition: position,
      formGoodwill,
      divisionSize: leagueClubIds.length,
    })
  }

  const income = sponsorship + merchandise + tv + matchday.gateRevenue + matchday.concessionRevenue
  const expenditure = wages + staff + maintenance + constructionSpend + interest + bonusPayout
  const net = income - expenditure
  const bankBalance = club.bankBalance + net

  const boardConfidence =
    playerResultPoints != null
      ? driftConfidence({
          boardConfidence: club.boardConfidence,
          leaguePosition: position,
          reputation: club.reputation,
          resultPoints: playerResultPoints,
          divisionSize: leagueClubIds.length,
        })
      : club.boardConfidence

  const ledgerEntry = {
    week: state.week,
    season: state.season,
    income: { matchday: matchday.gateRevenue, concessions: matchday.concessionRevenue, tv, sponsorship, merchandise },
    expenditure: { wages, staff, maintenance, construction: constructionSpend, interest, bonuses: bonusPayout },
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

  // Stamp this week's results onto the season-long fixtures list (rather
  // than only ever exposing the most recent week's results, as weekResults
  // does) so a "season fixtures & results" view can show every match a club
  // has played, not just last week's - see CareerFixturesScreen.jsx.
  const fixtures = state.fixtures.map((wk) =>
    wk.week === state.week
      ? { ...wk, matches: wk.matches.map((m) => (matchResultsById[m.id] ? { ...m, ...matchResultsById[m.id] } : m)) }
      : wk,
  )

  const weekReturn = {
    ...state,
    clubs,
    squads,
    standings,
    freeAgents,
    transferLog,
    incomingOffers,
    cup,
    scottishCup,
    europe,
    international,
    week: nextWeek,
    fixtures,
    lastMatch,
    weekResults,
    pressConferenceHandled: playerPlayedThisWeek ? false : state.pressConferenceHandled,
    notice:
      (cupNotice ??
        scottishCupNotice ??
        europeNotice ??
        (playerPlayedThisWeek
          ? `Full-time: ${CLUB_BY_ID[lastMatch.homeClubId].name} ${lastMatch.homeGoals}-${lastMatch.awayGoals} ${CLUB_BY_ID[lastMatch.awayClubId].name}`
          : 'A quiet week — no fixture for your side.')) +
      (deadlineDayNotice ? ` ${deadlineDayNotice}` : '') +
      (internationalNotice ? ` ${internationalNotice}` : ''),
  }

  if (boardConfidence <= sackConfidenceThreshold(state.difficulty)) {
    return {
      ...weekReturn,
      careerHistory: recordSeason(state.careerHistory, {
        season: state.season,
        clubId: playerClubId,
        division: club.division,
        finalPosition: position,
        objectiveLabel: club.objective.label,
        objectiveMet: null,
        cup: cup,
        scottishCup: scottishCup,
        outcome: 'sacked-mid-season',
      }),
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

// Shared shape for a two-division pyramid: `relegationCount` go down from
// the top division, `autoPromoteCount` go up automatically from the bottom
// one, and the next `playoffPoolSize` (always 4, for a two-semis-plus-final
// bracket) contest a single-match play-off for the remaining promotion
// spot(s) - relegationCount must equal autoPromoteCount + 1 (the playoff
// winner) for the pyramid to stay the same size season to season.
function resolveDivisionPromotionRelegation(state, clubs, { topDivision, bottomDivision, relegationCount, autoPromoteCount, playoffPoolSize = 4 }) {
  const oldTopIds = divisionClubIds(state.clubs, topDivision)
  const oldBottomIds = divisionClubIds(state.clubs, bottomDivision)
  const topTable = standingsToTable(state.standings, oldTopIds)
  const bottomTable = standingsToTable(state.standings, oldBottomIds)
  const topLabel = DIVISION_LABELS[topDivision]
  const bottomLabel = DIVISION_LABELS[bottomDivision]

  const relegatedIds = topTable.slice(-relegationCount).map((r) => r.clubId)
  const autoPromotedIds = bottomTable.slice(0, autoPromoteCount).map((r) => r.clubId)

  let playoffWinnerId = null
  let playoffNotice = ''
  const contenders = bottomTable.slice(autoPromoteCount, autoPromoteCount + playoffPoolSize).map((r) => r.clubId)
  if (contenders.length === 4) {
    const ctx = { clubs, squads: state.squads, lineups: state.lineups, tactics: state.tactics, playerClubId: state.playerClubId }
    const [p3, p4, p5, p6] = contenders
    const semi1 = simulateCupTie(p3, p6, ctx)
    const semi2 = simulateCupTie(p4, p5, ctx)
    const final = simulateCupTie(semi1.winner, semi2.winner, ctx)
    playoffWinnerId = final.winner
    playoffNotice = ` ${bottomLabel} play-off final: ${CLUB_BY_ID[semi1.winner].name} ${final.homeGoals}-${final.awayGoals} ${CLUB_BY_ID[semi2.winner].name} — ${CLUB_BY_ID[playoffWinnerId].name} are promoted.`
  }

  const promotedIds = playoffWinnerId ? [...autoPromotedIds, playoffWinnerId] : autoPromotedIds

  for (const id of relegatedIds) clubs[id] = { ...clubs[id], division: bottomDivision }
  for (const id of promotedIds) clubs[id] = { ...clubs[id], division: topDivision }

  const playerClubId = state.playerClubId
  let headline = ''
  if (relegatedIds.includes(playerClubId)) headline = `YOU HAVE BEEN RELEGATED TO THE ${bottomLabel.toUpperCase()}. `
  else if (promotedIds.includes(playerClubId)) headline = `YOU HAVE WON PROMOTION TO THE ${topLabel.toUpperCase()}! `

  const notice =
    `${headline}Relegated to the ${bottomLabel}: ${relegatedIds.map((id) => CLUB_BY_ID[id].name).join(', ')}. ` +
    `Promoted to the ${topLabel}: ${autoPromotedIds.map((id) => CLUB_BY_ID[id].name).join(', ')} (automatic)` +
    `${playoffWinnerId ? ` and ${CLUB_BY_ID[playoffWinnerId].name} (play-offs)` : ''}.` +
    playoffNotice

  return { notice }
}

// Bottom 3 of the Premier League go down; top 2 of the Championship go up
// automatically, and the 3rd-6th placed Championship clubs contest a
// single-match play-off (two semis, then a final) for the third promotion
// spot - the real English pyramid's rule, simplified to instant results.
function resolvePromotionRelegation(state, clubs) {
  return resolveDivisionPromotionRelegation(state, clubs, {
    topDivision: 'PL',
    bottomDivision: 'CH',
    relegationCount: 3,
    autoPromoteCount: 2,
  })
}

// Same shape, recalibrated to the Scottish pyramid's smaller divisions:
// bottom 2 of the Premiership go down (instead of the top flight's 11th
// place surviving via a cross-division play-off, which would need a new
// kind of tie this abstraction doesn't otherwise support), the Championship
// champion goes up automatically, and 2nd-5th contest a play-off for the
// second promotion spot - so relegationCount (2) still equals autoPromoteCount
// + the playoff winner (1 + 1), keeping both divisions the same size.
function resolveScottishPromotionRelegation(state, clubs) {
  return resolveDivisionPromotionRelegation(state, clubs, {
    topDivision: 'SPL',
    bottomDivision: 'SCH',
    relegationCount: 2,
    autoPromoteCount: 1,
  })
}

// Same shape as the English pyramid: bottom 3 of La Liga go down, top 2 of
// the Segunda División go up automatically, and 3rd-6th contest a play-off
// for the third promotion spot.
function resolveLaLigaPromotionRelegation(state, clubs) {
  return resolveDivisionPromotionRelegation(state, clubs, {
    topDivision: 'LALIGA',
    bottomDivision: 'SEGUNDA',
    relegationCount: 3,
    autoPromoteCount: 2,
  })
}

// Same shape again for Italy: bottom 3 of Serie A go down, top 2 of Serie B
// go up automatically, 3rd-6th contest a play-off for the third promotion
// spot.
function resolveSerieAPromotionRelegation(state, clubs) {
  return resolveDivisionPromotionRelegation(state, clubs, {
    topDivision: 'SERIEA',
    bottomDivision: 'SERIEB',
    relegationCount: 3,
    autoPromoteCount: 2,
  })
}

// Same shape again for Germany, recalibrated to the Bundesliga's smaller
// (18-club) divisions - simplified to the same shared shape used for every
// other pyramid in this game rather than Germany's real one-off relegation
// play-off (which this abstraction doesn't otherwise support, same
// reasoning as the Scottish pyramid above).
function resolveBundesligaPromotionRelegation(state, clubs) {
  return resolveDivisionPromotionRelegation(state, clubs, {
    topDivision: 'BUNDESLIGA',
    bottomDivision: 'BUNDESLIGA2',
    relegationCount: 3,
    autoPromoteCount: 2,
  })
}

function seasonRollover(state) {
  const leagueClubIds = playerLeagueClubIds(state)
  const playerClubId = state.playerClubId
  const finalPosition = leaguePositionOf(state.standings, leagueClubIds, playerClubId)
  const playerClubBefore = state.clubs[playerClubId]
  const europeanQualification =
    playerClubBefore.division === 'PL' ||
    playerClubBefore.division === 'LALIGA' ||
    playerClubBefore.division === 'SERIEA' ||
    playerClubBefore.division === 'BUNDESLIGA'
      ? qualificationForPosition(finalPosition)
      : playerClubBefore.division === 'SPL'
        ? scottishQualificationForPosition(finalPosition)
        : null
  const objectiveResult = evaluateObjective(playerClubBefore.objective, finalPosition)
  const confidenceAfterObjective = Math.max(0, Math.min(100, playerClubBefore.boardConfidence + objectiveResult.confidenceDelta))
  const objectiveMissedStreak = objectiveResult.met ? 0 : playerClubBefore.objectiveMissedStreak + 1

  if (confidenceAfterObjective <= sackConfidenceThreshold(state.difficulty) || objectiveMissedStreak >= objectiveFailStreakLimit(state.difficulty)) {
    return {
      ...state,
      clubs: {
        ...state.clubs,
        [playerClubId]: { ...playerClubBefore, boardConfidence: confidenceAfterObjective, objectiveMissedStreak },
      },
      careerHistory: recordSeason(state.careerHistory, {
        season: state.season,
        clubId: playerClubId,
        division: playerClubBefore.division,
        finalPosition,
        objectiveLabel: playerClubBefore.objective.label,
        objectiveMet: objectiveResult.met,
        cup: state.cup,
        scottishCup: state.scottishCup,
        outcome: 'sacked',
      }),
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
  const internationalOffer = maybeOfferInternationalJob({
    alreadyHasJob: !!state.international,
    eligible: isEligibleForInternationalJob({
      reputation: state.clubs[playerClubId].reputation,
      wonLeagueTitle: playerClubBefore.division === 'PL' && finalPosition === 1,
    }),
  })
  const { notice: promotionRelegationNotice } = resolvePromotionRelegation(state, clubs)
  const { notice: scottishPromotionRelegationNotice } = resolveScottishPromotionRelegation(state, clubs)
  const { notice: laLigaPromotionRelegationNotice } = resolveLaLigaPromotionRelegation(state, clubs)
  const { notice: serieAPromotionRelegationNotice } = resolveSerieAPromotionRelegation(state, clubs)
  const { notice: bundesligaPromotionRelegationNotice } = resolveBundesligaPromotionRelegation(state, clubs)
  const squads = {}
  const season = state.season + 1
  let releasedFromPlayerClub = []

  for (const id of Object.keys(state.squads)) {
    const club = clubs[id]
    // Foreign clubs have no facilities/objective/season lifecycle of their
    // own (see foreignClubs.js) - their squads stay exactly as generated,
    // never aging or taking a youth intake.
    if (club.division === 'FOREIGN') {
      squads[id] = state.squads[id]
      continue
    }
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
  const newSplIds = divisionClubIds(clubs, 'SPL')
  const newSchIds = divisionClubIds(clubs, 'SCH')
  const newLaLigaIds = divisionClubIds(clubs, 'LALIGA')
  const newSegundaIds = divisionClubIds(clubs, 'SEGUNDA')
  const newSerieAIds = divisionClubIds(clubs, 'SERIEA')
  const newSerieBIds = divisionClubIds(clubs, 'SERIEB')
  const newBundesligaIds = divisionClubIds(clubs, 'BUNDESLIGA')
  const newBundesliga2Ids = divisionClubIds(clubs, 'BUNDESLIGA2')
  const fixtures = combineFixturesByWeek(
    generateSeasonFixtures(newPlIds, SEASON_WEEKS),
    generateSeasonFixtures(newChIds, SEASON_WEEKS),
    generateSeasonFixtures(newSplIds, SEASON_WEEKS),
    generateSeasonFixtures(newSchIds, SEASON_WEEKS),
    generateSeasonFixtures(newLaLigaIds, SEASON_WEEKS),
    generateSeasonFixtures(newSegundaIds, SEASON_WEEKS),
    generateSeasonFixtures(newSerieAIds, SEASON_WEEKS),
    generateSeasonFixtures(newSerieBIds, SEASON_WEEKS),
    generateSeasonFixtures(newBundesligaIds, SEASON_WEEKS),
    generateSeasonFixtures(newBundesliga2Ids, SEASON_WEEKS),
  )
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
    scottishCup: initCupState([...newSplIds, ...newSchIds], season, SCOTTISH_CUP_SIZE),
    europe: europeanQualification ? initEuropeanCampaign(europeanQualification) : null,
    commercial: {
      sponsorshipOptions: generateSponsorshipOffers(playerClub.reputation),
      merchandiseOptions: generateMerchandiseOffers(playerClub.reputation),
    },
    lastSeasonAwards: { season: state.season, ...seasonAwards },
    careerHistory: recordSeason(state.careerHistory, {
      season: state.season,
      clubId: playerClubId,
      division: playerClubBefore.division,
      finalPosition,
      objectiveLabel: playerClubBefore.objective.label,
      objectiveMet: objectiveResult.met,
      cup: state.cup,
      scottishCup: state.scottishCup,
      outcome: 'completed',
    }),
    jobOffers: jobOfferClubIds.length > 0 ? jobOfferClubIds : null,
    screen: jobOfferClubIds.length > 0 ? 'job-offers' : 'commercial',
    internationalOffer,
    notice:
      `${objectiveResult.message} The ${state.season}/${String(state.season + 1).slice(2)} season has ended. ${promotionRelegationNotice} ${scottishPromotionRelegationNotice} ${laLigaPromotionRelegationNotice} ${serieAPromotionRelegationNotice} ${bundesligaPromotionRelegationNotice}` +
      (europeanQualification
        ? ` You've qualified for the ${europeanQualification === 'UCL' ? 'Champions League' : 'Europa League'} next season!`
        : '') +
      (internationalOffer ? ' The FA have been in touch about the England job.' : ''),
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
    divisionSize: playerLeagueClubIds(state).length,
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

function handleOfferContract(state, { playerId, wage, years, goalBonus, assistBonus }) {
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
      [state.playerClubId]: squad.map((p) =>
        p.id === playerId
          ? { ...p, wage, contractYears: years, goalBonus: Math.max(0, goalBonus ?? 0), assistBonus: Math.max(0, assistBonus ?? 0) }
          : p,
      ),
    },
    notice: result.message,
  }
}

function handleScoutPlayer(state, { playerId, clubId }) {
  const club = state.clubs[state.playerClubId]
  if (club.bankBalance < SCOUT_COST) {
    return { ...state, notice: 'Not enough in the bank to commission a scouting report.' }
  }

  const clubs = { ...state.clubs, [state.playerClubId]: { ...club, bankBalance: club.bankBalance - SCOUT_COST } }

  if (!clubId) {
    const player = state.freeAgents.find((p) => p.id === playerId)
    if (!player) return state
    return {
      ...state,
      clubs,
      freeAgents: state.freeAgents.map((p) => (p.id === playerId ? { ...p, scouted: true } : p)),
      notice: `Scouting report on ${player.name} complete.`,
    }
  }

  const squad = state.squads[clubId]
  const player = squad?.find((p) => p.id === playerId)
  if (!player) return state
  return {
    ...state,
    clubs,
    squads: { ...state.squads, [clubId]: squad.map((p) => (p.id === playerId ? { ...p, scouted: true } : p)) },
    notice: `Scouting report on ${player.name} complete.`,
  }
}

function handleRespondToPress(state, { responseType }) {
  const match = state.lastMatch
  if (!match || state.pressConferenceHandled) return state

  const playerWasHome = match.homeClubId === state.playerClubId
  const gf = playerWasHome ? match.homeGoals : match.awayGoals
  const ga = playerWasHome ? match.awayGoals : match.homeGoals
  const resultPoints = gf > ga ? 3 : gf === ga ? 1 : 0

  const { confidenceDelta, moraleDelta, message } = evaluateResponse(resultPoints, responseType)
  const club = state.clubs[state.playerClubId]
  const squad = state.squads[state.playerClubId]

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        boardConfidence: Math.max(0, Math.min(100, club.boardConfidence + confidenceDelta)),
      },
    },
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.map((p) => ({ ...p, morale: Math.max(0, Math.min(100, p.morale + moraleDelta)) })),
    },
    pressConferenceHandled: true,
    notice: message,
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
  const { netFee, payouts } = settleSellOnClauses(player, offer.fee)

  const clubs = {
    ...state.clubs,
    [state.playerClubId]: { ...club, bankBalance: club.bankBalance + netFee },
    [offer.fromClubId]: { ...buyerClub, bankBalance: buyerClub.bankBalance - offer.fee },
  }
  for (const payout of payouts) {
    clubs[payout.clubId] = { ...clubs[payout.clubId], bankBalance: clubs[payout.clubId].bankBalance + payout.amount }
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.filter((p) => p.id !== offer.playerId),
    },
    clubs,
    incomingOffers: remaining,
    notice: `Sold ${player.name} to ${CLUB_BY_ID[offer.fromClubId].name} for ${offer.fee.toLocaleString('en-GB')}.`,
  }
}

function handleMakeOffer(state, { playerId, fromClubId, fee, swapPlayerIds = [], sellOnPercent = 0 }) {
  if (!isTransferWindowOpen(state.week)) {
    return { ...state, notice: 'The transfer window is closed — you cannot buy players until it reopens.' }
  }
  const player = state.squads[fromClubId]?.find((p) => p.id === playerId)
  if (!player) return state
  const club = state.clubs[state.playerClubId]
  if (fee > club.budget || fee > club.bankBalance) {
    return { ...state, notice: 'The board will not sanction spending beyond the funds available.' }
  }

  const ownSquad = state.squads[state.playerClubId]
  const swapPlayers = swapPlayerIds.map((id) => ownSquad.find((p) => p.id === id)).filter(Boolean)
  const swapValue = swapPlayers.reduce((sum, p) => sum + estimatePlayerValue(p), 0)
  const clampedSellOn = Math.max(0, Math.min(30, sellOnPercent))

  const result = evaluateOffer(player, fee, { swapValue, sellOnPercent: clampedSellOn })
  const logEntry = { week: state.week, playerName: player.name, fee, outcome: result.accepted ? 'accepted' : 'rejected', message: result.message }

  if (!result.accepted) {
    return {
      ...state,
      transferLog: [logEntry, ...state.transferLog].slice(0, 20),
      notice: result.message,
    }
  }

  const { netFee, payouts } = settleSellOnClauses(player, fee)
  const swapIds = new Set(swapPlayers.map((p) => p.id))
  const sellerClub = state.clubs[fromClubId]

  const clubs = {
    ...state.clubs,
    [fromClubId]: { ...sellerClub, bankBalance: sellerClub.bankBalance + netFee },
    [state.playerClubId]: { ...club, budget: club.budget - fee, bankBalance: club.bankBalance - fee },
  }
  for (const payout of payouts) {
    clubs[payout.clubId] = { ...clubs[payout.clubId], bankBalance: clubs[payout.clubId].bankBalance + payout.amount }
  }

  const acquiredPlayer = {
    ...player,
    listed: false,
    scouted: true,
    sellOnClauses: clampedSellOn > 0 ? [...(player.sellOnClauses ?? []), { clubId: fromClubId, percent: clampedSellOn }] : (player.sellOnClauses ?? []),
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [fromClubId]: [...state.squads[fromClubId].filter((p) => p.id !== playerId), ...swapPlayers],
      [state.playerClubId]: [...ownSquad.filter((p) => !swapIds.has(p.id)), acquiredPlayer],
    },
    clubs,
    transferLog: [logEntry, ...state.transferLog].slice(0, 20),
    notice: result.message,
  }
}

function handleOfferPlayerToClub(state, { playerId, clubId, askingFee }) {
  if (!isTransferWindowOpen(state.week)) {
    return { ...state, notice: 'The transfer window is closed — you cannot sell players until it reopens.' }
  }
  const squad = state.squads[state.playerClubId]
  const player = squad.find((p) => p.id === playerId)
  const targetSquad = state.squads[clubId]
  if (!player || !targetSquad) return state

  const result = evaluateClubInterest(targetSquad, player, askingFee)
  const logEntry = { week: state.week, playerName: player.name, fee: askingFee, outcome: result.accepted ? 'accepted' : 'rejected', message: result.message }

  if (!result.accepted) {
    return { ...state, transferLog: [logEntry, ...state.transferLog].slice(0, 20), notice: result.message }
  }

  const club = state.clubs[state.playerClubId]
  const targetClub = state.clubs[clubId]
  const { netFee, payouts } = settleSellOnClauses(player, askingFee)

  const clubs = {
    ...state.clubs,
    [state.playerClubId]: { ...club, bankBalance: club.bankBalance + netFee },
    [clubId]: { ...targetClub, bankBalance: targetClub.bankBalance - askingFee },
  }
  for (const payout of payouts) {
    clubs[payout.clubId] = { ...clubs[payout.clubId], bankBalance: clubs[payout.clubId].bankBalance + payout.amount }
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.filter((p) => p.id !== playerId),
      [clubId]: [...targetSquad, { ...player, listed: false }],
    },
    clubs,
    transferLog: [logEntry, ...state.transferLog].slice(0, 20),
    notice: result.message,
  }
}

function handleLoanOutPlayer(state, { playerId, clubId, weeks }) {
  if (!isTransferWindowOpen(state.week)) {
    return { ...state, notice: 'The transfer window is closed — no loan deals can be done until it reopens.' }
  }
  const squad = state.squads[state.playerClubId]
  const player = squad.find((p) => p.id === playerId)
  const targetSquad = state.squads[clubId]
  if (!player || !targetSquad) return state
  if (player.injured || player.suspended) {
    return { ...state, notice: `${player.name} cannot go out on loan while unavailable.` }
  }

  const result = evaluateLoanOffer(targetSquad, player, weeks)
  if (!result.accepted) {
    return { ...state, notice: result.message }
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [state.playerClubId]: squad.filter((p) => p.id !== playerId),
      [clubId]: [...targetSquad, { ...player, loanFromClubId: state.playerClubId, loanWeeksRemaining: weeks }],
    },
    notice: result.message,
  }
}

function handleRequestLoanPlayer(state, { playerId, clubId, weeks }) {
  if (!isTransferWindowOpen(state.week)) {
    return { ...state, notice: 'The transfer window is closed — no loan deals can be done until it reopens.' }
  }
  const targetSquad = state.squads[clubId]
  const player = targetSquad?.find((p) => p.id === playerId)
  if (!player) return state
  if (player.injured || player.suspended) {
    return { ...state, notice: `${player.name} cannot go out on loan while unavailable.` }
  }

  const result = evaluateLoanRequest(targetSquad, player, weeks)
  if (!result.accepted) {
    return { ...state, notice: result.message }
  }

  return {
    ...state,
    squads: {
      ...state.squads,
      [clubId]: targetSquad.filter((p) => p.id !== playerId),
      [state.playerClubId]: [...state.squads[state.playerClubId], { ...player, loanFromClubId: clubId, loanWeeksRemaining: weeks }],
    },
    notice: result.message,
  }
}

function handleRecallLoan(state, { playerId }) {
  const clubIds = Object.keys(state.squads)
  const homeClubId = clubIds.find((id) => state.squads[id].some((p) => p.id === playerId && p.loanFromClubId === state.playerClubId))
  if (!homeClubId) return state
  const player = state.squads[homeClubId].find((p) => p.id === playerId)

  return {
    ...state,
    squads: {
      ...state.squads,
      [homeClubId]: state.squads[homeClubId].filter((p) => p.id !== playerId),
      [state.playerClubId]: [...state.squads[state.playerClubId], { ...player, loanFromClubId: null, loanWeeksRemaining: 0 }],
    },
    notice: `${player.name} has been recalled from loan.`,
  }
}

function handleSignFreeAgent(state, { playerId, contractYears }) {
  const player = state.freeAgents.find((p) => p.id === playerId)
  if (!player) return state
  const signed = { ...player, contractYears: contractYears ?? 2, listed: false, scouted: true }
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
    case 'SET_CONCESSION_PRICE':
      return {
        ...state,
        clubs: {
          ...state.clubs,
          [state.playerClubId]: { ...state.clubs[state.playerClubId], concessionPrice: action.payload.price },
        },
      }
    case 'REQUEST_BUDGET':
      return handleRequestBudget(state, action.payload)
    case 'CONFIRM_COMMERCIAL_DEALS':
      return handleConfirmCommercialDeals(state, action.payload)
    case 'RESPOND_TO_JOB_OFFER':
      return handleRespondToJobOffer(state, action.payload)
    case 'RESPOND_TO_INTERNATIONAL_OFFER':
      return {
        ...state,
        internationalOffer: false,
        international: action.payload.accept ? initInternationalJob(state.season) : state.international,
        notice: action.payload.accept ? 'You have been appointed England manager!' : 'You turned down the England job.',
      }
    case 'RESIGN_INTERNATIONAL':
      return { ...state, international: null, notice: 'You have resigned as England manager.' }
    case 'OFFER_CONTRACT':
      return handleOfferContract(state, action.payload)
    case 'MAKE_OFFER':
      return handleMakeOffer(state, action.payload)
    case 'OFFER_PLAYER_TO_CLUB':
      return handleOfferPlayerToClub(state, action.payload)
    case 'LOAN_OUT_PLAYER':
      return handleLoanOutPlayer(state, action.payload)
    case 'REQUEST_LOAN_PLAYER':
      return handleRequestLoanPlayer(state, action.payload)
    case 'RECALL_LOAN':
      return handleRecallLoan(state, action.payload)
    case 'RELEASE_PLAYER':
      return handleReleasePlayer(state, action.payload)
    case 'SCOUT_PLAYER':
      return handleScoutPlayer(state, action.payload)
    case 'RESPOND_TO_PRESS':
      return handleRespondToPress(state, action.payload)
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
      return { ...makeInitialState(), careerHistory: state.careerHistory }
    default:
      return state
  }
}

export {
  estimatePlayerValue,
  leaguePositionOf,
  resolvePromotionRelegation,
  resolveScottishPromotionRelegation,
  resolveLaLigaPromotionRelegation,
  resolveSerieAPromotionRelegation,
  resolveBundesligaPromotionRelegation,
}
