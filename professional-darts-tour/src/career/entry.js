// Entry rules for every competition, and the field of AI players around you.
// eligibility() answers "can the player get in, and how?"; buildField() makes the draw.
import { COMPETITIONS, TV_EVENTS } from './data/competitions.js'
import { ranking, rankOf } from './rankings.js'
import { NATION_CODES, nationName } from './players.js'
import { shuffle } from '../engine/rng.js'

const NORDIC_BALTIC = ['SWE', 'DEN', 'NOR', 'FIN', 'LAT', 'LTU', 'ISL']
const EAST_EUROPE = ['POL', 'CZE', 'SVK', 'HUN', 'CRO']
const WS_LOCALS = { BHR: ['BHR', 'IND', 'PHI', 'SGP'], KSA: ['BHR', 'IND', 'PHI', 'SGP'], DEN: NORDIC_BALTIC, USA: ['USA', 'CAN'], NZL: ['NZL', 'AUS'], AUS: ['AUS', 'NZL'] }

export const isPro = (career, id) => career.players[id]?.tour === 'pro'

function cardHolders(career) {
  return ranking(career, 'oom').filter((id) => isPro(career, id))
}

// Previous season's top N on an affiliate tour (stored at season end).
function lastYearTop(career, key, n) {
  return (career.lastSeason?.[key] ?? []).slice(0, n)
}

