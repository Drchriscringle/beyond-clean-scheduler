// The MCs. Calls get bigger with the score: a 26 is read flat and quick, a ton is lifted,
// a ton-forty rises, and a 180 gets the full drawn-out "one hundred and... eight-y!".
// Calls are built from short phrases, each with its own pitch, speed and volume.
// On a phone the native text-to-speech plugin is used (Android's WebView has no speech);
// in a browser, the Web Speech API. A British male voice is preferred when available.
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function under100(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? '-' + ONES[n % 10] : ''}`
}

export function numberWords(n) {
  if (n === 0) return 'no score'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (!hundreds) return under100(rest)
  return `${ONES[hundreds]} hundred${rest ? ' and ' + under100(rest) : ''}`
}

// Five (fictional) MCs. Each has a preferred system voice, a base pitch and pace, how much
// they rise for big scores, and their own lines. One is picked at random for each match
// unless the player chooses a favourite. On phones with few voices installed, two MCs may
// share a voice, but pitch, pace and lines still set them apart.
export const ANNOUNCERS = [
  {
    id: 'ron', name: 'Big Ron Bellamy', blurb: 'Deep, booming, takes his time over a maximum',
    voices: ['Daniel', 'Google UK English Male', 'Microsoft George', 'Arthur'], lang: 'en-GB', gender: 'm',
    pitch: 0.72, rate: 0.86, excite: 1.25,
    gameShot: (k) => ['Game shot!', `And the ${k}.`], intro: 'Ladies and gentlemen... let\'s play darts!', require: (n) => `you require ${n}.`,
  },
  {
    id: 'johnny', name: 'Johnny "The Voice" Kane', blurb: 'Fast, loud and gets carried away',
    voices: ['Oliver', 'Google UK English Male', 'Microsoft Ryan', 'Daniel'], lang: 'en-GB', gender: 'm',
    pitch: 1.0, rate: 1.06, excite: 1.5,
    gameShot: (k) => ['Game shot!', `That's the ${k}!`], intro: 'Are you ready? It\'s showtime!', require: (n) => `you need ${n}!`,
  },
  {
    id: 'steve', name: 'Steve Rowley', blurb: 'Smooth, classic British delivery',
    voices: ['Arthur', 'Microsoft George', 'Google UK English Male', 'Daniel'], lang: 'en-GB', gender: 'm',
    pitch: 0.88, rate: 0.94, excite: 1.0,
    gameShot: (k) => ['Game shot,', `and the ${k}.`], intro: 'Good evening, and welcome to the oche.', require: (n) => `you require ${n}.`,
  },
  {
    id: 'bruce', name: 'Bruce Dawson', blurb: 'Lively Aussie who loves a big finish',
    voices: ['Gordon', 'Lee', 'Karen', 'Google UK English Male'], lang: 'en-AU', gender: 'm',
    pitch: 0.95, rate: 1.0, excite: 1.35,
    gameShot: (k) => ['Game shot!', `Beauty, that's the ${k}!`], intro: 'G\'day darts fans, let\'s get into it!', require: (n) => `you're on ${n}.`,
  },
  {
    id: 'kelly', name: 'Kelly Marsh', blurb: 'Crisp and confident, never misses a beat',
    voices: ['Serena', 'Kate', 'Martha', 'Google UK English Female', 'Microsoft Hazel', 'Microsoft Libby'], lang: 'en-GB', gender: 'f',
    pitch: 1.05, rate: 0.98, excite: 1.15,
    gameShot: (k) => ['Game shot!', `And the ${k}.`], intro: 'Welcome everyone. Game on!', require: (n) => `you require ${n}.`,
  },
]

let current = ANNOUNCERS[0]

// choice: 'random' or an announcer id. Returns the announcer for this match.
export function pickAnnouncer(choice = 'random', rng = Math.random) {
  current = ANNOUNCERS.find((a) => a.id === choice) ?? ANNOUNCERS[Math.floor(rng() * ANNOUNCERS.length)]
  voice = null
  nativeVoice = null
  return current
}

export function currentAnnouncer() {
  return current
}

let voice = null
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  const wantFemale = current.gender === 'f'
  voice =
    current.voices.map((name) => voices.find((v) => v.name.includes(name))).find(Boolean) ??
    voices.find((v) => v.lang === current.lang && (wantFemale ? /female/i.test(v.name) : !/female/i.test(v.name))) ??
    voices.find((v) => v.lang === current.lang) ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  return voice
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice() }

