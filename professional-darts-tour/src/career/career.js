// Career progression. Functions mutate the career passed in; the UI clones first.
import { BIG_FISH_BONUS, COMPETITIONS, NINE_DART_BONUS, QSCHOOL_CARDS, QSCHOOL_FEE } from './data/competitions.js'
import { seasonSchedule } from './data/schedule.js'
import { opponentAverage, simAverage, suggestedRange } from './difficulty.js'
import { buildField, eligibility, isPro, plTable } from './entry.js'
import { acceptSponsor, ledger, milestone, monthlySponsorship, negotiateSponsor, paySponsors, titleBonuses, travelCost } from './finance.js'
import { formatLabel, prizeFund, qualifierFormat, roundFormat, roundName, scaledPrizes } from './formats.js'
import { dateStr, news, resolveMail, sendMail } from './inbox.js'
import { buildArticle, PAPER } from './newspaper.js'
import { checkAchievements } from './achievements.js'
import { afterMatch, maybePress } from './media.js'
import { agePlayers, generatePools, nationName, TOUR_CARDS, UK_QSCHOOL_NATIONS } from './players.js'
import { addEarnings, prune, ranking, rankOf } from './rankings.js'
import { createGroups, createKnockout, createStaged, findPair, resolveRound, roundsWon, stageFor } from './tournament.js'
import { fastMatch } from '../engine/fastsim.js'
import { gaussian, shuffle } from '../engine/rng.js'
import { simulateMatch } from '../engine/sim.js'

export const START_YEAR = 2027
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const money = (n) => `£${Math.round(n).toLocaleString()}`

export function touch(career) {
  career.moneyStamp = (career.moneyStamp ?? 0) + 1
}

export function newCareer(opts, rng = Math.random) {
  const year = START_YEAR
  const players = generatePools(year, rng)
  players.user = {
    id: 'user', name: opts.name || 'Player One', nickname: opts.nickname || '', nation: opts.nation || 'ENG',
    age: Number(opts.age) || 25, gender: opts.gender === 'f' ? 'f' : 'm', walkOn: opts.walkOn || '', rating: null, tour: 'challenge', cardExpiry: null, earn: {}, titles: [],
  }
  const career = {
    version: 2,
    year,
    calendar: [],
    eventIndex: 0,
    players,
    user: {
      avg: Number(opts.avg) || 50,
      autoAdjust: opts.autoAdjust ?? true,
      difficulty: {
        mode: opts.difficultyMode ?? 'range',
        fixedAvg: Number(opts.fixedAvg) || Number(opts.avg) || 50,
        rangeMin: Number(opts.rangeMin) || suggestedRange(Number(opts.avg) || 50)[0],
        rangeMax: Number(opts.rangeMax) || suggestedRange(Number(opts.avg) || 50)[1],
      },
      trackDoubles: opts.trackDoubles ?? true,
    },
    settings: { matchLength: opts.matchLength ?? 'quick', caller: opts.caller ?? true, autoEnter: false, crowd: true, walkOns: true, voice: false, bigKeys: false, leftHanded: false },
    seenTutorial: false,
    entries: {},
    reserveCalls: {},
    inbox: [],
    mailSeq: 0,
    news: [],
    honours: [],
    results: {},
    finance: { bank: 1500, ledger: [] },
    sponsors: [],
    offers: {},
    milestones: {},
    h2h: {},
    stats: { played: 0, won: 0, simulated: 0, legsWon: 0, legsLost: 0, darts: 0, points: 0, s180: 0, s140: 0, s100: 0, checkouts: 0, highCheckout: 0, bestAvg: 0, dartsAtDouble: 0, trackedCheckouts: 0, doubles: {}, nineDarters: 0 },
    seasons: [],
    lastSeason: {},
    qschool: null,
    pl: null,
    active: null,
    lastMonth: 0,
    moneyStamp: 0,
    prizeScale: 1,
    records: { bestIn: {}, peakRank: null, most180s: null, lowestLeg: null, highestCheckout: null, bestAverage: null },
    shirt: null,
    face: null,
  }
  sendMail(career, {
    from: 'pdpa',
    date: `${year}-01-01`,
    subject: 'Welcome to the professional circuit',
    body: `Welcome ${players.user.name}. Everything starts at Q-School in January: win a two-year Tour Card and you can play every Players Championship, the UK Open and the European Tour qualifiers. Miss out and you'll play the Challenge Tour, where the top two earn cards. Entry confirmations, draws and prize money statements will arrive here.`,
  })
  startSeason(career, rng)
  return career
}

// ---------- season setup ----------

function startSeason(career, rng) {
  const y = career.year
  career.calendar = seasonSchedule().map((e, i) => ({ ...e, id: `${y}-${i}`, year: y, tier: COMPETITIONS[e.key].tier }))
  career.eventIndex = 0
  career.entries = {}
  career.reserveCalls = {}
  career.results = {}
  career.lastMonth = 0
  const user = career.players.user
  const school = UK_QSCHOOL_NATIONS.includes(user.nation) ? 'UK' : 'EU'
  const exempt = (career.lastSeason.lostCards ?? []).includes('user') || (career.lastSeason.ct ?? []).slice(0, 16).includes('user') || (career.lastSeason.dt ?? []).slice(0, 16).includes('user')
  const free = (career.lastSeason.ct ?? []).slice(0, 16).includes('user') || (career.lastSeason.dt ?? []).slice(0, 16).includes('user') || (career.lastSeason.wo ?? []).includes('user')
  career.qschool = { year: y, school, registered: user.tour === 'pro' ? false : null, exempt, free, userStage: null, done: false, finalField: [], firstPoints: {}, finalPoints: {}, cardWinners: [], reserveList: career.qschool?.reserveList ?? [] }
  if (user.tour !== 'pro') {
    const fee = free ? 0 : QSCHOOL_FEE[school]
    sendMail(career, {
      from: 'qschool',
      key: `qs-${y}`,
      date: `${y}-01-02`,
      subject: `${school === 'UK' ? 'UK' : 'European'} Q-School ${y}: registration`,
      body: `${school === 'UK' ? 'UK Q-School is at Arena MK, Milton Keynes' : 'European Q-School is at Wunderland Kalkar'}: First Stage 5–7 January, Final Stage 8–11 January. Entry fee: ${fee ? money(fee) : 'free (thanks to your ranking on last season’s Challenge, Development or Women’s Series tour)'}. ${exempt ? 'You are exempt to the Final Stage.' : 'You start in the First Stage.'} Both finalists on each Final Stage day win a two-year Tour Card, and the rest of the ${QSCHOOL_CARDS[school]} cards go to the top of the Q-School Order of Merit. Entering Q-School also makes you a Challenge Tour member for the year.`,
      actions: [{ label: `Register${fee ? ` (${money(fee)})` : ''}`, action: 'registerQschool' }, { label: 'Skip this year', action: 'skipQschool' }],
    })
  }
  if (y > START_YEAR) {
    const growth = 0.04 + rng() * 0.05
    career.prizeScale = (career.prizeScale ?? 1) * (1 + growth)
    const worlds = scaledPrizes('worlds', career.prizeScale).prizes[0]
    const text = `PDC announces a ${Math.round(growth * 100)}% rise in prize money for ${y}. The World Championship fund is now ${money(prizeFund('worlds', career.prizeScale))} with ${money(worlds)} to the winner; Players Championships are worth ${money(prizeFund('pc', career.prizeScale))} each.`
    news(career, text, career.calendar[0])
    sendMail(career, { from: 'office', date: `${y}-01-01`, subject: `Prize money for ${y}`, body: text })
  }
  setupPremierLeague(career, rng)
  news(career, `PDC confirms the ${y} calendar: 34 Players Championships, 15 European Tour events, 24 Challenge and 24 Development Tour events, and a ${money(prizeFund('worlds', career.prizeScale ?? 1))} World Championship.`, career.calendar[0])
}

function roundRobin(n) {
  const idx = Array.from({ length: n }, (_, i) => i)
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) pairs.push([idx[i], idx[n - 1 - i]])
    rounds.push(pairs)
    idx.splice(1, 0, idx.pop())
  }
  return rounds
}

