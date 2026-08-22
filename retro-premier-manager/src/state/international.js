import { NATIONAL_TEAMS } from '../data/nationalTeams.js'
import { generateSquadForClub } from '../data/generateSquad.js'
import { pickBestXI } from './lineup.js'
import { simulateMatch } from './matchSim.js'

// International management is offered as a side role once a manager has
// proven themselves domestically. It runs alongside the club job as a
// lightweight abstraction, same as the FA Cup and European campaign: only
// the scoreline matters, and nothing about it (injuries, bookings, player
// stats) carries over to club affairs.
export const INTERNATIONAL_WEEKS = [9, 17, 27, 35]
const OFFER_CHANCE = 0.4
const ENGLAND = { id: 'england-squad', name: 'England', reputation: 5 }

export function isEligibleForInternationalJob({ reputation, wonLeagueTitle }) {
  return reputation >= 4 || wonLeagueTitle
}

export function maybeOfferInternationalJob({ alreadyHasJob, eligible, rng = Math.random }) {
  if (alreadyHasJob || !eligible) return false
  return rng() < OFFER_CHANCE
}

export function initInternationalJob(season) {
  return { appointedSeason: season, played: 0, won: 0, drawn: 0, lost: 0, form: [], lastResult: null }
}

function pickOpponent(rng) {
  return NATIONAL_TEAMS[Math.floor(rng() * NATIONAL_TEAMS.length)]
}

// Plays exactly one international fixture, reusing the player's own club
// squad, lineup and tactics as a stand-in England side - a deliberate
// simplification, since the game has no player nationalities to draw a real
// national squad from, and it means an England side's strength naturally
// reflects how well the manager's own club is playing.
export function playInternationalFixture(international, { playerSquad, playerLineup, playerTactics }, rng = Math.random) {
  const opponent = pickOpponent(rng)
  const opponentSquad = generateSquadForClub(opponent)
  const opponentLineup = pickBestXI(opponentSquad, '4-4-2')
  const englandIsHome = rng() < 0.5

  const result = simulateMatch({
    homeClub: englandIsHome ? ENGLAND : opponent,
    awayClub: englandIsHome ? opponent : ENGLAND,
    homeSquad: englandIsHome ? playerSquad : opponentSquad,
    awaySquad: englandIsHome ? opponentSquad : playerSquad,
    homeLineup: englandIsHome ? playerLineup : opponentLineup,
    awayLineup: englandIsHome ? opponentLineup : playerLineup,
    homeTactics: englandIsHome ? playerTactics : undefined,
    awayTactics: englandIsHome ? undefined : playerTactics,
    rng,
  })

  const englandGoals = englandIsHome ? result.homeGoals : result.awayGoals
  const opponentGoals = englandIsHome ? result.awayGoals : result.homeGoals
  const outcome = englandGoals > opponentGoals ? 'won' : englandGoals === opponentGoals ? 'drawn' : 'lost'

  return {
    international: {
      ...international,
      played: international.played + 1,
      won: international.won + (outcome === 'won' ? 1 : 0),
      drawn: international.drawn + (outcome === 'drawn' ? 1 : 0),
      lost: international.lost + (outcome === 'lost' ? 1 : 0),
      form: [outcome[0].toUpperCase(), ...international.form].slice(0, 5),
      lastResult: { opponent: opponent.name, englandGoals, opponentGoals, outcome },
    },
    notice: `England ${englandGoals}-${opponentGoals} ${opponent.name} (international friendly).`,
  }
}
