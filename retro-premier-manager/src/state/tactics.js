import { FORMATIONS } from '../data/formations.js'

// Playing styles nudge the match engine's goal expectancy: forMult scales a
// team's own scoring, againstMult scales what the opponent scores against
// them (an aggressive style leaks more at the back; a defensive one concedes
// less at some cost to its own threat).
export const PLAYING_STYLES = {
  balanced: { label: 'Balanced', forMult: 1.0, againstMult: 1.0 },
  attacking: { label: 'Attacking', forMult: 1.15, againstMult: 1.12 },
  defensive: { label: 'Defensive', forMult: 0.85, againstMult: 0.8 },
  possession: { label: 'Possession', forMult: 1.05, againstMult: 0.95 },
  'route-one': { label: 'Route One', forMult: 1.08, againstMult: 1.05 },
}

export const PLAYING_STYLE_NAMES = Object.keys(PLAYING_STYLES)

const FORMATION_MID_WEIGHT = 0.02
const FORMATION_ATT_WEIGHT = 0.018
const FORMATION_SHAPE_CAP = 0.15

// A team's formation nudges its own goal expectancy a little based on how
// its midfield/attack numbers compare to the opponent's shape - an extra
// midfielder (e.g. 3-5-2 vs 4-4-2) can overload the opposition's engine
// room, and a lone striker (e.g. 4-5-1) has fewer outlets against a back
// three. Deliberately a simple formula rather than a hand-authored matchup
// table for every formation pair, which would only get harder to keep
// balanced as more formations are added.
export function formationShapeMultiplier(ownFormation, oppFormation) {
  const own = FORMATIONS[ownFormation]
  const opp = FORMATIONS[oppFormation]
  if (!own || !opp) return 1
  const midEdge = (own.MF - opp.MF) * FORMATION_MID_WEIGHT
  const attEdge = (own.FW - opp.DF) * FORMATION_ATT_WEIGHT
  return 1 + Math.max(-FORMATION_SHAPE_CAP, Math.min(FORMATION_SHAPE_CAP, midEdge + attEdge))
}

function bestOf(players, attr) {
  if (players.length === 0) return null
  return [...players].sort((a, b) => (attr ? b.attributes[attr] - a.attributes[attr] : b.ability - a.ability))[0]
}

// Sensible auto-picked defaults for a freshly assembled starting XI: the
// best outfield player wears the armband, the best shooter takes penalties,
// the best passer takes free-kicks and corners.
export function defaultTactics(squad, startingXI) {
  const xi = (startingXI ?? []).map((id) => squad.find((p) => p.id === id)).filter(Boolean)
  const outfield = xi.filter((p) => p.position !== 'GK')
  const captain = bestOf(outfield.length > 0 ? outfield : xi, null)
  const penaltyTaker = bestOf(outfield, 'shooting') ?? captain
  const setPieceTaker = bestOf(outfield, 'passing') ?? captain

  return {
    captainId: captain?.id ?? null,
    penaltyTakerId: penaltyTaker?.id ?? null,
    freeKickTakerId: setPieceTaker?.id ?? null,
    cornerTakerId: setPieceTaker?.id ?? null,
    playingStyle: 'balanced',
  }
}