function setupPremierLeague(career, rng) {
  const oom = ranking(career, 'oom')
  const top4 = oom.slice(0, 4)
  // Four wildcards: the PDC picks from in-form players just below.
  const wild = shuffle(oom.slice(4, 16), rng).sort((a, b) => ratingOf(career, b) - ratingOf(career, a) + (rng() - 0.5) * 6).slice(0, 4)
  const players = [...top4, ...wild]
  career.pl = { year: career.year, players, table: {}, schedule: roundRobin(8), pending: players.includes('user') }
  for (const id of players) career.pl.table[id] = { points: 0, nightWins: 0, legsFor: 0, legsAgainst: 0 }
  if (players.includes('user')) {
    sendMail(career, {
      from: 'premier', key: `pl-${career.year}`, date: `${career.year}-01-04`,
      subject: `Premier League ${career.year}: invitation`,
      body: `You've been selected for the ${career.year} Premier League: 16 Thursday nights from February and the play-offs at The O2 in May. £10,000 for every night you win, £350,000 for the champion.`,
      actions: [{ label: 'Accept', action: 'acceptPL' }, { label: 'Decline', action: 'declinePL' }],
    })
  }
  news(career, `Premier League ${career.year} line-up: ${players.map((id) => career.players[id].name).join(', ')}.`, career.calendar[0])
}

function ratingOf(career, id) {
  return id === 'user' ? career.user.avg : (career.players[id]?.rating ?? 70)
}

// ---------- helpers ----------

export function currentEvent(career) {
  return career.calendar[career.eventIndex] ?? null
}

export function eventMonthDay(e) {
  return `${e.day} ${MONTHS[e.month - 1].slice(0, 3)}`
}

function dayOfYear(e) {
  return (e.month - 1) * 31 + e.day
}

export function entryState(career, event) {
  return career.entries[event.id] ?? null
}

// The name of whoever is at the other end (player or World Cup team).
export function sideName(career, id) {
  if (!id) return 'Bye'
  if (id.startsWith?.('T:')) return nationName(id.slice(2))
  return career.players[id]?.name ?? '—'
}

// ---------- entry emails ----------

function entryMail(career, event, el) {
  const comp = COMPETITIONS[event.key]
  const f = roundFormat(event, 0, career.settings.matchLength)
  const fund = prizeFund(event.key, career.prizeScale)
  const how = el.status === 'qualifier' ? `You'll need to win ${el.qualifier.wins} match${el.qualifier.wins > 1 ? 'es' : ''} in the ${el.qualifier.name} to reach the main draw.` : el.status === 'reserve' ? `A place has come up for you from the Q-School reserve list.` : `You're in: ${el.reason}.`
  sendMail(career, {
    from: 'office',
    key: `entry-${event.id}`,
    date: dateStr(career),
    subject: `${el.status === 'reserve' ? 'Reserve call-up' : 'Entry confirmation'}: ${event.name}, ${eventMonthDay(event)}`,
    body: `${event.name}${event.venue ? ` at ${event.venue}` : ''}. ${how} Format: ${formatLabel(f)} in the opening round. ${fund ? `Prize fund ${money(fund)}. ` : ''}${travelCost(event) ? `Estimated travel and accommodation: ${money(travelCost(event))}. ` : ''}${comp.blurb}`,
    actions: [{ label: 'Confirm entry', action: 'confirmEntry', payload: event.id }, { label: 'Withdraw', action: 'withdrawEntry', payload: event.id }],
  })
}

function reserveDecision(career, event, rng) {
  if (!(event.id in career.reserveCalls)) {
    const list = (career.qschool?.reserveList ?? []).filter((id) => !isPro(career, id))
    const pos = rankOf(list, 'user')
    const spare = Math.floor(rng() * 7)
    career.reserveCalls[event.id] = !!pos && pos <= spare
  }
  return career.reserveCalls[event.id]
}

function lookAheadMails(career) {
  const now = currentEvent(career)
  if (!now) return
  const due = []
  for (let i = career.eventIndex; i < career.calendar.length; i++) {
    const e = career.calendar[i]
    if (dayOfYear(e) - dayOfYear(now) > 21) break
    if (career.entries[e.id] || e.key === 'qsFirst' || e.key === 'qsFinal' || e.key === 'premier' || e.key === 'plPlayoffs') continue
    if (e.key === 'pc' && career.players.user.tour !== 'pro') continue // reserve calls come on the day
    const el = eligibility(career, e)
    if (el.status !== 'in' && el.status !== 'qualifier') continue
    if (career.settings.autoEnter) {
      career.entries[e.id] = 'confirmed'
      continue
    }
    career.entries[e.id] = 'pending'
    due.push([e, el])
  }
  // Events on the same tour at the same venue within a few days share one email.
  while (due.length) {
    const [e, el] = due.shift()
    const block = [e]
    while (due.length && due[0][0].key === e.key && due[0][0].venue === e.venue && dayOfYear(due[0][0]) - dayOfYear(e) <= 3) block.push(due.shift()[0])
    if (block.length === 1) entryMail(career, e, el)
    else blockMail(career, block)
  }
}

function blockMail(career, events) {
  const first = events[0]
  const comp = COMPETITIONS[first.key]
  const ids = events.map((e) => e.id).join(',')
  sendMail(career, {
    from: 'office',
    key: `entry-${ids}`,
    subject: `Entry confirmation: ${comp.name} ${events[0].number}–${events.at(-1).number}, ${eventMonthDay(first)}`,
    body: `${events.length} ${comp.name} events at ${first.venue}: ${events.map((e) => `${e.name} (${eventMonthDay(e)})`).join(', ')}. Format: ${formatLabel(roundFormat(first, 0, career.settings.matchLength))}. Prize fund ${money(prizeFund(first.key, career.prizeScale))} per event. Estimated travel and accommodation: ${money(travelCost(first))} per event. You can still withdraw from single events in the calendar.`,
    actions: [{ label: 'Enter all', action: 'confirmEntry', payload: ids }, { label: 'Withdraw from all', action: 'withdrawEntry', payload: ids }],
  })
}

// ---------- the advance loop ----------

function monthly(career, event) {
  if (event.month === career.lastMonth) return
  const prevMonth = career.lastMonth
  career.lastMonth = event.month
  const date = dateStr(career, event)
  paySponsors(career, date)
  if (prevMonth > 0) monthlySponsorship(career)
  if (prevMonth > 0) {
    const winners = career.honours.filter((h) => h.year === career.year && h.month === prevMonth && h.prize)
    if (winners.length) {
      const top = Object.values(career.players)
        .map((p) => [p, p.earn[career.year]?.total ?? 0])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      sendMail(career, {
        from: 'news', date,
        subject: `${MONTHS[prevMonth - 1]} round-up`,
        body: `Winners: ${winners.slice(-14).map((h) => `${h.name}: ${sideName(career, h.winner)} (${money(h.prize)})`).join('; ')}.\n\nTop earners this season: ${top.map(([p, v], i) => `${i + 1}. ${p.name} ${money(v)}`).join(', ')}.`,
      })
    }
  }
}

