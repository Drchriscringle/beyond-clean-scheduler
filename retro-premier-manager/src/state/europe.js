import { FOREIGN_CLUBS } from '../data/foreignClubs.js'
import { LA_LIGA_CLUBS } from '../data/laLigaClubs.js'
import { SERIE_A_CLUBS } from '../data/serieAClubs.js'
import { BUNDESLIGA_CLUBS } from '../data/bundesligaClubs.js'
import { LIGUE_1_CLUBS } from '../data/ligue1Clubs.js'
import { EREDIVISIE_CLUBS } from '../data/eredivisieClubs.js'
import { PRIMEIRA_LIGA_CLUBS } from '../data/primeiraLigaClubs.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { pickBestXI } from './lineup.js'
import { simulateMatch } from './matchSim.js'

// European opponents are drawn from the shallow foreign pool (see
// foreignClubs.js) plus every other fully-simulated top-flight league in
// the game - La Liga, Serie A, the Bundesliga, Ligue 1, the Eredivisie and
// the Primeira Liga all have real squads of their own now, so a Champions
// League/Europa League run can pit the player against one of those
// divisions' own clubs directly, not just the shallow pool. Second-tier
// divisions (Segunda/Serie B/2.
// Bundesliga/Ligue 2/Eerste Divisie/Liga Portugal 2) aren't eligible -
// continental competition is a top-flight-only affair - and a manager's
// own top flight is excluded too, so a La Liga club never draws another La
// Liga club in this abstraction.
const CONTINENTAL_TOP_FLIGHTS = [LA_LIGA_CLUBS, SERIE_A_CLUBS, BUNDESLIGA_CLUBS, LIGUE_1_CLUBS, EREDIVISIE_CLUBS, PRIMEIRA_LIGA_CLUBS]

export function europeanOpponentPool(playerDivision) {
  const topFlightClubs = CONTINENTAL_TOP_FLIGHTS.flat().filter((c) => c.division !== playerDivision)
  return [...FOREIGN_CLUBS, ...topFlightClubs]
}

// Only the Premier League's top 6 qualify, and only the player's own run
// through the bracket is tracked - the game doesn't simulate a full European
// field, so nobody else's campaign matters to anything the player can see.
export const EURO_ROUND_NAMES = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']
// Spread across the season on weeks that don't clash with the FA Cup's own
// CUP_ROUND_WEEKS [4, 10, 16, 22, 30].
export const EURO_ROUND_WEEKS = [6, 14, 24, 34]

const PRIZE_MONEY = {
  UCL: [4_000_000, 6_000_000, 10_000_000, 16_000_000],
  UEL: [1_500_000, 2_500_000, 4_000_000, 7_000_000],
}
const WINNER_BONUS = { UCL: 25_000_000, UEL: 10_000_000 }

export function qualificationForPosition(position) {
  if (position <= 4) return 'UCL'
  if (position <= 6) return 'UEL'
  return null
}

// The Scottish Premiership gets a much smaller European allocation than the
// Premier League in real life - only the champion and runner-up, not a
// top-6 spread.
export function scottishQualificationForPosition(position) {
  if (position === 1) return 'UCL'
  if (position === 2) return 'UEL'
  return null
}

export function initEuropeanCampaign(competition) {
  return { competition, roundIndex: 0, eliminated: false, champion: false, history: [] }
}

function pickOpponent(roundIndex, rng, playerDivision) {
  // Later rounds draw from tougher (higher-reputation) opposition.
  const minRep = Math.min(5, 2 + roundIndex)
  const opponentPool = europeanOpponentPool(playerDivision)
  const pool = opponentPool.filter((c) => c.reputation >= minRep)
  const candidates = pool.length > 0 ? pool : opponentPool
  return candidates[Math.floor(rng() * candidates.length)]
}

// Plays exactly one round of the player's European campaign - a single match
// against a freshly drawn opponent, decided on penalties if level, since
// this is a single-elimination abstraction rather than a two-legged tie.
// `allSquads`, when supplied, is used to pull the opponent's persistent
// squad (so a player weakened by a transfer-window sale shows up weakened
// here too) - it falls back to a freshly generated one otherwise.
export function playEuropeanRound(europe, { playerClub, playerSquad, playerLineup, playerTactics, allSquads }, rng = Math.random) {
  const opponentClub = pickOpponent(europe.roundIndex, rng, playerClub.division)
  const opponentSquad = allSquads?.[opponentClub.id] ?? generateSquadForClub(opponentClub)
  const opponentLineup = pickBestXI(opponentSquad, '4-4-2')
  const playerIsHome = rng() < 0.5

  const result = simulateMatch({
    homeClub: playerIsHome ? playerClub : opponentClub,
    awayClub: playerIsHome ? opponentClub : playerClub,
    homeSquad: playerIsHome ? playerSquad : opponentSquad,
    awaySquad: playerIsHome ? opponentSquad : playerSquad,
    homeLineup: playerIsHome ? playerLineup : opponentLineup,
    awayLineup: playerIsHome ? opponentLineup : playerLineup,
    homeTactics: playerIsHome ? playerTactics : undefined,
    awayTactics: playerIsHome ? undefined : playerTactics,
    rng,
  })

  const playerGoals = playerIsHome ? result.homeGoals : result.awayGoals
  const opponentGoals = playerIsHome ? result.awayGoals : result.homeGoals
  const wonOnPens = playerGoals === opponentGoals && rng() < 0.5
  const won = playerGoals > opponentGoals || wonOnPens
  const scoreline = `${playerGoals}-${opponentGoals}${playerGoals === opponentGoals ? ' (on penalties)' : ''}`

  const roundName = EURO_ROUND_NAMES[europe.roundIndex]
  const compName = europe.competition === 'UCL' ? 'Champions League' : 'Europa League'
  const prize = PRIZE_MONEY[europe.competition][europe.roundIndex]
  const isFinal = europe.roundIndex === EURO_ROUND_NAMES.length - 1
  const historyEntry = { round: roundName, opponent: opponentClub.name, playerGoals, opponentGoals, won }

  if (!won) {
    return {
      europe: { ...europe, eliminated: true, history: [...europe.history, historyEntry] },
      prize,
      notice: `${compName} ${roundName}: Lost ${scoreline} to ${opponentClub.name} — eliminated.`,
    }
  }

  const bonus = isFinal ? WINNER_BONUS[europe.competition] : 0
  return {
    europe: { ...europe, roundIndex: europe.roundIndex + 1, champion: isFinal, history: [...europe.history, historyEntry] },
    prize: prize + bonus,
    notice: isFinal
      ? `${compName} FINAL: WON ${scoreline} vs ${opponentClub.name} — Champions of Europe!`
      : `${compName} ${roundName}: Won ${scoreline} vs ${opponentClub.name} — through to the next round!`,
  }
}
