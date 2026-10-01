// "Down the Pub": practice against the regulars at your local. Nothing here touches the
// career; progress is saved separately in the browser.
import { fastMatch } from './engine/fastsim.js'
import { shuffle } from './engine/rng.js'

const KEY = 'pdt-pub-v1'

export const REGULARS = [
  { id: 'kieran', name: 'Young Kieran', nickname: 'The Apprentice', avg: 25, line: 'Only been throwing six weeks, but he\'s keen.' },
  { id: 'sid', name: 'Old Sid', nickname: 'The Fossil', avg: 30, line: 'Been sat on the same stool since 1974.' },
  { id: 'maureen', name: 'Maureen', nickname: 'Bingo Queen', avg: 34, line: 'Plays between the bingo games. Never misses tops.' },
  { id: 'dave', name: 'Big Dave', nickname: 'The Wardrobe', avg: 38, line: 'Blocks the whole board when he steps up.' },
  { id: 'tony', name: 'Tony the Landlord', nickname: 'Last Orders', avg: 42, line: 'His pub, his board, his rules.' },
  { id: 'shaz', name: 'Shaz', nickname: 'The Barmaid Assassin', avg: 46, line: 'Pulls a pint and a ton-forty with the same hand.' },
  { id: 'pete', name: 'Pete the Postie', nickname: 'First Class', avg: 50, line: 'Always delivers. Especially on double sixteen.' },
  { id: 'mick', name: 'Mad Mick', nickname: 'The Hurricane', avg: 54, line: 'Throws like the pub\'s on fire.' },
  { id: 'gary', name: 'Captain Gary', nickname: 'Skipper', avg: 58, line: 'Pub team captain for twenty years.' },
  { id: 'legend', name: 'Ray', nickname: 'The Legend', avg: 64, line: 'Played county in the eighties. Still has the shirt.' },
]

export const KNOCKOUT_LEVELS = {
  easy: { label: 'Quiet Tuesday', ids: ['kieran', 'sid', 'maureen', 'dave', 'tony', 'shaz', 'pete'] },
  regular: { label: 'Friday night', ids: ['maureen', 'dave', 'tony', 'shaz', 'pete', 'mick', 'gary'] },
  tough: { label: 'League night', ids: ['tony', 'shaz', 'pete', 'mick', 'gary', 'legend', 'dave'] },
}

export const regular = (id) => REGULARS.find((r) => r.id === id)

export function loadPub() {
  try {
    return { pubName: 'The Bullseye Arms', ladder: 0, wins: 0, losses: 0, knockoutTitles: 0, knockout: null, beaten: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { pubName: 'The Bullseye Arms', ladder: 0, wins: 0, losses: 0, knockoutTitles: 0, knockout: null, beaten: {} }
  }
}

export function savePub(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

export function startKnockout(level, rng = Math.random) {
  const p = loadPub()
  const field = shuffle(['you', ...KNOCKOUT_LEVELS[level].ids], rng)
  p.knockout = { level, round: 0, pairs: [[field[0], field[1]], [field[2], field[3]], [field[4], field[5]], [field[6], field[7]]], log: [], out: false, champion: null }
  savePub(p)
  return p
}

export function knockoutOpponent(ko) {
  if (!ko || ko.out || ko.champion) return null
  const pair = ko.pairs.find((x) => x.includes('you'))
  return pair ? pair.find((x) => x !== 'you') : null
}

const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final']
export const koRoundName = (r) => ROUND_NAMES[r] ?? 'Final'

// Record a finished pub match. cfg: { kind: 'ladder' | 'knockout' | 'friendly', id }
export function recordPubResult(cfg, result, rng = Math.random) {
  const p = loadPub()
  if (!result || result === 'pause') return p
  const won = result.userWon
  if (won) p.wins++
  else p.losses++
  if (won) p.beaten[cfg.id] = (p.beaten[cfg.id] ?? 0) + 1
  if (cfg.kind === 'ladder' && won) {
    const idx = REGULARS.findIndex((r) => r.id === cfg.id)
    if (idx === p.ladder) p.ladder = Math.min(REGULARS.length, p.ladder + 1)
  }
  if (cfg.kind === 'knockout' && p.knockout) {
    const ko = p.knockout
    ko.log.push({ round: ko.round, opponent: cfg.id, won, score: result.score })
    const winners = ko.pairs.map(([a, b]) => {
      if (a === 'you' || b === 'you') return won ? 'you' : a === 'you' ? b : a
      return fastMatch(regular(a).avg, regular(b).avg, { legs: 2, sets: 0 }, rng).winner === 0 ? a : b
    })
    if (!won) ko.out = true
    if (winners.length === 1) {
      ko.champion = winners[0]
      if (ko.champion === 'you') p.knockoutTitles++
    } else {
      ko.pairs = []
      for (let i = 0; i < winners.length; i += 2) ko.pairs.push([winners[i], winners[i + 1]])
      ko.round++
    }
    // If you're out, play the rest of the night out.
    while (ko.out && !ko.champion) {
      const w = ko.pairs.map(([a, b]) => (fastMatch(regular(a).avg, regular(b).avg, { legs: 2, sets: 0 }, rng).winner === 0 ? a : b))
      if (w.length === 1) ko.champion = w[0]
      else {
        ko.pairs = []
        for (let i = 0; i < w.length; i += 2) ko.pairs.push([w[i], w[i + 1]])
        ko.round++
      }
    }
  }
  savePub(p)
  return p
}