// Plays through events the user isn't in, and stops at the next one that needs them
// (or a decision from them). Returns { stoppedAt, needs } where needs is
// 'play' | 'entry' | 'qschool' | 'premier' | null.
export function advance(career, rng = Math.random) {
  const startYear = career.year
  const simulated = []
  while (career.year === startYear) {
    const event = currentEvent(career)
    if (!event) break
    monthly(career, event)
    lookAheadMails(career)
    if (career.active) return { simulated, stoppedAt: event.id, needs: 'play' }

    if ((event.key === 'qsFirst' || event.key === 'qsFinal') && career.qschool.registered === null) return { simulated, stoppedAt: event.id, needs: 'qschool' }
    if (event.key === 'premier' && career.pl.pending) return { simulated, stoppedAt: event.id, needs: 'premier' }

    if (event.key === 'qsFirst' || event.key === 'qsFinal') {
      if (!career.qschool.registered) {
        if (!career.qschool.done) silentQschool(career, rng)
        career.eventIndex++
        continue
      }
      if (career.qschool.done) {
        career.eventIndex++
        continue
      }
    }

    let el = eligibility(career, event)
    event.userSeed = !!el.seed
    if (el.status === 'reserve') {
      el = reserveDecision(career, event, rng) ? { status: 'in', reason: 'Called up from the reserve list' } : { status: 'out' }
    }
    if (el.status === 'in' || el.status === 'qualifier') {
      let state = career.entries[event.id]
      if (!state && (el.auto || career.settings.autoEnter)) state = career.entries[event.id] = 'confirmed'
      if (!state || state === 'pending') {
        if (!state) {
          career.entries[event.id] = 'pending'
          entryMail(career, event, el)
        }
        return { simulated, stoppedAt: event.id, needs: 'entry' }
      }
      if (state === 'confirmed') {
        startEvent(career, true, el, rng)
        return { simulated, stoppedAt: event.id, needs: 'play' }
      }
    } else if (event.tier >= 3 && career.players.user.tour === 'pro' && el.reason && !['premier', 'plPlayoffs'].includes(event.key)) {
      sendMail(career, { from: 'office', key: `miss-${event.id}`, subject: `${event.name}: field confirmed`, body: `The field for the ${event.name} is confirmed and you haven't made it this time. Qualification: ${el.reason}.` })
    }
    startEvent(career, false, null, rng)
    simulateUntilUserMatch(career, rng)
    simulated.push(event.name)
    finishEvent(career, rng)
  }
  return { simulated, seasonEnded: true, needs: null }
}

// ---------- mail actions ----------

// Confirm or withdraw from the hub (resolves the matching email too).
export function setEntry(career, eventId, state) {
  career.entries[eventId] = state
  resolveMail(career, `entry-${eventId}`, state === 'confirmed' ? 'Confirm entry' : 'Withdraw')
  // A block email stays open for its other events, so only resolve it when all are decided.
  for (const m of career.inbox) {
    if (!m.resolved && m.key?.startsWith('entry-') && m.key.includes(',') && m.key.slice(6).split(',').every((id) => career.entries[id] !== 'pending')) m.resolved = 'Decided in calendar'
  }
}

export function handleAction(career, mailId, action, payload, rng = Math.random) {
  const mail = career.inbox.find((m) => m.id === mailId)
  const label = mail?.actions?.find((a) => a.action === action)?.label
  if (mail) mail.resolved = label ?? action
  switch (action) {
    case 'confirmEntry':
    case 'withdrawEntry': {
      for (const id of String(payload).split(',')) {
        const event = career.calendar.find((e) => e.id === id)
        if (!event || (career.active && career.active.eventId === id) || career.results[id]) continue
        career.entries[id] = action === 'confirmEntry' ? 'confirmed' : 'withdrawn'
      }
      break
    }
    case 'registerQschool': {
      const qs = career.qschool
      qs.registered = true
      qs.userStage = qs.exempt ? 'final' : 'first'
      if (!qs.free) ledger(career, -QSCHOOL_FEE[qs.school], `Q-School entry fee`, `${career.year}-01-02`)
      break
    }
    case 'skipQschool':
      career.qschool.registered = false
      break
    case 'acceptPL':
      career.pl.pending = false
      break
    case 'declinePL': {
      const pl = career.pl
      const next = ranking(career, 'oom').find((id) => !pl.players.includes(id))
      pl.players = pl.players.map((id) => (id === 'user' ? next : id))
      delete pl.table.user
      pl.table[next] = { points: 0, nightWins: 0, legsFor: 0, legsAgainst: 0 }
      pl.pending = false
      break
    }
    case 'acceptSponsor':
      acceptSponsor(career, payload)
      ;(career.flags ??= {}).signedSponsor = true
      checkAchievements(career)
      break
    case 'negotiateSponsor':
      negotiateSponsor(career, payload, rng)
      break
    case 'declineSponsor':
      delete career.offers[payload]
      break
  }
}

// ---------- events ----------

function plNightPairs(career, night) {
  const pl = career.pl
  if (night === 8 || night === 16) {
    const t = plTable(career)
    return [[t[0], t[7]], [t[1], t[6]], [t[2], t[5]], [t[3], t[4]]]
  }
  const r = pl.schedule[(night > 8 ? night - 9 : night - 1) % 7]
  return r.map(([i, j]) => [pl.players[i], pl.players[j]])
}

function qualifierOpponents(career, event, q, rng) {
  const oom = ranking(career, 'oom')
  const nonCard = oom.filter((id) => !isPro(career, id) && id !== 'user')
  const cards = oom.filter((id) => isPro(career, id) && id !== 'user')
  let pool
  if (q.name.includes('Preliminary')) pool = oom.slice(24, 44).filter((id) => id !== 'user')
  else if (q.name.includes('Tour Card') || q.name.includes('PDPA')) pool = cards.slice(30)
  else if (q.name.includes('Host')) pool = nonCard.filter((id) => career.players[id].nation === event.country)
  else if (q.name.includes('Local') || q.name.includes('Associate')) pool = nonCard.filter((id) => career.players[id].nation === career.players.user.nation)
  else if (q.name.includes('Seniors')) pool = nonCard.filter((id) => career.players[id].age >= 45)
  else pool = nonCard
  if (pool.length < q.wins) pool = [...pool, ...shuffle(nonCard, rng)]
  // Opponents get a little stronger each match.
  return shuffle(pool, rng).slice(0, q.wins * 3).sort((a, b) => ratingOf(career, a) - ratingOf(career, b)).filter((_, i) => i % 3 === 0).slice(0, q.wins)
}

function replaceUser(t, sub) {
  const swap = (arr) => arr.map((id) => (id === 'user' ? sub : id))
  t.rounds = t.rounds.map((pairs) => pairs.map(swap))
  if (t.joins) t.joins = t.joins.map(swap)
  if (t.groups) {
    t.groups = t.groups.map(swap)
    if (t.table?.user) {
      t.table[sub] = t.table.user
      delete t.table.user
    }
  }
}

export function startEvent(career, userIn, el, rng = Math.random) {
  const event = currentEvent(career)
  const comp = COMPETITIONS[event.key]
  let t
  let teams = null
  let userSide = userIn ? 'user' : null
  if (event.key === 'qsFirst' || event.key === 'qsFinal') {
    t = createKnockout(comp.size, qschoolField(career, event, userIn, rng), { rng })
  } else if (event.key === 'premier') {
    const pairs = plNightPairs(career, event.night)
    t = createKnockout(8, pairs.flat(), { seeded: false, rng })
    t.rounds[0] = pairs
  } else if (event.key === 'plPlayoffs') {
    const top = plTable(career).slice(0, 4)
    t = createKnockout(4, top, { seeded: true, rng })
    t.rounds[0] = [[top[0], top[3]], [top[1], top[2]]]
  } else {
    const field = buildField(career, event, userIn, rng)
    if (field.kind === 'staged') t = createStaged(field.joins, comp.legs.length, rng)
    else if (field.kind === 'groups') t = createGroups(field.groups, { advance: comp.advance ?? 1, koRounds: comp.legs.length, seedsToKo: field.seedsToKo ?? [] })
    else t = createKnockout(comp.size, field.entrants, { seeded: !!comp.seeded, rng })
    if (field.teams) {
      teams = field.teams
      if (userIn) userSide = Object.values(teams).find((x) => x.players.includes('user'))?.id ?? null
    }
  }
  const qualifier = userIn && el?.status === 'qualifier' ? { ...el.qualifier, won: 0, lost: false, opponents: qualifierOpponents(career, event, el.qualifier, rng) } : null
  const user = career.players.user
  const ranked = (user.earn[career.year]?.ranked ?? 0) + (user.earn[career.year - 1]?.ranked ?? 0) > 0
  career.active = {
    eventId: event.id, key: event.key, tournament: t, userIn: !!userIn, userSide, teams, qualifier, userLog: [], live: null, reason: el?.reason ?? null,
    rankBefore: userIn && ranked ? rankOf(ranking(career, 'oom'), 'user') : null,
    statsBefore: userIn ? { s180: career.stats.s180, high: career.stats.highCheckout, tour: user.tour } : null,
  }
  if (userIn) {
    const cost = travelCost(event)
    if (cost) ledger(career, -cost, `Travel & accommodation: ${event.name}`, dateStr(career, event))
  }
  return career.active
}