// { status: 'in'|'qualifier'|'reserve'|'out'|'skip', reason, qualifier?, seed? }
export function eligibility(career, event) {
  const user = career.players.user
  const pro = user.tour === 'pro'
  const oom = ranking(career, 'oom')
  const r = rankOf(oom, 'user')
  const pt = ranking(career, 'pt').filter((id) => !oom.slice(0, 16).includes(id))
  const q = (name, wins, sets = false) => ({ status: 'qualifier', reason: `Enter the ${name}`, qualifier: { name, wins, sets } })

  switch (event.key) {
    case 'qsFirst':
    case 'qsFinal': {
      const qs = career.qschool
      if (!qs?.registered || qs.done) return { status: 'skip' }
      if (event.key === 'qsFirst' && qs.userStage !== 'first') return { status: 'skip' }
      if (event.key === 'qsFinal' && qs.userStage !== 'final') return { status: 'skip' }
      return { status: 'in', reason: event.key === 'qsFinal' ? 'Final Stage' : 'First Stage entrant', auto: true }
    }
    case 'ct':
      if (pro) return { status: 'out', reason: 'Tour Card holders cannot play the Challenge Tour' }
      if (!career.qschool?.registered) return { status: 'out', reason: 'Only players who entered Q-School this year' }
      return { status: 'in', reason: 'Q-School entrant without a Tour Card' }
    case 'dt':
      if (user.age > 24) return { status: 'out', reason: 'Ages 16–24 only' }
      if (r && r <= 64 && pro) return { status: 'out', reason: 'Players inside the top 64 cannot enter' }
      return { status: 'in', reason: `Aged ${user.age}` }
    case 'pc':
      if (pro) return { status: 'in', reason: 'Tour Card holder' }
      return { status: 'reserve', reason: 'Spare places go to the Q-School reserve list' }
    case 'et': {
      if (r && r <= 16) return { status: 'in', reason: `Seeded: #${r} on the Order of Merit`, seed: true }
      const ptr = rankOf(pt, 'user')
      if (pro && ptr && ptr <= 16) return { status: 'in', reason: `Top 16 on the Pro Tour Order of Merit (#${ptr} of the non-seeds)` }
      if (pro) return q('Tour Card Holder Qualifier', 3)
      if (user.nation === event.country) return q('Host Nation Qualifier', 3)
      if (NORDIC_BALTIC.includes(user.nation)) return q('Nordic & Baltic Associate Qualifier', 3)
      if (EAST_EUROPE.includes(user.nation)) return q('East European Associate Qualifier', 3)
      return { status: 'out', reason: 'Tour Card holders, or host-nation/associate qualifiers only' }
    }
    case 'ukopen': {
      if (pro) {
        const cr = rankOf(cardHolders(career), 'user')
        const round = cr <= 32 ? 4 : cr <= 64 ? 3 : cr <= 96 ? 2 : 1
        return { status: 'in', reason: `Tour Card holder #${cr}: enters in round ${round}` }
      }
      if (lastYearTop(career, 'ct', 8).includes('user') || lastYearTop(career, 'dt', 8).includes('user')) return { status: 'in', reason: 'Top 8 on last season’s Challenge/Development Tour' }
      return q("Riley's Amateur Qualifier", 3)
    }
    case 'masters':
      if (r && r <= 24) return { status: 'in', reason: `Top 24 on the Order of Merit (#${r})` }
      if (r && r <= 40) return q('Preliminary Round', 1, true)
      return { status: 'out', reason: `Top 24 on the Order of Merit, plus a preliminary round for 25–40${r ? ` (you're #${r})` : ''}` }
    case 'matchplay':
    case 'grandprix': {
      if (r && r <= 16) return { status: 'in', reason: `Seeded: #${r} on the Order of Merit`, seed: true }
      const ptr = rankOf(pt, 'user')
      if (ptr && ptr <= 16) return { status: 'in', reason: `Top 16 on the Pro Tour Order of Merit` }
      return { status: 'out', reason: `Top 16 on the Order of Merit or top 16 non-qualified on the Pro Tour${ptr ? ` (you're #${ptr})` : ''}` }
    }
    case 'eurochamp': {
      const er = rankOf(ranking(career, 'et'), 'user')
      if (er && er <= 32 && (career.players.user.earn[career.year]?.et ?? 0) > 0) return { status: 'in', reason: `#${er} on the European Tour Order of Merit` }
      return { status: 'out', reason: 'Top 32 on the European Tour Order of Merit' }
    }
    case 'pcfinals': {
      const pr = rankOf(ranking(career, 'pc'), 'user')
      if (pr && pr <= 64 && (career.players.user.earn[career.year]?.pc ?? 0) > 0) return { status: 'in', reason: `#${pr} on the Players Championship Order of Merit` }
      return { status: 'out', reason: 'Top 64 on the Players Championship Order of Merit' }
    }
    case 'grandslam': {
      const list = grandSlamQualifiers(career)
      const hit = list.find((x) => x.id === 'user')
      if (hit) return { status: 'in', reason: hit.why }
      if (pro) return q('Grand Slam Tour Card Holder Qualifier', 3)
      return { status: 'out', reason: 'TV finalists, tour winners and qualifiers only' }
    }
    case 'worlds': {
      const w = worldsQualifiers(career)
      const hit = w.find((x) => x.id === 'user')
      if (hit) return { status: 'in', reason: hit.why }
      if (pro) return q('PDPA Qualifier', 4)
      return q('Regional Qualifier', 4)
    }
    case 'premier':
    case 'plPlayoffs': {
      const pl = career.pl
      if (!pl?.players.includes('user')) return { status: 'out', reason: 'Invitation only' }
      if (event.key === 'plPlayoffs') {
        const top4 = plTable(career).slice(0, 4)
        return top4.includes('user') ? { status: 'in', reason: 'Top four in the league', auto: true } : { status: 'out', reason: 'Top four only' }
      }
      return { status: 'in', reason: 'Premier League player', auto: true }
    }
    case 'worldcup': {
      const team = worldCupTeams(career).find((t) => t.players.includes('user'))
      if (team) return { status: 'in', reason: `Representing ${nationName(team.nation)}` }
      return { status: 'out', reason: 'Each nation sends its two best-ranked players' }
    }
    case 'ws': {
      if (r && r <= 8) return { status: 'in', reason: 'Invited as a PDC representative', seed: true }
      if (!pro && (WS_LOCALS[event.country] ?? []).includes(user.nation)) return q('Local Qualifier', 2)
      return { status: 'out', reason: 'Invitation only (top 8), plus local qualifiers' }
    }
    case 'wsfinals': {
      const field = wsFinalsField(career)
      return field.includes('user') ? { status: 'in', reason: 'Qualified on the World Series / PDC Order of Merit' } : { status: 'out', reason: 'Top 8 on the World Series Order of Merit plus 16 from the PDC Order of Merit' }
    }
    default:
      return { status: 'out', reason: '' }
  }
}

// ---------- special qualification lists ----------

export function grandSlamQualifiers(career) {
  const y = career.year
  const out = []
  const add = (id, why) => {
    if (id && !out.some((x) => x.id === id) && out.length < 24) out.push({ id, why })
  }
  const window = career.honours.filter((h) => (h.year === y && h.month <= 11) || (h.year === y - 1 && h.month === 12) || (h.year === y - 1 && h.month === 11 && h.day > 14))
  const tv = window.filter((h) => TV_EVENTS.includes(h.key))
  for (const h of tv) add(h.winner, `${h.name} winner`)
  for (const h of tv) add(h.runnerUp, `${h.name} runner-up`)
  add(ranking(career, 'ct')[0], 'Challenge Tour Order of Merit winner')
  add(ranking(career, 'dt')[0], 'Development Tour Order of Merit winner')
  const winsBy = (key) => {
    const counts = {}
    for (const h of career.honours) if (h.year === y && h.key === key) counts[h.winner] = (counts[h.winner] ?? 0) + 1
    const oom = ranking(career, 'oom')
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || oom.indexOf(a) - oom.indexOf(b))
  }
  for (const id of winsBy('et')) add(id, 'European Tour winner')
  for (const id of winsBy('pc')) add(id, 'Players Championship winner')
  return out
}

export function worldsQualifiers(career) {
  const oom = ranking(career, 'oom')
  const out = []
  const has = (id) => out.some((x) => x.id === id)
  oom.slice(0, 40).forEach((id, i) => out.push({ id, why: `#${i + 1} on the Order of Merit`, seed: i < 32 ? i + 1 : null }))
  const pt = ranking(career, 'pt').filter((id) => !has(id)).slice(0, 40)
  pt.forEach((id, i) => out.push({ id, why: `Pro Tour Order of Merit qualifier`, ptSeed: i < 24 }))
  for (const key of ['ct', 'dt']) {
    let n = 0
    for (const id of ranking(career, key)) {
      if (n >= 3) break
      if (has(id)) continue
      if ((career.players[id].earn[career.year]?.[key] ?? 0) <= 0) break
      out.push({ id, why: `Top 3 on the ${key === 'ct' ? 'Challenge' : 'Development'} Tour` })
      n++
    }
  }
  return out
}

export function wsFinalsField(career) {
  const ws = ranking(career, 'ws').filter((id) => (career.players[id].earn[career.year]?.ws ?? 0) > 0).slice(0, 8)
  const rest = ranking(career, 'oom').filter((id) => !ws.includes(id)).slice(0, 16)
  return [...ws, ...rest]
}

export function worldCupTeams(career) {
  // Everyone, ranked players first (by Order of Merit), then unranked by standard.
  const oom = ranking(career, 'oom')
  const ranked = new Set(oom)
  const rest = Object.values(career.players).filter((p) => !ranked.has(p.id)).sort((a, b) => (b.rating ?? career.user.avg) - (a.rating ?? career.user.avg)).map((p) => p.id)
  const byNation = {}
  ;[...oom, ...rest].forEach((id, i) => {
    const n = career.players[id].nation
    if (!n) return
    ;(byNation[n] ??= []).push([id, i + 1])
  })
  const teams = NATION_CODES.filter((n) => (byNation[n]?.length ?? 0) >= 2).map((n) => {
    const [a, b] = byNation[n]
    return { id: `T:${n}`, nation: n, players: [a[0], b[0]], combined: a[1] + b[1] }
  })
  return teams.sort((x, y) => x.combined - y.combined).slice(0, COMPETITIONS.worldcup.size)
}

export function plTable(career) {
  const t = career.pl.table
  return [...career.pl.players].sort((a, b) => t[b].points - t[a].points || t[b].legsFor - t[b].legsAgainst - (t[a].legsFor - t[a].legsAgainst) || t[b].legsFor - t[a].legsFor)
}

// ---------- fields ----------

const take = (list, exclude, n) => {
  const out = []
  for (const id of list) {
    if (out.length >= n) break
    if (!exclude.has(id)) {
      out.push(id)
      exclude.add(id)
    }
  }
  return out
}

// Returns { kind, entrants, joins?, groups?, seedsToKo?, teams?, reason }
export function buildField(career, event, userIn, rng = Math.random) {
  const comp = COMPETITIONS[event.key]
  const oom = ranking(career, 'oom')
  const cards = oom.filter((id) => isPro(career, id))
  const nonCard = oom.filter((id) => !isPro(career, id))
  const used = new Set()
  const ai = (list) => list.filter((id) => id !== 'user')
  const mine = (list) => (userIn ? list : ai(list))

  switch (event.key) {
    case 'ct':
    case 'dt': {
      const pool = ai(ranking(career, event.key)).filter((id) => event.key === 'ct' || career.players[id].age <= 24 || !isPro(career, id))
      const field = shuffle(pool, rng).slice(0, comp.size - (userIn ? 1 : 0))
      return { entrants: userIn ? ['user', ...field] : field }
    }
    case 'pc': {
      const withdrawals = Math.floor(rng() * 7)
      const away = new Set(shuffle(ai(cards), rng).slice(0, withdrawals))
      let field = cards.filter((id) => !away.has(id) && (id !== 'user' || userIn))
      const reserves = (career.qschool?.reserveList ?? nonCard).filter((id) => !isPro(career, id) && id !== 'user')
      // A confirmed entry always makes the draw, even for the lowest-ranked card holder.
      if (userIn) field = ['user', ...field.filter((id) => id !== 'user')]
      field = [...field, ...take(reserves, new Set(field), comp.size - field.length)]
      return { entrants: field.slice(0, comp.size), spare: withdrawals }
    }
    case 'et': {
      const seeds = take(oom.filter((id) => id !== 'user' || (userIn && event.userSeed)), used, 16)
      used.add('user')
      const ptList = take(ai(ranking(career, 'pt')), used, 16)
      const tchq = take(shuffle(ai(cards), rng).sort((a, b) => career.players[b].rating - career.players[a].rating + (rng() - 0.5) * 12), used, 10)
      const host = take(shuffle(ai(nonCard).filter((id) => career.players[id].nation === event.country), rng), used, 4)
      const assoc = take(shuffle(ai(nonCard), rng), used, 26 - tchq.length - host.length)
      let rest = [...ptList, ...tchq, ...host, ...assoc]
      if (userIn && !event.userSeed) rest = [...rest.slice(0, -1), 'user']
      return { entrants: [...seeds, ...shuffle(rest, rng)] }
    }
    case 'ukopen': {
      const holders = ai(cards)
      if (userIn && isPro(career, 'user')) holders.splice(Math.min(127, (rankOf(cards, 'user') ?? 128) - 1), 0, 'user')
      const joins = [holders.slice(96, 128), holders.slice(64, 96), holders.slice(32, 64), holders.slice(0, 32)]
      const r1Extra = [...lastYearTop(career, 'ct', 8), ...lastYearTop(career, 'dt', 8)].filter((id) => !isPro(career, id) && id !== 'user')
      if (userIn && !isPro(career, 'user')) r1Extra.push('user')
      const amateurs = take(shuffle(ai(nonCard), rng), new Set([...r1Extra, ...holders]), 64 - joins[0].length - r1Extra.length)
      joins[0] = [...joins[0], ...r1Extra, ...amateurs].slice(0, 64)
      return { kind: 'staged', joins }
    }
    case 'masters': {
      const top = mine(oom).slice(0, 24)
      const prelim = oom.slice(24, 40).filter((id) => id !== 'user')
      const quals = shuffle(prelim, rng).sort((a, b) => career.players[b].rating - career.players[a].rating + (rng() - 0.5) * 10).slice(0, 8)
      let entrants = [...top.filter((id) => id !== 'user' || userIn), ...quals]
      if (userIn && !entrants.includes('user')) entrants = [...top.filter((id) => id !== 'user'), ...quals.slice(0, 7), 'user']
      return { entrants: entrants.slice(0, 32) }
    }
    case 'matchplay':
    case 'grandprix': {
      const seeds = mine(oom).slice(0, 16)
      const pt = take(mine(ranking(career, 'pt')), new Set(seeds), 16)
      return { entrants: [...seeds, ...shuffle(pt, rng)] }
    }
    case 'eurochamp':
      return { entrants: mine(ranking(career, 'et')).slice(0, 32) }
    case 'pcfinals':
      return { entrants: mine(ranking(career, 'pc')).slice(0, 64) }
    case 'grandslam': {
      let list = grandSlamQualifiers(career).map((x) => x.id)
      if (!userIn) list = list.filter((id) => id !== 'user')
      const extra = shuffle(ai(cards).filter((id) => !list.includes(id)), rng).sort((a, b) => career.players[b].rating - career.players[a].rating + (rng() - 0.5) * 14)
      list = [...list, ...extra].slice(0, userIn && !list.includes('user') ? 31 : 32)
      if (userIn && !list.includes('user')) list.push('user')
      // Pots by Order of Merit, one player from each pot per group.
      const ordered = [...list].sort((a, b) => oom.indexOf(a) - oom.indexOf(b))
      const pots = [0, 1, 2, 3].map((i) => shuffle(ordered.slice(i * 8, i * 8 + 8), rng))
      const groups = Array.from({ length: 8 }, (_, g) => pots.map((p) => p[g]))
      return { kind: 'groups', groups }
    }
    case 'worlds': {
      const q = worldsQualifiers(career).filter((x) => x.id !== 'user' || userIn)
      const seeds = [...q.filter((x) => x.seed).map((x) => x.id), ...q.filter((x) => !x.seed && oom.indexOf(x.id) < 40 && oom.indexOf(x.id) >= 0).map((x) => x.id), ...q.filter((x) => x.ptSeed).map((x) => x.id)].slice(0, 64)
      const seedSet = new Set(seeds)
      let unseeded = q.map((x) => x.id).filter((id) => !seedSet.has(id))
      if (userIn && !seeds.includes('user') && !unseeded.includes('user')) unseeded.push('user')
      const intl = take(shuffle(ai(nonCard), rng).sort((a, b) => career.players[b].rating - career.players[a].rating + (rng() - 0.5) * 16), new Set([...seeds, ...unseeded]), 128 - seeds.length - unseeded.length)
      return { entrants: [...seeds, ...shuffle([...unseeded, ...intl], rng)] }
    }
    case 'ws': {
      const invited = oom.filter((id) => id !== 'user' || (userIn && event.userSeed)).slice(0, 8)
      const region = WS_LOCALS[event.country] ?? []
      let locals = shuffle(ai(nonCard).filter((id) => region.includes(career.players[id].nation)), rng)
      locals = [...locals, ...shuffle(ai(nonCard), rng)].filter((id, i, a) => a.indexOf(id) === i).slice(0, 8)
      if (userIn && !event.userSeed) locals = [...locals.slice(0, 7), 'user']
      return { entrants: [...invited, ...locals] }
    }
    case 'wsfinals': {
      const f = wsFinalsField(career)
      return { entrants: userIn ? f : [...ai(f), ...ai(oom).filter((id) => !f.includes(id)).slice(0, 1)] }
    }
    case 'worldcup': {
      const teams = worldCupTeams(career)
      const seeds = teams.slice(0, 4).map((t) => t.id)
      const pot1 = shuffle(teams.slice(4, 16).map((t) => t.id), rng)
      const pot2 = shuffle(teams.slice(16).map((t) => t.id), rng)
      const groups = pot1.map((s, i) => [s, pot2[i * 2], pot2[i * 2 + 1]])
      return { kind: 'groups', groups, seedsToKo: seeds, teams: Object.fromEntries(teams.map((t) => [t.id, t])) }
    }
    default:
      return { entrants: mine(cards).slice(0, comp.size) }
  }
}