// Native TTS chooses a voice by index from the device's list.
let nativeVoice = null
async function pickNativeVoice() {
  if (nativeVoice !== null) return nativeVoice
  try {
    const { voices } = await TextToSpeech.getSupportedVoices()
    const wantFemale = current.gender === 'f'
    let i = -1
    for (const name of current.voices) {
      i = voices.findIndex((v) => v.name?.includes(name))
      if (i >= 0) break
    }
    if (i < 0) i = voices.findIndex((v) => v.lang?.replace('_', '-') === current.lang && (wantFemale ? /female/i.test(v.name) : !/female/i.test(v.name ?? '')))
    if (i < 0) i = voices.findIndex((v) => v.lang?.replace('_', '-') === current.lang)
    nativeVoice = i
  } catch {
    nativeVoice = -1
  }
  return nativeVoice
}

// Apply the MC's character: base pitch/pace, and how far they rise above it.
function styled(p) {
  const a = current
  const pitch = a.pitch * (1 + ((p.pitch ?? 1) - 1) * a.excite)
  const rate = a.rate * (1 + ((p.rate ?? 1) - 1) * a.excite)
  return { ...p, pitch: Math.max(0.5, Math.min(2, pitch)), rate: Math.max(0.4, Math.min(1.6, rate)) }
}

// parts: [{ text, pitch, rate, volume }]
let nativeChain = Promise.resolve()
export function speakParts(rawParts, enabled = true) {
  if (!enabled || !rawParts.length) return
  const parts = rawParts.map(styled)
  if (Capacitor.isNativePlatform()) {
    nativeChain = nativeChain.then(async () => {
      const v = await pickNativeVoice()
      for (const p of parts) {
        await TextToSpeech.speak({ text: p.text, lang: current.lang, rate: p.rate, pitch: p.pitch, volume: p.volume ?? 1, category: 'playback', ...(v >= 0 ? { voice: v } : {}) }).catch(() => {})
      }
    })
    return
  }
  if (typeof speechSynthesis === 'undefined') return
  const v = pickVoice()
  for (const p of parts) {
    const u = new SpeechSynthesisUtterance(p.text)
    if (v) u.voice = v
    u.lang = v?.lang ?? current.lang
    u.rate = p.rate
    u.pitch = p.pitch
    u.volume = p.volume ?? 1
    speechSynthesis.speak(u)
  }
}

// Plain announcement in the MC's normal delivery.
export function say(text, enabled = true, style = 'normal') {
  const s = {
    normal: { pitch: 1, rate: 1, volume: 0.95 },
    excited: { pitch: 1.05, rate: 0.85, volume: 1 },
    big: { pitch: 1.15, rate: 0.78, volume: 1 },
    flat: { pitch: 0.8, rate: 1.05, volume: 0.8 },
  }[style] ?? {}
  speakParts([{ text, ...s }], enabled)
}

// How a score is called, from flat to full voice. Exported for tests.
export function scoreCall(score) {
  if (score === 0) return [{ text: 'No score.', pitch: 0.75, rate: 1.05, volume: 0.7 }]
  if (score === 180) {
    return [
      { text: 'One hundred', pitch: 1.0, rate: 0.75, volume: 1 },
      { text: 'and', pitch: 1.05, rate: 0.7, volume: 1 },
      { text: 'eight-y!', pitch: 1.45, rate: 0.5, volume: 1 },
    ]
  }
  if (score >= 140) {
    return [
      { text: 'One hundred', pitch: 1.0, rate: 0.82, volume: 1 },
      { text: `and ${under100(score - 100)}!`, pitch: 1.25, rate: 0.68, volume: 1 },
    ]
  }
  if (score >= 100) {
    const rest = score - 100
    return [{ text: rest ? `One hundred and ${under100(rest)}!` : 'One hundred!', pitch: 1.1, rate: 0.82, volume: 1 }]
  }
  if (score >= 60) return [{ text: `${under100(score)}.`, pitch: 0.92, rate: 0.95, volume: 0.9 }]
  return [{ text: `${under100(score)}.`, pitch: 0.82, rate: 1.05, volume: 0.8 }]
}

export function callScore(score, enabled) {
  speakParts(scoreCall(score), enabled)
}

// "Game shot, and the leg... Sam Carter!"
export function callGameShot(kind, name, enabled, checkout = 0) {
  const big = kind === 'match' || checkout >= 100
  const [a, b] = current.gameShot(kind)
  speakParts([
    { text: a, pitch: big ? 1.25 : 1.1, rate: 0.75, volume: 1 },
    { text: b, pitch: big ? 1.2 : 1.0, rate: 0.72, volume: 1 },
    { text: name, pitch: 1.05, rate: 0.8, volume: 1 },
  ], enabled)
}

export function callRequire(firstName, remaining, enabled) {
  speakParts([{ text: `${firstName}, ${current.require(numberWords(remaining))}`, pitch: 0.98, rate: 0.95, volume: 0.95 }], enabled)
}

export function callIntro(enabled) {
  speakParts([{ text: current.intro, pitch: 1.1, rate: 0.85 }], enabled)
}