export function nextUserTask(career) {
  const a = career.active
  if (!a) return null
  if (a.qualifier && !a.qualifier.lost && a.qualifier.won < a.qualifier.wins) {
    return { kind: 'qualifier', opponent: a.qualifier.opponents[a.qualifier.won], match: a.qualifier.won + 1 }
  }
  const t = a.tournament
  if (t.finished) return { kind: 'finished' }
  if (a.userSide) {
    const p = findPair(t, a.userSide)
    if (p && p.opponent) return { kind: 'round', opponent: p.opponent, round: t.round }
  }
  return { kind: 'spectate' }
}

function progressFor(career, round) {
  const a = career.active
  const t = a.tournament
  if (a.key === 'premier') return round * 0.3
  if (a.key === 'plPlayoffs') return 0.8 + round * 0.2
  const md = t.groupMatchdays ?? 0
  if (round < md) return 0
  const ko = t.totalRounds - md
  return ko <= 1 ? 1 : (round - md) / (ko - 1)
}

function sideRating(career, id) {
  const a = career.active
  if (a?.teams?.[id]) return a.teams[id].players.reduce((s, p) => s + ratingOf(career, p), 0) / 2
  return ratingOf(career, id)
}

export function taskFormat(career, task) {
  const event = currentEvent(career)
  if (task.kind === 'qualifier') return qualifierFormat(career.settings.matchLength, !!career.active.qualifier.sets)
  return roundFormat(event, task.round, career.settings.matchLength, career.active.tournament.groupMatchdays ?? 0)
}

export function taskStage(career, task) {
  if (task.kind === 'qualifier') return `${career.active.qualifier.name}, match ${task.match} of ${career.active.qualifier.wins}`
  return roundName(career.active.tournament, task.round)
}

export function taskOpponentAverage(career, task, rng = Math.random) {
  const comp = COMPETITIONS[career.active.key]
  const q = task.kind === 'qualifier'
  const level = q ? (career.active.qualifier.name.match(/Tour Card|PDPA|Preliminary/) ? 'pro' : 'dev') : comp.level
  const progress = q ? (task.match - 1) / Math.max(1, career.active.qualifier.wins) * 0.4 : progressFor(career, task.round)
  return opponentAverage(career, sideRating(career, task.opponent), { level, progress }, rng)
}

export function prepareLiveMatch(career, rng = Math.random) {
  const task = nextUserTask(career)
  if (!task || (task.kind !== 'qualifier' && task.kind !== 'round')) return null
  const avgs = taskOpponentAverage(career, task, rng)
  const a = career.active
  const live = { kind: task.kind, opponent: task.opponent, format: taskFormat(career, task), expectedAvg: avgs.expected, actualAvg: avgs.actual, stage: taskStage(career, task), match: null }
  if (a.teams && a.userSide) {
    live.partner = a.teams[a.userSide].players.find((id) => id !== 'user')
    live.partnerAvg = Math.round((avgs.actual + gaussian(rng) * 2) * 10) / 10
    live.oppPlayers = a.teams[task.opponent].players
  }
  a.live = live
  return live
}

function playFn(career, event, userResult, rng) {
  const a = career.active
  const t = a.tournament
  const format = roundFormat(event, t.round, career.settings.matchLength, t.groupMatchdays ?? 0)
  const avg = (id) => (a.teams?.[id] ? a.teams[id].players.map((p) => simAverage(career, p, rng)) : simAverage(career, id, rng))
  return (x, y) => {
    if (userResult && (x === a.userSide || y === a.userSide)) {
      const userFirst = x === a.userSide
      const flip = (arr) => (userFirst ? arr : [arr[1], arr[0]])
      return { winner: userResult.userWon === userFirst ? 0 : 1, score: flip(userResult.score), legs: flip(userResult.legs), averages: flip([userResult.userAvg, userResult.oppAvg]), played: !userResult.simulated, sets: !!format.sets }
    }
    return { ...fastMatch(avg(x), avg(y), format, rng), sets: !!format.sets }
  }
}

function recordUserStats(career, result, opponent, stage) {
  const s = career.stats
  if (result.userWon) s.won++
  s.legsWon += result.legs[0]
  s.legsLost += result.legs[1]
  if (opponent && !opponent.startsWith?.('T:')) {
    const h = (career.h2h[opponent] ??= { w: 0, l: 0, meetings: [] })
    if (result.userWon) h.w++
    else h.l++
    h.meetings.unshift({ year: career.year, event: currentEvent(career).name, stage, won: result.userWon, score: result.score })
    h.meetings.length = Math.min(h.meetings.length, 12)
    afterMatch(career, { opponent, won: result.userWon, stage, event: currentEvent(career), played: !result.simulated })
  }
  if (result.userWon && opponent && !opponent.startsWith?.('T:')) {
    const r = rankOf(ranking(career, 'oom'), opponent)
    if (r && r <= 16) (career.flags ??= {}).beatTop16 = true
  }
  if (result.simulated) {
    s.simulated++
    return
  }
  s.played++
  if (result.pairs) return // team stats include your partner's darts
  const st = result.userStats
  s.darts += st.darts
  s.points += st.points
  s.s180 += st.s180
  s.s140 += st.s140
  s.s100 += st.s100
  s.checkouts += st.checkouts
  s.highCheckout = Math.max(s.highCheckout, st.highCheckout)
  s.bestAvg = Math.max(s.bestAvg, Math.round(result.userAvg * 100) / 100)
  s.dartsAtDouble += st.dartsAtDouble ?? 0
  if (st.dartsAtDouble) s.trackedCheckouts += st.checkouts
  for (const [d, n] of Object.entries(st.doubles ?? {})) s.doubles[d] = (s.doubles[d] ?? 0) + n
  if (st.legDarts?.includes(9)) s.nineDarters++
  const rec = career.records
  const where = { event: currentEvent(career).name, year: career.year, opponent }
  if (st.s180 && st.s180 > (rec.most180s?.value ?? 0)) rec.most180s = { value: st.s180, ...where }
  const best = st.legDarts?.length ? Math.min(...st.legDarts) : null
  if (best && best < (rec.lowestLeg?.value ?? Infinity)) rec.lowestLeg = { value: best, ...where }
  if (st.highCheckout && st.highCheckout > (rec.highestCheckout?.value ?? 0)) rec.highestCheckout = { value: st.highCheckout, ...where }
  if (result.userAvg > (rec.bestAverage?.value ?? 0) && st.darts >= 15) rec.bestAverage = { value: Math.round(result.userAvg * 100) / 100, ...where }
  // Progress diary for the charts on the Stats tab.
  career.progress ??= []
  career.progress.push({
    date: dateStr(career), event: currentEvent(career).name, avg: Math.round(result.userAvg * 100) / 100,
    s180: st.s180, high: st.highCheckout, legs: st.checkouts, darts: st.darts,
    atDouble: st.dartsAtDouble ?? 0, won: result.userWon,
  })
  if (career.progress.length > 600) career.progress.splice(0, career.progress.length - 600)
  if (career.user.autoAdjust && st.darts >= 24) career.user.avg = Math.round((career.user.avg * 0.8 + result.userAvg * 0.2) * 10) / 10
}

