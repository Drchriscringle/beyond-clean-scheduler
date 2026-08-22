import { EUROPEAN_CLUBS } from '../data/europeanClubs.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { pickBestXI } from './lineup.js'
import { simulateMatch } from './matchSim.js'

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

export function initEuropeanCampaign(competition) {
  return { competition, roundIndex: 0, eliminated: false, champion: false, history: [] }
}

function pickOpponent(roundIndex, rng) {
  // Later rounds draw from tougher (higher-reputation) opposition.
  const minRep = Math.min(5, 2 + roundIndex)
  const pool = EUROPEAN_CLUBS.filter((c) => c.reputation >= minRep)
  const candidates = pool.length > 0 ? pool : EUROPEAN_CLUBS
  return candidates[Math.floor(rng() * candidates.length)]
}

// Plays exactly one round of the player's European campaign - a single match
// against a freshly drawn opponent, decided on penalties if level, since
// this is a single-elimination abstraction rather than a two-legged tie.
export function playEuropeanRound(europe, { playerClub, playerSquad, playerLineup, playerTactics }, rng = Math.random) {
  const opponentClub = pickOpponent(europe.roundIndex, rng)
  const opponentSquad = generateSquadForClub(opponentClub)
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
