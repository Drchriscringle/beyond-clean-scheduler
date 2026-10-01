// Rivalries and press conferences. Your public profile (0–100, starts at 50) nudges what
// sponsors will pay: see profileFactor in marketValue.
import { TV_EVENTS } from './data/competitions.js'
import { news, sendMail } from './inbox.js'

export const profileOf = (career) => career.profile ?? 50
export const profileFactor = (career) => 0.8 + profileOf(career) / 250 // 0.8–1.2

export function profileLabel(p) {
  if (p >= 85) return 'Box-office star'
  if (p >= 70) return 'Crowd favourite'
  if (p >= 55) return 'Rising name'
  if (p >= 40) return 'Known on the circuit'
  if (p >= 25) return 'Low profile'
  return 'Media shy'
}

function bump(career, n) {
  career.profile = Math.max(0, Math.min(100, profileOf(career) + n))
}

const name = (career, id) => career.players[id]?.name ?? 'your opponent'
const surname = (career, id) => name(career, id).split(' ').slice(-1)[0]

export function isRival(career, id) {
  return !!id && career.rival?.id === id
}

function startRivalry(career, id, reason, event) {
  if (!id || id === 'user' || id.startsWith?.('T:') || !career.players[id]) return
  if (career.rival?.id === id) return
  career.rival = { id, since: career.year, reason }
  const who = name(career, id)
  sendMail(career, {
    from: 'Darts World magazine',
    subject: `A rivalry is born: you v ${who}`,
    body: `${reason}\n\nThe fans have noticed. Every time you're drawn against ${who} the crowd will be up for it, and the media will want to hear from you. Beat ${surname(career, id)} and your profile soars; lose and you'll hear about it.`,
  })
  news(career, `RIVALRY: ${career.players.user.name} and ${who} are fast becoming the tour's must-see match-up.`, event)
}

// Called after every match you play or simulate (individual opponents only).
export function afterMatch(career, { opponent, won, stage, event, played }) {
  if (!opponent || opponent.startsWith?.('T:') || !career.players[opponent]) return
  const h = career.h2h[opponent]
  const big = TV_EVENTS.includes(event.key) || /Final|Semi/.test(stage)
  if (isRival(career, opponent)) {
    bump(career, won ? (big ? 5 : 3) : big ? -3 : -2)
    news(career, won
      ? `${career.players.user.name} gets one over rival ${name(career, opponent)} in the ${stage} of the ${event.name} (${h.w}–${h.l} head to head).`
      : `${name(career, opponent)} has the bragging rights again, beating rival ${career.players.user.name} in the ${stage} of the ${event.name}.`, event)
  } else if (h && h.w + h.l >= 3 && Math.abs(h.w - h.l) <= 1) {
    startRivalry(career, opponent, `You and ${name(career, opponent)} have now met ${h.w + h.l} times, and it's ${h.w}–${h.l}. Nothing separates you.`, event)
  } else if (!won && big && /Final/.test(stage) && !career.rival) {
    startRivalry(career, opponent, `${name(career, opponent)} beat you in the ${stage} of the ${event.name}. You'll want revenge.`, event)
  }
  if (played && won && big) bump(career, 1)
}

// --- Press conferences --------------------------------------------------------------------
const ANSWERS = {
  humble: { label: 'Stay humble', tone: 'humble' },
  confident: { label: 'Back yourself', tone: 'confident' },
  fiery: { label: 'Fire a shot', tone: 'fiery' },
}

function questionFor(career, ctx) {
  const opp = name(career, ctx.opponent)
  const s = surname(career, ctx.opponent)
  const rival = isRival(career, ctx.opponent)
  if (ctx.title) {
    return { q: `You're the ${ctx.event.name} champion! What does this one mean to you?`, answers: {
      humble: `I'm just grateful. ${s} pushed me all the way and my family are here.`,
      confident: `I've been saying all season I'm good enough. This is the first of many.`,
      fiery: `Write my name on the trophy and tell the rest of the tour I'm coming for all of it.`,
    } }
  }
  if (ctx.won) {
    const qs = rival
      ? `Another win over your rival ${opp}. Is there any love lost between you two?`
      : ctx.avg >= 90
        ? `A big average out there tonight. How good did that feel?`
        : `You're through to the next round. How did you find ${opp} out there?`
    return { q: qs, answers: {
      humble: `${s} is a top player. I just did enough on the day.`,
      confident: `I felt in control from the first leg. That's the standard I expect.`,
      fiery: rival ? `${s} talks a good game. I just keep winning.` : `To be honest, ${s} never looked like beating me.`,
    } }
  }
  return { q: rival ? `${opp} has the upper hand on you again. Is that eating at you?` : `Tough one tonight. What went wrong against ${opp}?`, answers: {
    humble: `Credit to ${s}, the better player on the night. I'll go back to the practice board.`,
    confident: `One bad night doesn't change anything. I'll be back stronger.`,
    fiery: `${s} got lucky on the doubles. Put us on the stage again and it's a different story.`,
  } }
}

// Decide whether the media want you after a match you played on the oche.
export function maybePress(career, { opponent, won, stage, event, avg, title, rng = Math.random }) {
  if (!opponent || opponent.startsWith?.('T:') || !career.players[opponent]) return
  if (career.settings?.press === false) return
  const tv = TV_EVENTS.includes(event.key) || event.key === 'grandslam' || event.key === 'worldcup'
  const want = title || tv || isRival(career, opponent) || /Final|Semi/.test(stage) || rng() < 0.12
  if (!want) return
  const { q, answers } = questionFor(career, { opponent, won, stage, event, avg, title })
  career.pressPending = {
    opponent, won, title: !!title, stage, event: event.name,
    question: q,
    answers: Object.entries(answers).map(([key, text]) => ({ key, label: ANSWERS[key].label, text })),
  }
}

// key: 'humble' | 'confident' | 'fiery' | 'skip'
export function answerPress(career, key) {
  const p = career.pressPending
  if (!p) return null
  career.pressPending = null
  const me = career.players.user.name
  let effect
  if (key === 'skip') {
    bump(career, -2)
    news(career, `${me} declines to speak to the media after the ${p.stage} at the ${p.event}.`)
    return { profile: -2, text: 'The press weren’t impressed you walked out.' }
  }
  const ans = p.answers.find((a) => a.key === key)
  if (key === 'humble') effect = 1
  else if (key === 'confident') effect = p.won ? 2 : 0
  else effect = p.won ? 4 : 2
  bump(career, effect)
  news(career, `${me} after the ${p.stage} at the ${p.event}: “${ans.text}”`)
  let text = effect > 0 ? `Your profile rises (+${effect}).` : 'The media move on.'
  if (key === 'fiery' && !isRival(career, p.opponent)) {
    startRivalry(career, p.opponent, `Your comments about ${name(career, p.opponent)} after the ${p.event} made the back pages. ${surname(career, p.opponent)} has responded on social media: “See you on the oche.”`)
    text += ` You've started a rivalry with ${name(career, p.opponent)}.`
  }
  return { profile: effect, text }
}