// result: { userWon, score:[u,o], legs:[u,o], userAvg, oppAvg, userStats?, simulated }
export function submitUserResult(career, result, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  const task = nextUserTask(career)
  const stage = taskStage(career, task)
  recordUserStats(career, result, task.opponent, stage)
  if (!result.simulated && result.userStats) payBonuses(career, event, result.userStats)
  checkAchievements(career)
  if (!result.simulated && !result.pairs) maybePress(career, { opponent: task.opponent, won: result.userWon, stage, event, avg: result.userAvg, title: result.userWon && stage === 'Final' && event.key !== 'premier', rng })
  a.userLog.push({ stage, opponent: task.opponent, userWon: result.userWon, score: result.score, userAvg: result.userAvg, oppAvg: result.oppAvg, simulated: !!result.simulated, sets: !!a.live?.format?.sets || !!taskFormat(career, task).sets })
  a.live = null
  if (task.kind === 'qualifier') {
    const q = a.qualifier
    if (result.userWon) {
      q.won++
      if (q.won >= q.wins) news(career, `${career.players.user.name} comes through the ${q.name} to reach the ${event.name}.`, event)
    } else {
      q.lost = true
      const used = new Set(a.tournament.rounds.flat(2))
      const sub = ranking(career, 'oom').find((id) => id !== 'user' && !used.has(id) && !(a.teams && id.startsWith('T:')))
      replaceUser(a.tournament, sub)
      a.userSide = null
    }
    return
  }
  resolveRound(a.tournament, playFn(career, event, result, rng), rng)
}

export function simulateUserMatch(career, rng = Math.random) {
  const task = nextUserTask(career)
  const format = taskFormat(career, task)
  const opp = taskOpponentAverage(career, task, rng).actual
  const me = career.user.avg + gaussian(rng) * 3
  const sim = simulateMatch(format.pairs ? [me, opp] : me, format.pairs ? [opp, opp] : opp, format, rng)
  submitUserResult(career, { userWon: sim.winner === 0, score: sim.score, legs: sim.legs, userAvg: sim.averages[0], oppAvg: sim.averages[1], simulated: true }, rng)
}

export function simulateUntilUserMatch(career, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  let guard = 0
  while (!a.tournament.finished && guard++ < 50) {
    const task = nextUserTask(career)
    if (task.kind === 'round' || task.kind === 'qualifier') return
    resolveRound(a.tournament, playFn(career, event, null, rng), rng)
  }
}

// Nine-dart and 170 bonuses for what you hit on your own board.
function payBonuses(career, event, st) {
  const a = career.active
  const date = dateStr(career, event)
  const nines = (st.legDarts ?? []).filter((d) => d === 9).length
  if (nines) {
    const each = Math.round((NINE_DART_BONUS[event.tier] * (career.prizeScale ?? 1)) / 500) * 500
    const amount = each * nines
    addEarnings(career.players.user, career.year, [], amount)
    ledger(career, amount, `Nine-dart bonus: ${event.name}`, date)
    a.nineDarter = (a.nineDarter ?? 0) + nines
    career.records.nineDarters = [...(career.records.nineDarters ?? []), { event: event.name, year: career.year }]
    sendMail(career, { from: 'office', date, subject: 'PERFECTION! Nine-dart bonus', body: `Congratulations on your nine-dart finish at the ${event.name}. A bonus of ${money(amount)} has been paid into your account.` })
    news(career, `NINE-DARTER! ${career.players.user.name} hits the perfect leg at the ${event.name}.`, event)
  }
  if (st.bigFish) {
    const amount = Math.round((BIG_FISH_BONUS * (career.prizeScale ?? 1)) / 50) * 50 * st.bigFish
    addEarnings(career.players.user, career.year, [], amount)
    ledger(career, amount, `Big Fish (170) bonus: ${event.name}`, date)
    a.bigFish = (a.bigFish ?? 0) + st.bigFish
    sendMail(career, { from: 'office', date, subject: 'The Big Fish!', body: `You landed the 170 checkout at the ${event.name}: ${money(amount)} bonus paid.` })
  }
  if (nines || st.bigFish) touch(career)
}

// ---------- prizes and wrap-up ----------

function prizeFor(event, t, id, comp) {
  // comp here is the season's scaled prize table (see scaledPrizes).
  const stage = stageFor(t, id)
  if (stage === null) return 0
  if (stage === 'group') {
    const pos = t.groupFinish[id]
    if (event.key === 'grandslam') return pos === 3 ? comp.groupPrizes.third : comp.groupPrizes.fourth
    return pos === 2 ? comp.groupPrizes.second : comp.groupPrizes.third
  }
  let prize = comp.prizes[stage] ?? 0
  if (event.key === 'grandslam' && t.groupFinish?.[id] === 1) prize += comp.groupPrizes.winnerBonus
  return prize
}

function payout(career, id, amount, cats, event, isUser) {
  if (!amount) return
  addEarnings(career.players[id], career.year, cats, amount)
  if (isUser) ledger(career, amount, `Prize money: ${event.name}`, dateStr(career, event))
}

