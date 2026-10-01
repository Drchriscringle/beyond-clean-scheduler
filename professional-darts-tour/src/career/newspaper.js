// "The Oche Times": a front-page report emailed after every event the player takes part in.
// Everything is written from what actually happened: the run, the scores, averages,
// prize money and ranking movement.
import { pick } from '../engine/rng.js'
import { flag } from './players.js'

export const PAPER = 'The Oche Times'

const PUNDITS = [
  ['Terry Blake', 'two-time world finalist'],
  ['Maggie Doyle', 'Oche Times darts correspondent'],
  ['Ron "The Rocket" Whitely', 'former world champion'],
  ['Kev Arkwright', 'veteran commentator'],
]

const money = (n) => `£${Math.round(n).toLocaleString()}`
const surname = (name) => (name.split(' ').slice(-1)[0] || name).toUpperCase()

function scoreText(m) {
  return `${m.score[0]}–${m.score[1]}${m.sets ? ' in sets' : ''}`
}

// data: { stageRank, resultText, prize, userLog, champion, runnerUp, rankBefore, rankAfter,
//         ctBefore, ctAfter, cardWon, titles, venueCity, event, tv }
export function buildArticle(career, event, data, rng = Math.random) {
  const user = career.players.user
  const name = user.name
  const SUR = surname(name)
  const log = data.userLog
  const wins = log.filter((m) => m.userWon)
  const loss = log.find((m) => !m.userWon)
  const oppName = (id) => (id?.startsWith?.('T:') ? `the ${id.slice(2)} pair` : career.players[id]?.name ?? 'a qualifier')
  const oppNick = (id) => career.players[id]?.nickname
  const played = log.filter((m) => !m.simulated)
  const bestAvg = played.length ? Math.max(...played.map((m) => m.userAvg)) : null
  const tv = event.tier >= 3
  const r = data.stageRank
  const place = event.venue ? event.venue.split(',').slice(-1)[0].trim() : 'the oche'
  const giant = wins.find((m) => {
    const oppRank = data.oomList.indexOf(m.opponent) + 1
    return oppRank > 0 && oppRank <= 16 && (!data.rankBefore || data.rankBefore > oppRank + 10)
  })

  let kicker = tv ? 'TELEVISED SPECIAL' : 'DARTS REPORT'
  let extra = false
  let headline
  let subhead
  let tone
  if (data.cardWon) {
    extra = true
    tone = 'joy'
    kicker = 'TOUR CARD CONFIRMED'
    headline = pick([`${SUR} TURNS PRO!`, `TOUR CARD FOR ${SUR}!`, `${SUR} BOOKS PLACE AMONG THE ELITE`], rng)
    subhead = `Q-School glory: two-year Tour Card secured at ${place}`
  } else if (r === 0) {
    extra = true
    tone = 'joy'
    kicker = data.titles === 1 ? 'FIRST TITLE' : tv ? 'MAJOR CHAMPION' : 'CHAMPION'
    headline = data.titles === 1
      ? pick([`FIRST TITLE FOR ${SUR}!`, `${SUR}'S DREAM COMES TRUE`, `A STAR IS BORN: ${SUR} WINS!`], rng)
      : tv
        ? pick([`${SUR} CONQUERS ${event.name.toUpperCase()}!`, `KING OF ${place.toUpperCase()}!`, `${SUR} LIFTS THE BIG ONE`], rng)
        : pick([`${SUR} STRIKES GOLD`, `${SUR} DOES IT AGAIN!`, `NO STOPPING ${SUR}`, `${SUR} ROLLS ON IN ${place.toUpperCase()}`], rng)
    subhead = `${name} wins the ${event.name}${loss ? '' : data.final ? `, beating ${oppName(data.final.opponent)} ${scoreText(data.final)} in the final` : ''}`
  } else if (r === 1) {
    tone = 'close'
    headline = pick([`SO CLOSE FOR ${SUR}`, `FINAL HEARTBREAK FOR ${SUR}`, `${SUR} FALLS AT THE LAST`], rng)
    subhead = `Runner-up in the ${event.name} after defeat to ${oppName(loss?.opponent)}`
  } else if (r === 2 || r === 3) {
    tone = 'good'
    headline = giant ? pick([`GIANT-KILLER ${SUR}!`, `${SUR} STUNS THE STARS`], rng) : pick([`${SUR} RUN ENDS IN ${r === 2 ? 'SEMIS' : 'QUARTERS'}`, `BRAVE ${SUR} BOWS OUT`, `${SUR} MARCHES TO THE ${r === 2 ? 'LAST FOUR' : 'LAST EIGHT'}`], rng)
    subhead = `${r === 2 ? 'Semi-final' : 'Quarter-final'} finish in the ${event.name}${giant ? ` after shock win over ${oppName(giant.opponent)}` : ''}`
  } else if (data.qualifierLost) {
    tone = 'bad'
    kicker = 'QUALIFYING'
    headline = pick([`QUALIFYING HEARTBREAK FOR ${SUR}`, `NO ${event.name.toUpperCase()} FOR ${SUR}`, `${SUR} MISSES THE CUT`], rng)
    subhead = `Beaten by ${oppName(loss?.opponent)} with a place in the main draw at stake`
  } else if (!wins.length) {
    tone = 'bad'
    headline = giant ? `${SUR} UPSET` : pick([`${SUR} CRASHES OUT`, `FIRST-ROUND FLOP FOR ${SUR}`, `EARLY EXIT FOR ${SUR}`, `NIGHTMARE IN ${place.toUpperCase()}`], rng)
    subhead = `Opening-round defeat to ${oppName(loss?.opponent)} in the ${event.name}`
  } else {
    tone = giant ? 'good' : 'meh'
    headline = giant ? pick([`GIANT-KILLER ${SUR}!`, `${SUR} TOPPLES A TOP SEED`], rng) : pick([`${SUR} WINS ${wins.length}, THEN FALLS`, `MIXED DAY FOR ${SUR}`, `${SUR} RUN HALTED`], rng)
    subhead = `${data.resultText} at the ${event.name}`
  }
  if (data.nineDarter) {
    extra = true
    kicker = 'NINE-DART FINISH'
    headline = pick([`PERFECTION! ${SUR} HITS A NINE-DARTER`, `NINE-DART ${SUR} STUNS ${place.toUpperCase()}`, `PERFECT LEG FOR ${SUR}!`], rng)
    subhead = `The rarest feat in darts at the ${event.name}. ${data.resultText}.`
  } else if (data.bigFish && tone !== 'joy') {
    kicker = 'THE BIG FISH'
    headline = pick([`${SUR} LANDS THE BIG FISH`, `170! ${SUR} HOOKS THE MAXIMUM CHECKOUT`], rng)
  }
  if (event.key === 'premier') {
    kicker = 'PREMIER LEAGUE'
    subhead = `${event.name}: ${data.resultText.toLowerCase()}`
  }

  // --- the story
  const body = []
  const dateline = place.toUpperCase()
  const lead = {
    joy: `${dateline} — ${name}${user.nickname ? `, "${user.nickname}",` : ''} was celebrating last night after ${data.cardWon ? 'winning a PDC Tour Card' : `winning the ${event.name}`}${data.prize ? ` and a cheque for ${money(data.prize)}` : ''}.`,
    close: `${dateline} — ${name} came within a match of glory at the ${event.name} but had to settle for the runner-up spot${data.prize ? ` and ${money(data.prize)}` : ''}.`,
    good: `${dateline} — ${name} enjoyed a memorable run at the ${event.name}, reaching the ${r === 2 ? 'semi-finals' : 'quarter-finals'} before bowing out${data.prize ? ` with ${money(data.prize)}` : ''}.`,
    meh: `${dateline} — ${name} picked up ${wins.length} win${wins.length > 1 ? 's' : ''} at the ${event.name} before ${loss ? `losing to ${oppName(loss.opponent)}` : 'going out'}.`,
    bad: `${dateline} — It was a day to forget for ${name}, who ${data.qualifierLost ? `failed to qualify for the ${event.name}` : `was knocked out of the ${event.name} at the first hurdle`}.`,
  }[tone]
  body.push(lead)

  if (data.nineDarter) body.push(`The crowd rose as ${name} completed a nine-dart leg${data.nineDarter > 1 ? ` — ${data.nineDarter} of them` : ''}: 180, 180 and a finish in three darts.`)
  if (data.bigFish) body.push(`The highlight: a 170 checkout, T20, T20, bull, to a huge roar.`)
  if (log.length) {
    const path = log.map((m) => `${m.userWon ? 'beat' : 'lost to'} ${oppName(m.opponent)} ${scoreText(m)} (${m.stage.replace(/,.*/, '')})`)
    body.push(`The route: ${path.join('; ')}.`)
  }
  if (loss && oppNick(loss.opponent) && r !== 0) {
    body.push(`${oppName(loss.opponent)}, known on the circuit as "${oppNick(loss.opponent)}", ${loss.oppAvg ? `averaged ${loss.oppAvg.toFixed(1)} ` : ''}to end the run${loss.score[1] >= 3 && loss.score[0] === loss.score[1] - 1 ? ` in a ${loss.sets ? 'deciding-set' : 'last-leg'} thriller` : ''}.`)
  }
  if (bestAvg) body.push(`${name}'s best average of the ${event.key === 'premier' ? 'night' : 'event'} was ${bestAvg.toFixed(2)}${data.best180s ? `, with ${data.best180s} maximum${data.best180s > 1 ? 's' : ''} along the way` : ''}${data.highCheckout ? ` and a top checkout of ${data.highCheckout}` : ''}.`)
  if (data.rankAfter && data.rankBefore && data.rankAfter !== data.rankBefore) {
    body.push(`The result ${data.rankAfter < data.rankBefore ? `lifts ${name} ${data.rankBefore - data.rankAfter} place${data.rankBefore - data.rankAfter > 1 ? 's' : ''} to #${data.rankAfter}` : `sees ${name} slip to #${data.rankAfter}`} on the PDC Order of Merit.`)
  } else if (data.ctAfter) {
    body.push(`${name} is now #${data.ctAfter} on the Challenge Tour Order of Merit${data.ctAfter <= 2 ? ', in a Tour Card position' : data.ctAfter <= 5 ? ', just outside the Tour Card places' : ''}.`)
  }
  if (data.champion && data.champion !== 'user' && data.champion !== data.userSide) body.push(`The title went to ${oppName(data.champion)}${data.runnerUp ? `, who beat ${data.runnerUp === 'user' ? name : oppName(data.runnerUp)} in the final` : ''}.`)

  const quote = {
    joy: pick(['I\'ve dreamt about this since I was a kid throwing darts in the kitchen. Tonight I just let them fly.', 'The doubles went in when it mattered. I can\'t stop smiling.', 'Everyone back home, this one\'s for you. What a feeling.'], rng),
    close: pick(['It hurts right now, but I\'ll be back. I know I belong at this level.', 'One or two darts either way and I\'m holding the trophy. That\'s darts.'], rng),
    good: pick(['I\'m proud of that run. I\'m taking a lot of confidence into the next one.', 'I showed I can mix it with anyone. The work in the practice room is paying off.'], rng),
    meh: pick(['Some good stuff, some bad. I\'ll go away and work on my doubles.', 'Not bad, not great. On to the next one.'], rng),
    bad: pick(['I just didn\'t turn up today. No excuses.', 'The scoring was there but the doubles weren\'t. Back to the practice board.', 'Gutted. I\'ll put the hours in and come back stronger.'], rng),
  }[tone]
  const [pundit, role] = pick(PUNDITS, rng)
  const punditQuote = {
    joy: `"That's a proper performance. If ${name.split(' ')[0]} keeps scoring like that, the big names had better watch out."`,
    close: `"No shame in that. ${name.split(' ')[0]} will be back in finals, mark my words."`,
    good: `"Plenty to build on there. The scoring power is real."`,
    meh: `"Needs more consistency, but the talent is obvious."`,
    bad: `"A bad day at the office. Every player has them — it's how you respond that counts."`,
  }[tone]

  const sidebar = []
  if (data.rankAfter) sidebar.push({ title: 'RANKING WATCH', lines: [`PDC Order of Merit: #${data.rankAfter}`, data.rankBefore ? (data.rankAfter < data.rankBefore ? `▲ up ${data.rankBefore - data.rankAfter}` : data.rankAfter > data.rankBefore ? `▼ down ${data.rankAfter - data.rankBefore}` : 'No change') : 'New entry'] })
  else if (data.ctAfter) sidebar.push({ title: 'CHALLENGE TOUR', lines: [`Order of Merit: #${data.ctAfter}`, data.ctAfter <= 2 ? 'Tour Card position!' : `Top 2 win Tour Cards`] })
  sidebar.push({ title: 'BY THE NUMBERS', lines: [`Matches won: ${wins.length}/${log.length}`, bestAvg ? `Best average: ${bestAvg.toFixed(2)}` : 'Matches simulated', data.prize ? `Prize money: ${money(data.prize)}` : 'No prize money', data.best180s ? `180s: ${data.best180s}` : null].filter(Boolean) })
  if (data.otherNews?.length) sidebar.push({ title: 'ELSEWHERE', lines: data.otherNews })

  return {
    paper: PAPER,
    date: data.date,
    edition: pick(['MORNING FINAL', 'LATE EDITION', 'SPORTS SPECIAL', 'EVENING FINAL'], rng),
    strap: extra ? `${PAPER.toUpperCase()} PLAYER OF THE WEEK` : `${event.name.toUpperCase()} · ${place.toUpperCase()}`,
    extra,
    kicker,
    headline,
    subhead,
    photo: { caption: `${flag(user.nation)} ${name} at ${event.venue ?? 'the oche'}`, mood: tone },
    body,
    quote: { text: quote, by: name },
    pundit: { text: punditQuote, by: `${pundit}, ${role}` },
    sidebar,
  }
}
