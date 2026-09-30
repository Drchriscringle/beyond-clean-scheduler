// Career progression. Functions take a career and mutate it in place; the UI
// clones before calling so React sees a new object.
import { buildCalendar, MONTHS, qualifierFormat, roundFormat, roundName } from './calendar.js'
import { opponentAverages, pressureBoost, simAverage, userProRating } from './difficulty.js'
import { generatePools, TOUR_CARD_POOL } from './players.js'
import { createTournament, resolveRound, roundsWon, stageFor, totalRounds, userPair } from './tournament.js'
import { gaussian, shuffle } from '../engine/rng.js'
import { simulateMatch } from '../engine/sim.js'

export const START_YEAR = 2027
export const TOUR_CARD_KEEP_RANK = 64
export const CHALLENGE_CARDS = 2
export const QSCHOOL_OOM_CARDS = 4

export function newCareer({ name, nickname, avg, difficulty = 'normal', matchLength = 'quick', caller = true, autoAdjust = true }, rng = Math.random) {
  const year = START_YEAR
  const players = generatePools(year, rng)
  players.user = { id: 'user', name: name || 'You', nickname: nickname || '', nation: null, rating: null, tour: 'challenge', money: {}, ctMoney: {}, titles: [] }
  return {
    version: 1,
    year,
    calendar: buildCalendar(year),
    eventIndex: 0,
    players,
    user: { avg: Number(avg) || 50, difficulty, autoAdjust },
    settings: { matchLength, caller },
    status: { qschool: true, cardExpiry: null, qschoolCard: false },
    qschoolPoints: {},
    results: {},
    active: null,
    news: [{ year, month: 0, text: `${name || 'You'} registers for Q-School. Win a Tour Card, or it's the Challenge Tour this year.` }],
    stats: { played: 0, won: 0, simulated: 0, legsWon: 0, legsLost: 0, darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, bestAvg: 0 },
    seasons: [],
  }
}

// ---------- rankings ----------

export function proMoney(p, year) {
  return (p.money[year] ?? 0) + (p.money[year - 1] ?? 0)
}

export function proRanking(career) {
  const y = career.year
  return Object.values(career.players)
    .filter((p) => p.tour === 'pro')
    .sort((a, b) => proMoney(b, y) - proMoney(a, y) || (b.rating ?? 0) - (a.rating ?? 0))
    .map((p) => p.id)
}

export function challengeRanking(career) {
  const y = career.year
  return Object.values(career.players)
    .filter((p) => p.tour === 'challenge')
    .sort((a, b) => (b.ctMoney[y] ?? 0) - (a.ctMoney[y] ?? 0) || (b.rating ?? 0) - (a.rating ?? 0))
    .map((p) => p.id)
}

export function rankOf(list, id) {
  const i = list.indexOf(id)
  return i < 0 ? null : i + 1
}

export function currentEvent(career) {
  return career.calendar[career.eventIndex] ?? null
}

// ---------- entry ----------