export function finishEvent(career, rng = Math.random) {
  const a = career.active
  const event = currentEvent(career)
  const comp = { ...COMPETITIONS[event.key], ...scaledPrizes(event.key, career.prizeScale) }
  const t = a.tournament
  const y = career.year
  const teamOf = (id) => a.teams?.[id]?.players ?? [id]
  const everyone = new Set()
  for (const pairs of t.rounds) for (const p of pairs) for (const id of p) if (id) everyone.add(id)
  for (const j of t.joins ?? []) for (const id of j) everyone.add(id)
  let userPrize = 0

  if (event.key === 'premier') {
    const pl = career.pl
    const final = t.results[2][0]
    const runnerUp = final.winner === final.a ? final.b : final.a
    for (const r of t.results.flat()) {
      for (const [id, i] of [[r.a, 0], [r.b, 1]]) {
        pl.table[id].legsFor += (r.legs ?? r.score)[i]
        pl.table[id].legsAgainst += (r.legs ?? r.score)[1 - i]
      }
    }
    for (const r of t.results[1]) pl.table[r.winner === r.a ? r.b : r.a].points += 2
    pl.table[runnerUp].points += 3
    pl.table[t.champion].points += 5
    pl.table[t.champion].nightWins++
    payout(career, t.champion, comp.nightBonus, [], event, t.champion === 'user')
    if (t.champion === 'user') userPrize = comp.nightBonus
  } else if (event.key === 'plPlayoffs') {
    const table = plTable(career)
    const final = t.results[1][0]
    const order = [t.champion, final.winner === final.a ? final.b : final.a, ...t.results[0].map((r) => (r.winner === r.a ? r.b : r.a)), ...table.slice(4)]
    order.forEach((id, i) => {
      payout(career, id, comp.prizes[i], [], event, id === 'user')
      if (id === 'user') userPrize = comp.prizes[i]
    })
  } else if (comp.prizes.length) {
    for (const side of everyone) {
      const prize = prizeFor(event, t, side, comp)
      const members = teamOf(side)
      for (const id of members) {
        const share = members.length > 1 ? prize / 2 : prize
        payout(career, id, share, comp.cats, event, id === 'user')
        if (id === 'user') userPrize = share
      }
    }
  }
  touch(career)

  const final = t.results[t.totalRounds - 1]?.find((r) => !r.bye)
  const runnerUp = final ? (final.winner === final.a ? final.b : final.a) : null
  // Premier League nights and Q-School days aren't titles.
  const isTitle = !['qsFirst', 'qsFinal', 'premier'].includes(event.key)
  if (isTitle) for (const id of teamOf(t.champion)) career.players[id]?.titles.push(`${y} ${event.key === 'plPlayoffs' ? `Premier League` : event.name}`)
  if (!['qsFirst', 'qsFinal'].includes(event.key)) {
    const fs = final?.score ? (final.winner === final.a ? final.score : [final.score[1], final.score[0]]) : null
    career.honours.push({ year: y, month: event.month, day: event.day, key: event.key, name: event.name, winner: t.champion, runnerUp, score: fs, sets: !!final?.sets, prize: comp.prizes[0] || comp.nightBonus || 0 })
    if (career.honours.length > 4000) career.honours.splice(0, career.honours.length - 4000)
  }

  // User outcome
  const userSide = a.userSide ?? (a.userIn ? 'user' : null)
  const inDraw = userSide && everyone.has(userSide)
  let resultText = null
  if (inDraw) {
    const stage = stageFor(t, userSide)
    if (event.key === 'qsFirst') resultText = roundsWon(t, 'user') >= 4 ? 'Through to the Final Stage' : `${roundsWon(t, 'user')} win${roundsWon(t, 'user') === 1 ? '' : 's'}`
    else if (stage === 0) resultText = 'Champion!'
    else if (stage === 1) resultText = 'Runner-up'
    else if (stage === 'group') resultText = `Out in the group stage (${['', '1st', '2nd', '3rd', '4th'][t.groupFinish[userSide]]})`
    else if (stage !== null) resultText = `Lost in the ${roundName(t, t.eliminated[userSide])}`
    if (event.key === 'premier') resultText = stage === 0 ? 'Night winner (5 pts)' : stage === 1 ? 'Runner-up (3 pts)' : stage === 2 ? 'Semi-final (2 pts)' : 'Quarter-final (0 pts)'
    if (userPrize) sendMail(career, { from: 'finance', date: dateStr(career, event), subject: `Prize money statement: ${event.name}`, body: `${resultText}. ${money(userPrize)} has been paid into your account${comp.cats.includes('ranked') ? ' and counts towards the Order of Merit' : ' (non-ranking)'}.` })
    if (stage === 0 && isTitle) {
      titleBonuses(career, event.name, dateStr(career, event))
      milestone(career, 'firstTitle', rng)
      if (event.tier >= 3) milestone(career, 'majorTitle', rng)
    }
    if (typeof stage === 'number' && stage <= 3 && event.tier >= 3) milestone(career, 'majorQF', rng)
  } else if (a.qualifier?.lost) {
    resultText = `Lost in the ${a.qualifier.name}`
  }
  if (resultText && event.key !== 'qsFirst') {
    const stage = inDraw ? stageFor(t, userSide) : null
    const rank = !inDraw ? 99 : stage === 'group' ? 90 : typeof stage === 'number' ? stage : 95
    recordBest(career, event, rank, resultText)
  }
  const champName = sideName(career, t.champion)
  const scoreText = final?.score ? ` ${final.score[final.winner === final.a ? 0 : 1]}–${final.score[final.winner === final.a ? 1 : 0]}${final.sets ? ' in sets' : ''}` : ''
  if (!['qsFirst', 'qsFinal', 'premier'].includes(event.key)) {
    news(career, `${champName} wins the ${event.name}${runnerUp ? `, beating ${sideName(career, runnerUp)}${scoreText} in the final` : ''}${comp.prizes[0] ? ` (${money(comp.prizes[0])})` : ''}.${resultText ? ` You: ${resultText.toLowerCase()}.` : ''}`, event)
  } else if (event.key === 'premier') {
    news(career, `${event.name}: ${champName} wins the night${resultText ? `. You: ${resultText.toLowerCase()}` : ''}.`, event)
  }
  if (event.key === 'qsFirst' || event.key === 'qsFinal') qschoolAfterDay(career, event, t)

  if (resultText && event.key !== 'qsFirst') sendNewspaper(career, event, { t, inDraw, userSide, resultText, userPrize, runnerUp, final }, rng)
  if (resultText) rankingUpdate(career, event)
  career.results[event.id] = { champion: t.champion, user: resultText, prize: userPrize }
  career.lastResult = { eventName: event.name, text: resultText, prize: userPrize, champion: t.champion }
  career.active = null
  career.eventIndex++
  checkRankMilestones(career, rng)
  checkAchievements(career)
  if (career.eventIndex >= career.calendar.length) endSeason(career, rng)
}

function sendNewspaper(career, event, { t, inDraw, userSide, resultText, userPrize, runnerUp }, rng) {
  const a = career.active
  const user = career.players.user
  const stage = inDraw ? stageFor(t, userSide) : null
  const oom = ranking(career, 'oom')
  const ranked = (user.earn[career.year]?.ranked ?? 0) + (user.earn[career.year - 1]?.ranked ?? 0) > 0
  const finalMatch = stage === 0 ? a.userLog.at(-1) : null
  const played = a.userLog.filter((m) => !m.simulated)
  const others = career.news.slice(1, 12).filter((n) => !n.text.includes(user.name) && / wins /.test(n.text)).slice(0, 3).map((n) => n.text.replace(/\. You:.*$/, '').replace(/, beating.*?final/, '').slice(0, 90))
  const article = buildArticle(career, event, {
    stageRank: stage === null ? 99 : stage === 'group' ? 90 : stage,
    resultText,
    prize: userPrize,
    userLog: a.userLog,
    userSide,
    champion: t.champion,
    runnerUp,
    final: finalMatch,
    rankBefore: a.rankBefore,
    rankAfter: ranked && user.tour === 'pro' ? rankOf(oom, 'user') : ranked ? rankOf(oom, 'user') : null,
    ctAfter: user.tour !== 'pro' && (user.earn[career.year]?.ct ?? 0) > 0 ? rankOf(ranking(career, 'ct'), 'user') : null,
    cardWon: event.key === 'qsFinal' && a.statsBefore?.tour !== 'pro' && user.tour === 'pro',
    titles: user.titles.length,
    qualifierLost: !inDraw && !!a.qualifier?.lost,
    oomList: oom,
    best180s: played.length && a.statsBefore ? career.stats.s180 - a.statsBefore.s180 : 0,
    highCheckout: played.length && a.statsBefore && career.stats.highCheckout > a.statsBefore.high ? career.stats.highCheckout : 0,
    otherNews: others,
    nineDarter: a.nineDarter ?? 0,
    bigFish: a.bigFish ?? 0,
    date: dateStr(career, event),
  }, rng)
  sendMail(career, { from: PAPER, subject: `📰 ${article.headline}`, body: `${article.subhead}.\n\n${article.body.join('\n\n')}`, article, date: dateStr(career, event) })
}

// ---------- ranking updates ----------

const RANK_LISTS = {
  oom: 'PDC Order of Merit',
  pt: 'Pro Tour Order of Merit',
  pc: 'Players Championship Order of Merit',
  et: 'European Tour Order of Merit',
  ct: 'Challenge Tour Order of Merit',
  dt: 'Development Tour Order of Merit',
}

// The user's position on every ranking that matters to them right now.
export function rankingSnapshot(career) {
  const user = career.players.user
  const y = career.year
  const e = user.earn[y] ?? {}
  const ranked = (e.ranked ?? 0) + (user.earn[y - 1]?.ranked ?? 0) > 0
  const keys = []
  if (user.tour === 'pro' || ranked) keys.push('oom')
  if (user.tour === 'pro') keys.push('pt', 'pc')
  if (e.et) keys.push('et')
  if (user.tour !== 'pro') keys.push('ct')
  if (user.age <= 24) keys.push('dt')
  const out = {}
  for (const k of keys) {
    const list = ranking(career, k)
    const value = k === 'oom' ? (e.ranked ?? 0) + (user.earn[y - 1]?.ranked ?? 0) : e[k] ?? 0
    if (k !== 'oom' && !value) continue
    const pos = rankOf(list, 'user')
    const target = { oom: 64, pt: 16, pc: 64, et: 32, ct: 2, dt: 2 }[k]
    const at = list[target - 1]
    const targetValue = at ? (k === 'oom' ? rankingValueOf(career, at, 'oom') : career.players[at].earn[y]?.[k] ?? 0) : 0
    out[k] = { pos, value, target, gap: pos > target ? Math.max(0, targetValue - value) : 0 }
  }
  return out
}

function rankingValueOf(career, id, key) {
  const p = career.players[id]
  const y = career.year
  return key === 'oom' ? (p.earn[y]?.ranked ?? 0) + (p.earn[y - 1]?.ranked ?? 0) : p.earn[y]?.[key] ?? 0
}

const TARGET_TEXT = { oom: 'the top 64 (Tour Card safety)', pt: 'the top 16 (Matchplay & Grand Prix)', pc: 'the top 64 (Players Championship Finals)', et: 'the top 32 (European Championship)', ct: 'the top 2 (Tour Card)', dt: 'the top 2 (Tour Card)' }

function rankingUpdate(career, event) {
  const now = rankingSnapshot(career)
  const before = career.rankSnapshot?.ranks ?? {}
  const rows = Object.entries(now).map(([k, r]) => {
    const prev = before[k]?.pos
    const move = prev ? prev - r.pos : null
    return { key: k, label: RANK_LISTS[k], pos: r.pos, prev, move, value: r.value, target: r.target, gap: r.gap }
  })
  career.rankSnapshot = { ranks: now, rows, date: dateStr(career, event), eventName: event.name }
  if (!rows.length) return
  const line = (x) => `${x.label}: #${x.pos}${x.move ? (x.move > 0 ? ` (▲ up ${x.move})` : ` (▼ down ${-x.move})`) : x.prev ? ' (no change)' : ' (new)'} · ${money(x.value)}${x.gap ? ` · ${money(x.gap)} behind ${TARGET_TEXT[x.key]}` : x.pos <= x.target ? ` · inside ${TARGET_TEXT[x.key]}` : ''}`
  const main = rows[0]
  sendMail(career, {
    from: 'office',
    date: dateStr(career, event),
    subject: `Ranking update after ${event.name}: #${main.pos}${main.move ? (main.move > 0 ? ` ▲${main.move}` : ` ▼${-main.move}`) : ''}`,
    body: `Your rankings after the ${event.name} (movement since your last event):\n\n${rows.map(line).join('\n')}`,
  })
}

// Personal roll of honour: best finish in each competition. European Tour and World
// Series events are separate tournaments, so they are tracked by name.
export function competitionKey(event) {
  return ['et', 'ws'].includes(event.key) ? event.name : event.key
}

function recordBest(career, event, rank, text) {
  const k = competitionKey(event)
  const cur = career.records.bestIn[k]
  const name = ['et', 'ws'].includes(event.key) ? event.name : ({ qsFinal: 'Q-School Final Stage', premier: 'Premier League nights', plPlayoffs: 'Premier League' })[event.key] ?? COMPETITIONS[event.key].name
  if (!cur || rank < cur.rank) career.records.bestIn[k] = { rank, text, year: career.year, name, times: rank === 0 ? 1 : 0 }
  else if (rank === 0 && cur.rank === 0) cur.times++
}

function checkRankMilestones(career, rng) {
  const r = rankOf(ranking(career, 'oom'), 'user')
  const user = career.players.user
  const ranked = (user.earn[career.year]?.ranked ?? 0) + (user.earn[career.year - 1]?.ranked ?? 0) > 0
  if (r && ranked && (!career.records.peakRank || r < career.records.peakRank.rank)) {
    career.records.peakRank = { rank: r, date: dateStr(career) }
  }
  if (!r || career.players.user.tour !== 'pro') return
  if (r <= 64) milestone(career, 'top64', rng)
  if (r <= 32) milestone(career, 'top32', rng)
  if (r <= 16) milestone(career, 'top16', rng)
}

// ---------- Q-School ----------

function qschoolField(career, event, userIn, rng) {
  const qs = career.qschool
  const nonCard = Object.values(career.players).filter((p) => p.tour !== 'pro' && p.id !== 'user').map((p) => p.id)
  if (event.key === 'qsFirst') {
    const exempt = new Set([...(career.lastSeason.lostCards ?? []), ...(career.lastSeason.ct ?? []).slice(0, 16), ...(career.lastSeason.dt ?? []).slice(0, 16), ...qs.finalField])
    const pool = shuffle(nonCard.filter((id) => !exempt.has(id)), rng).slice(0, 256 - (userIn ? 1 : 0))
    return userIn ? ['user', ...pool] : pool
  }
  if (!qs.finalBase) {
    const exempt = [...(career.lastSeason.lostCards ?? []), ...(career.lastSeason.ct ?? []).slice(0, 16), ...(career.lastSeason.dt ?? []).slice(0, 16)].filter((id) => id !== 'user' && career.players[id]?.tour !== 'pro')
    qs.finalBase = [...new Set([...exempt, ...qs.finalField.filter((id) => id !== 'user')])]
  }
  const winners = new Set(qs.cardWinners)
  let field = qs.finalBase.filter((id) => !winners.has(id))
  if (field.length < 127) field = [...field, ...shuffle(nonCard.filter((id) => !winners.has(id) && !field.includes(id)), rng).slice(0, 127 - field.length)]
  field = shuffle(field, rng).slice(0, 128 - (userIn ? 1 : 0))
  return userIn ? ['user', ...field] : field
}

function giveCard(career, id, why) {
  const p = career.players[id]
  p.tour = 'pro'
  p.cardExpiry = career.year + 1
  touch(career)
  if (id === 'user') {
    career.qschool.userStage = null
    sendMail(career, { from: 'qschool', subject: 'Tour Card won!', body: `${why}. You are now a PDC Tour Card holder for ${career.year} and ${career.year + 1}: every Players Championship, the UK Open and European Tour qualifiers are open to you. To keep the card beyond ${career.year + 1} you'll need to be inside the top 64 on the Order of Merit.` })
    news(career, `${p.name} wins a PDC Tour Card at Q-School.`)
    milestone(career, 'card')
  }
}

function qschoolAfterDay(career, event, t) {
  const qs = career.qschool
  const all = new Set(t.rounds[0].flat().filter(Boolean))
  if (event.key === 'qsFirst') {
    for (const id of all) {
      const w = roundsWon(t, id)
      qs.firstPoints[id] = (qs.firstPoints[id] ?? 0) + w
      if (w >= 4 && !qs.finalField.includes(id)) qs.finalField.push(id)
    }
    if (all.has('user') && roundsWon(t, 'user') >= 4) {
      qs.userStage = 'final'
      sendMail(career, { from: 'qschool', subject: 'Through to the Final Stage', body: `You reached the last 16 on Day ${event.qsDay} of the First Stage and are through to the Final Stage (8–11 January).` })
    }
    if (event.qsDay === 3) {
      const rating = (id) => ratingOf(career, id)
      const list = Object.keys(qs.firstPoints).filter((id) => !qs.finalField.includes(id)).sort((a, b) => qs.firstPoints[b] - qs.firstPoints[a] || rating(b) - rating(a))
      const viaPoints = list.slice(0, 40)
      qs.finalField.push(...viaPoints)
      if (qs.userStage === 'first') {
        if (viaPoints.includes('user')) {
          qs.userStage = 'final'
          sendMail(career, { from: 'qschool', subject: 'Through to the Final Stage on points', body: `Your ${qs.firstPoints.user} First Stage wins put you #${list.indexOf('user') + 1} on the points list: you're through to the Final Stage.` })
        } else {
          qs.userStage = null
          sendMail(career, { from: 'qschool', subject: 'Q-School: First Stage over', body: `${qs.firstPoints.user ?? 0} wins weren't enough to reach the Final Stage (#${list.indexOf('user') + 1} on the points list, top 40 needed). You're a Challenge Tour member for ${career.year}: finish top 2 on its Order of Merit to win a Tour Card.` })
        }
      }
    }
    return
  }
  // Final Stage day
  for (const id of all) qs.finalPoints[id] = (qs.finalPoints[id] ?? 0) + roundsWon(t, id)
  const final = t.results[t.totalRounds - 1]?.[0]
  if (final) {
    for (const id of [final.a, final.b]) {
      if (!id || qs.cardWinners.includes(id)) continue
      qs.cardWinners.push(id)
      giveCard(career, id, `You reached the final on Day ${event.qsDay} of the Final Stage`)
    }
  }
  if (event.qsDay === 4) {
    const rating = (id) => ratingOf(career, id)
    const order = Object.keys(qs.finalPoints).filter((id) => !qs.cardWinners.includes(id)).sort((a, b) => qs.finalPoints[b] - qs.finalPoints[a] || rating(b) - rating(a))
    const pros = Object.values(career.players).filter((p) => p.tour === 'pro').length
    const needed = Math.max(0, TOUR_CARDS - pros)
    const here = Math.max(0, Math.min(QSCHOOL_CARDS[qs.school] - qs.cardWinners.length, needed))
    order.slice(0, here).forEach((id, i) => giveCard(career, id, `You finished #${i + 1} on the Q-School Order of Merit`))
    // The other Q-School hands out its cards too.
    fillCardsByStandard(career, TOUR_CARDS)
    qs.reserveList = order.slice(here)
    qs.done = true
    if (career.players.user.tour !== 'pro' && qs.finalPoints.user !== undefined) {
      const pos = order.indexOf('user') + 1
      sendMail(career, { from: 'qschool', subject: 'Q-School: Final Stage over', body: `No Tour Card this time: you finished #${pos} on the Q-School Order of Merit (${qs.finalPoints.user} points). You're #${qs.reserveList.indexOf('user') + 1} on the reserve list for Players Championships, and a Challenge Tour member for ${career.year}.` })
    }
    news(career, `Q-School ${career.year} is complete: ${qs.cardWinners.length + here} Tour Cards awarded at ${qs.school === 'UK' ? 'Milton Keynes' : 'Kalkar'}.`, event)
  }
}