// Returns { skip } or { entrants (seed order), userIn, qualifierOpponent, reason }
export function resolveEntry(career, event, rng = Math.random) {
  const user = career.players.user
  const pros = proRanking(career)
  const ct = challengeRanking(career)
  const e = event.entry
  switch (e.type) {
    case 'qschool': {
      if (!career.status.qschool) return { skip: true }
      const field = shuffle(ct.filter((id) => id !== 'user'), rng).slice(0, event.size - 1)
      return { entrants: ['user', ...field], userIn: true, reason: 'Q-School entrant' }
    }
    case 'tour': {
      let entrants = pros.slice(0, event.size)
      if (user.tour === 'pro' && !entrants.includes('user')) entrants = [...entrants.slice(0, event.size - 1), 'user']
      return { entrants, userIn: entrants.includes('user'), reason: user.tour === 'pro' ? 'Tour Card holder' : 'Tour Card holders only' }
    }
    case 'challenge': {
      const others = ct.filter((id) => id !== 'user')
      const userIn = user.tour === 'challenge'
      const entrants = userIn ? ['user', ...others.slice(0, event.size - 1)] : others.slice(0, event.size)
      return { entrants, userIn, reason: userIn ? 'Challenge Tour member' : 'Challenge Tour members only' }
    }
    case 'open': {
      const proSlots = event.size - 16
      const ctTop = ct.slice(0, 16)
      let proList = pros.slice(0, proSlots)
      if (user.tour === 'pro' && !proList.includes('user')) proList = [...proList.slice(0, proSlots - 1), 'user']
      const entrants = [...proList, ...ctTop]
      return { entrants, userIn: entrants.includes('user'), reason: user.tour === 'pro' ? 'Tour Card holder' : entrants.includes('user') ? 'Top 16 on the Challenge Tour' : 'Needs a Tour Card or a top-16 Challenge Tour ranking' }
    }
    case 'seededQualifier': {
      const seeds = pros.slice(0, e.seeds)
      const pool = pros.slice(e.seeds).filter((id) => id !== 'user')
      const qualifiers = shuffle(pool, rng)
      if (seeds.includes('user')) {
        return { entrants: [...seeds, ...qualifiers.slice(0, event.size - e.seeds)], userIn: true, reason: `Seeded (top ${e.seeds} on the Order of Merit)` }
      }
      if (user.tour === 'pro') {
        return {
          entrants: [...seeds, ...qualifiers.slice(1, event.size - e.seeds + 1)],
          userIn: false,
          qualifierOpponent: qualifiers[0],
          reason: 'Must come through the Tour Card Holder qualifier',
        }
      }
      return { entrants: [...seeds, ...qualifiers.slice(0, event.size - e.seeds)], userIn: false, reason: 'Tour Card holders only' }
    }
    case 'top': {
      const entrants = pros.slice(0, e.n)
      const r = rankOf(pros, 'user')
      return { entrants, userIn: entrants.includes('user'), reason: entrants.includes('user') ? `Qualified: #${r} on the Order of Merit` : `Top ${e.n} on the Order of Merit only${r ? ` (you're #${r})` : ''}` }
    }
    case 'worlds': {
      const ctSpots = ct.slice(0, CHALLENGE_CARDS)
      const entrants = [...pros.slice(0, event.size - ctSpots.length), ...ctSpots]
      const userIn = entrants.includes('user')
      return { entrants, userIn, reason: userIn ? (user.tour === 'pro' ? 'Qualified on the Order of Merit' : 'Qualified via the Challenge Tour') : `Top ${event.size - CHALLENGE_CARDS} on the Order of Merit or top ${CHALLENGE_CARDS} on the Challenge Tour` }
    }
    default:
      return { skip: true }
  }
}

// ---------- event flow ----------

export function startEvent(career, rng = Math.random) {
  const event = currentEvent(career)
  const entry = resolveEntry(career, event, rng)
  if (entry.skip) {
    career.eventIndex++
    return null
  }
  career.active = {
    eventId: event.id,
    entry,
    tournament: createTournament(event, entry.entrants, rng),
    qualifier: entry.qualifierOpponent ? { opponent: entry.qualifierOpponent, result: null } : null,
    userLog: [],
    live: null,
  }
  return career.active
}

function isUserEvent(career, event, rng) {
  const entry = resolveEntry(career, event, rng)
  return !entry.skip && (entry.userIn || !!entry.qualifierOpponent)
}

// What the user has to do next in the active event.
export function nextUserTask(career) {
  const a = career.active
  if (!a) return null
  if (a.qualifier && !a.qualifier.result) return { kind: 'qualifier', opponent: a.qualifier.opponent }
  const t = a.tournament
  if (t.finished) return { kind: 'finished' }
  const up = userPair(t)
  if (up && up.opponent) return { kind: 'round', opponent: up.opponent, round: t.round }
  return { kind: 'spectate' }
}

// Set up a live match against the next opponent (averages fixed at the oche).
export function prepareLiveMatch(career, rng = Math.random) {
  const task = nextUserTask(career)
  const event = currentEvent(career)
  if (!task || (task.kind !== 'qualifier' && task.kind !== 'round')) return null
  const round = task.kind === 'qualifier' ? 0 : task.round
  const format = task.kind === 'qualifier' ? qualifierFormat(career.settings.matchLength) : roundFormat(event, round, career.settings.matchLength)
  const opp = career.players[task.opponent]
  const avgs = opponentAverages(career, opp.rating, { round: task.kind === 'qualifier' ? 0 : round, tier: event.tier }, rng)
  const stage = task.kind === 'qualifier' ? 'Qualifier' : roundName(career.active.tournament.size, round)
  career.active.live = { kind: task.kind, opponent: task.opponent, format, expectedAvg: avgs.expected, actualAvg: avgs.actual, stage, match: null }
  return career.active.live
}

function avgFor(career, rng) {
  return (id) => simAverage(career, id, rng)
}

function recordUserStats(career, result) {
  const s = career.stats
  if (result.userWon) s.won++
  s.legsWon += result.legs[0]
  s.legsLost += result.legs[1]
  if (result.simulated) {
    s.simulated++
    return
  }
  s.played++
  const st = result.userStats
  s.darts += st.darts
  s.points += st.points
  s.s180 += st.s180
  s.s140 += st.s140
  s.s100 += st.s100
  s.checkouts += st.checkouts
  s.highCheckout = Math.max(s.highCheckout, st.highCheckout)
  s.bestAvg = Math.max(s.bestAvg, Math.round(result.userAvg * 100) / 100)
  if (career.user.autoAdjust && st.darts >= 24) {
    career.user.avg = Math.round((career.user.avg * 0.75 + result.userAvg * 0.25) * 10) / 10
  }
}

// result: { userWon, score:[u,o], legs:[u,o], userAvg, oppAvg, userStats?, simulated }
export function submitUserResult(career, result, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  const task = nextUserTask(career)
  recordUserStats(career, result)
  const opp = career.players[task.opponent]
  const stage = task.kind === 'qualifier' ? 'Qualifier' : roundName(a.tournament.size, task.round)
  a.userLog.push({ stage, opponent: task.opponent, userWon: result.userWon, score: result.score, userAvg: result.userAvg, oppAvg: result.oppAvg, simulated: !!result.simulated, sets: !!(a.live?.format?.sets) })
  a.live = null
  if (task.kind === 'qualifier') {
    a.qualifier.result = result
    if (result.userWon) {
      // Take the place of the last qualifier in the draw.
      const replaced = a.entry.entrants[a.entry.entrants.length - 1]
      for (const pair of a.tournament.rounds[0]) {
        const i = pair.indexOf(replaced)
        if (i >= 0) pair[i] = 'user'
      }
      career.news.unshift({ year: career.year, month: event.month, text: `Qualified for ${event.name} with a win over ${opp.name}.` })
    }
    return
  }
  resolveRound(a.tournament, event, { avgFor: avgFor(career, rng), matchLength: career.settings.matchLength, rng, userResult: result })
}

export function simulateUserMatch(career, rng = Math.random) {
  const task = nextUserTask(career)
  const event = currentEvent(career)
  const format = task.kind === 'qualifier' ? qualifierFormat(career.settings.matchLength) : roundFormat(event, task.round, career.settings.matchLength)
  const boost = task.kind === 'qualifier' ? 0 : pressureBoost(task.round, event.tier)
  const sim = simulateMatch(userProRating(career) + gaussian(rng) * 3, career.players[task.opponent].rating + boost + gaussian(rng) * 3, format, rng)
  submitUserResult(career, { userWon: sim.winner === 0, score: sim.score, legs: sim.score, userAvg: sim.averages[0], oppAvg: sim.averages[1], simulated: true }, rng)
}

// Play out everything that doesn't involve the user until they have a match (or the event ends).
export function simulateUntilUserMatch(career, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  while (!a.tournament.finished) {
    const task = nextUserTask(career)
    if (task.kind === 'round' || task.kind === 'qualifier') return
    resolveRound(a.tournament, event, { avgFor: avgFor(career, rng), matchLength: career.settings.matchLength, rng })
  }
}

export function finishEvent(career, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  const t = a.tournament
  const y = career.year
  const moneyKey = event.tour === 'challenge' ? 'ctMoney' : 'money'
  const entrants = new Set(t.rounds[0].flat().filter(Boolean))
  for (const id of entrants) {
    const stage = stageFor(t, id)
    const prize = stage === null ? 0 : (event.prizes[stage] ?? 0)
    const p = career.players[id]
    if (prize) p[moneyKey][y] = (p[moneyKey][y] ?? 0) + prize
    if (event.tour === 'qschool') career.qschoolPoints[id] = (career.qschoolPoints[id] ?? 0) + Math.max(0, roundsWon(t, id) - 1)
  }
  const champ = career.players[t.champion]
  if (champ) champ.titles.push(`${y} ${event.name}`)

  const userStage = entrants.has('user') ? stageFor(t, 'user') : null
  const userPrize = userStage === null ? 0 : (event.prizes[userStage] ?? 0)
  let resultText = null
  if (entrants.has('user')) {
    const reached = userStage === 0 ? 'Champion!' : userStage === 1 ? 'Runner-up' : `Lost in the ${roundName(t.size, t.eliminated.user).replace('Last', 'last')}`
    resultText = reached
    career.news.unshift({ year: y, month: event.month, text: `${event.name}: ${reached}${userPrize ? ` (£${userPrize.toLocaleString()})` : ''}. Winner: ${champ?.name ?? '—'}.` })
  } else if (a.qualifier?.result && !a.qualifier.result.userWon) {
    resultText = 'Lost in qualifying'
    career.news.unshift({ year: y, month: event.month, text: `${event.name}: lost in qualifying. Winner: ${champ?.name ?? '—'}.` })
  } else if (event.tier >= 2) {
    career.news.unshift({ year: y, month: event.month, text: `${champ?.name ?? '—'} wins ${event.name}.` })
  }

  // Q-School: reaching a day's final earns a card; otherwise the Order of Merit decides after day 4.
  if (event.tour === 'qschool' && entrants.has('user')) {
    if (userStage !== null && userStage <= 1) awardQschoolCard(career, `Reached the Day ${event.qschoolDay} final`)
    else if (event.qschoolDay === 4) {
      const rating = (id) => (id === 'user' ? userProRating(career) : career.players[id].rating)
      const ranking = Object.keys(career.qschoolPoints).sort((x, z) => career.qschoolPoints[z] - career.qschoolPoints[x] || rating(z) - rating(x))
      const pos = rankOf(ranking, 'user')
      if (pos <= QSCHOOL_OOM_CARDS) awardQschoolCard(career, `Finished #${pos} on the Q-School Order of Merit`)
      else {
        career.status.qschool = false
        career.news.unshift({ year: y, month: 0, text: `No Tour Card this time (#${pos} on the Q-School Order of Merit). It's the Challenge Tour for ${y}: finish top ${CHALLENGE_CARDS} to earn a card.` })
      }
    }
  }

  career.results[event.id] = { champion: t.champion, user: resultText, prize: userPrize }
  career.lastResult = { eventName: event.name, text: resultText, prize: userPrize, champion: t.champion, userLog: a.userLog }
  career.active = null
  career.eventIndex++
  if (career.eventIndex >= career.calendar.length) endSeason(career, rng)
}

function awardQschoolCard(career, why) {
  const user = career.players.user
  user.tour = 'pro'
  career.status.qschool = false
  career.status.qschoolCard = true
  career.status.cardExpiry = career.year + 1
  career.news.unshift({ year: career.year, month: 0, text: `TOUR CARD WON! ${why}. Your card runs to the end of ${career.year + 1}.` })
}

// Run every event the user isn't in until one they are in (or the season ends).
export function advance(career, rng = Math.random) {
  const startYear = career.year
  const simulated = []
  while (career.year === startYear) {
    const event = currentEvent(career)
    if (!event) break
    if (isUserEvent(career, event, rng)) {
      if (!career.active) startEvent(career, rng)
      return { simulated, stoppedAt: event.id }
    }
    const started = startEvent(career, rng)
    if (!started) continue
    simulateUntilUserMatch(career, rng)
    simulated.push(event.name)
    finishEvent(career, rng)
  }
  return { simulated, seasonEnded: true }
}

// ---------- season end ----------

export function endSeason(career, rng = Math.random) {
  const y = career.year
  const user = career.players.user
  const pros = proRanking(career)
  const ct = challengeRanking(career)
  const summary = {
    year: y,
    tour: user.tour,
    proRank: rankOf(pros, 'user'),
    ctRank: rankOf(ct, 'user'),
    money: (user.money[y] ?? 0) + (user.ctMoney[y] ?? 0),
    titles: user.titles.filter((t) => t.startsWith(`${y} `)),
    outcome: '',
  }
  let userDropped = false
  let userPromoted = false
  if (user.tour === 'challenge') {
    if (summary.ctRank && summary.ctRank <= CHALLENGE_CARDS) {
      user.tour = 'pro'
      career.status.cardExpiry = y + 2
      career.status.qschool = false
      userPromoted = true
      summary.outcome = `Finished #${summary.ctRank} on the Challenge Tour: Tour Card won for ${y + 1}–${y + 2}!`
    } else {
      career.status.qschool = true
      summary.outcome = `Finished #${summary.ctRank ?? '—'} on the Challenge Tour. Back to Q-School in January.`
    }
  } else if (career.status.cardExpiry === y) {
    if (summary.proRank <= TOUR_CARD_KEEP_RANK) {
      career.status.cardExpiry = y + 2
      summary.outcome = `#${summary.proRank} on the Order of Merit: Tour Card renewed to the end of ${y + 2}.`
    } else {
      user.tour = 'challenge'
      career.status.qschool = true
      career.status.cardExpiry = null
      userDropped = true
      summary.outcome = `#${summary.proRank} on the Order of Merit, outside the top ${TOUR_CARD_KEEP_RANK}. Tour Card lost: back to Q-School.`
    }
  } else {
    summary.outcome = `#${summary.proRank} on the Order of Merit. Card secure until the end of ${career.status.cardExpiry}.`
  }

  // AI churn: the weakest pros drop to the Challenge Tour, the best Challenge Tour players step up.
  const aiPros = pros.filter((id) => id !== 'user')
  const demote = aiPros.slice(Math.max(0, TOUR_CARD_POOL - 16 - (userPromoted ? 1 : 0) + (userDropped ? 1 : 0)))
  for (const id of demote) career.players[id].tour = 'challenge'
  const promote = ct.filter((id) => id !== 'user').slice(0, TOUR_CARD_POOL - (aiPros.length - demote.length))
  for (const id of promote) career.players[id].tour = 'pro'

  for (const p of Object.values(career.players)) {
    if (p.id === 'user') continue
    p.rating = Math.round(Math.max(55, Math.min(106, p.rating + gaussian(rng) * 1.5)) * 10) / 10
  }

  career.seasons.push(summary)
  career.news.unshift({ year: y, month: 11, text: `SEASON ${y} REVIEW: ${summary.outcome}` })
  career.year = y + 1
  career.calendar = buildCalendar(y + 1)
  career.eventIndex = 0
  career.qschoolPoints = {}
  career.results = {}
  career.status.qschoolCard = false
  career.seasonEnded = summary
}

export function monthName(i) {
  return MONTHS[i]
}

export { totalRounds }