function fillCardsByStandard(career, target) {
  const pros = Object.values(career.players).filter((p) => p.tour === 'pro').length
  const need = target - pros
  if (need <= 0) return []
  const picks = Object.values(career.players).filter((p) => p.tour !== 'pro' && p.id !== 'user').sort((a, b) => b.rating - a.rating + (Math.random() - 0.5) * 6).slice(0, need)
  for (const p of picks) {
    p.tour = 'pro'
    p.cardExpiry = career.year + 1
  }
  touch(career)
  return picks.map((p) => p.id)
}

// When the user isn't at Q-School, hand out the cards without playing it.
function silentQschool(career) {
  const picked = fillCardsByStandard(career, TOUR_CARDS)
  const rest = Object.values(career.players).filter((p) => p.tour !== 'pro' && p.id !== 'user').sort((a, b) => b.rating - a.rating).map((p) => p.id)
  career.qschool.reserveList = rest
  career.qschool.done = true
  news(career, `Q-School ${career.year}: ${picked.length} new Tour Card holders.`, currentEvent(career))
}

// ---------- season end ----------

export function endSeason(career, rng = Math.random) {
  const y = career.year
  const user = career.players.user
  const oom = ranking(career, 'oom')
  const ct = ranking(career, 'ct')
  const dt = ranking(career, 'dt')
  const r = rankOf(oom, 'user')
  const summary = {
    year: y, tour: user.tour, oomRank: r, ctRank: user.tour === 'pro' ? null : rankOf(ct, 'user'), dtRank: user.age <= 24 ? rankOf(dt, 'user') : null,
    money: user.earn[y]?.total ?? 0, ranked: user.earn[y]?.ranked ?? 0, titles: user.titles.filter((t) => t.startsWith(`${y} `)), outcome: '',
  }
  const lostCards = []
  const top64 = new Set(oom.slice(0, 64))
  const earnedCard = (id, list) => list.slice(0, 2).includes(id) && (career.players[id].earn[y]?.[list === ct ? 'ct' : 'dt'] ?? 0) > 0

  // Card holders: inside the top 64 keeps a card; an expiring card outside it is lost.
  for (const p of Object.values(career.players)) {
    if (p.tour !== 'pro') continue
    if (top64.has(p.id)) {
      if (p.cardExpiry <= y) p.cardExpiry = y + 2
    } else if (p.cardExpiry <= y) {
      p.tour = 'challenge'
      p.cardExpiry = null
      lostCards.push(p.id)
    }
  }
  // Challenge and Development Tour cards
  for (const list of [ct, dt]) {
    for (const id of list.slice(0, 2)) {
      const p = career.players[id]
      if (p.tour !== 'pro' && earnedCard(id, list)) {
        p.tour = 'pro'
        p.cardExpiry = y + 2
      }
    }
  }

  if (summary.tour === 'pro') {
    if (user.tour === 'pro') summary.outcome = user.cardExpiry === y + 2 && top64.has('user') ? `#${r} on the Order of Merit: Tour Card secure until the end of ${y + 2}.` : `#${r} on the Order of Merit. Your card runs to the end of ${user.cardExpiry}.`
    else summary.outcome = `#${r} on the Order of Merit, outside the top 64 with an expiring card. Tour Card lost: back to Q-School.`
  } else if (user.tour === 'pro') {
    summary.outcome = `Tour Card won for ${y + 1}–${y + 2} via the ${earnedCard('user', ct) ? 'Challenge' : 'Development'} Tour!`
  } else {
    summary.outcome = `No Tour Card: #${summary.ctRank ?? '—'} on the Challenge Tour${summary.dtRank ? `, #${summary.dtRank} on the Development Tour` : ''}. Back to Q-School in January.`
  }
  if (summary.tour !== user.tour || user.tour === 'pro') {
    sendMail(career, { from: 'office', date: `${y}-12-31`, subject: user.tour === 'pro' ? `Tour Card status for ${y + 1}` : 'Your Tour Card', body: summary.outcome })
  }

  career.lastSeason = { ct: ct.filter((id) => career.players[id].tour !== 'pro').slice(0, 16), dt: dt.filter((id) => career.players[id].tour !== 'pro').slice(0, 16), wo: ranking(career, 'wo').filter((id) => (career.players[id].earn[y]?.wo ?? 0) > 0).slice(0, 8), lostCards }
  const top = Object.values(career.players).map((p) => [p, p.earn[y]?.total ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 3)
  news(career, `Prize money ${y}: ${top.map(([p, v]) => `${p.name} ${money(v)}`).join(', ')} top the season's earnings.`)
  news(career, `SEASON ${y} REVIEW: ${summary.outcome}`)

  agePlayers(career, rng)
  user.age++
  prune(career)
  career.seasons.push(summary)
  career.seasonEnded = summary
  career.year = y + 1
  touch(career)
  startSeason(career, rng)
}

export { MONTHS }

// ---------- simulating ahead ----------

export function eventTime(e) {
  return Date.UTC(e.year, e.month - 1, e.day)
}

// Play out the rest of the active event, auto-simming every one of the user's matches.
export function autoPlayEvent(career, rng = Math.random) {
  const a = career.active
  if (!a) return
  a.live = null
  for (let guard = 0; guard < 60; guard++) {
    simulateUntilUserMatch(career, rng)
    const task = nextUserTask(career)
    if (task.kind === 'round' || task.kind === 'qualifier') simulateUserMatch(career, rng)
    else break
  }
  finishEvent(career, rng)
}

// Simulate everything up to (and including) a date.
//   mode 'play': enter the events you're eligible for and auto-sim your matches
//   mode 'skip': you're away; withdraw from everything
// Stops early for decisions only the player should make (Q-School registration and
// Premier League invitations) and at the end of the season.
export function simulatePeriod(career, { until, mode = 'play' }, rng = Math.random) {
  const startYear = career.year
  const bank = career.finance.bank
  const played = []
  let stoppedFor = null
  for (let guard = 0; guard < 400; guard++) {
    if (career.year !== startYear) {
      stoppedFor = 'season'
      break
    }
    const ev = currentEvent(career)
    if (!ev) break
    if (career.active) {
      const wasIn = !!career.active.userSide || career.active.userIn
      const name = ev.name
      autoPlayEvent(career, rng)
      if (wasIn) played.push({ name, result: career.lastResult?.text ?? '—', prize: career.lastResult?.prize ?? 0 })
      continue
    }
    if (eventTime(ev) > until) break
    const res = advance(career, rng)
    if (res.seasonEnded) {
      stoppedFor = 'season'
      break
    }
    const now = currentEvent(career)
    if (res.needs === 'qschool' || res.needs === 'premier') {
      stoppedFor = res.needs
      break
    }
    if (res.needs === 'entry') {
      if (eventTime(now) > until) break
      setEntry(career, now.id, mode === 'play' ? 'confirmed' : 'withdrawn')
    }
    if (res.needs === 'play' && eventTime(now) > until) break
  }
  return { played, money: career.finance.bank - bank, stoppedFor }
}
