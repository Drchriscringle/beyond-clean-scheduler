// The MC. Calls get bigger with the score: a 26 is read flat and quick, a ton is lifted,
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

// Preferred announcer voices, best first (iOS, Android/Chrome, Windows, macOS).
const PREFERRED = ['Daniel', 'Google UK English Male', 'Arthur', 'Oliver', 'Microsoft Ryan', 'Microsoft George', 'Malcolm', 'Fred']
let voice = null
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  voice =
    PREFERRED.map((name) => voices.find((v) => v.name.includes(name))).find(Boolean) ??
    voices.find((v) => v.lang === 'en-GB' && /male/i.test(v.name) && !/female/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  return voice
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice() }

// parts: [{ text, pitch, rate, volume }]
let nativeChain = Promise.resolve()
export function speakParts(parts, enabled = true) {
  if (!enabled || !parts.length) return
  if (Capacitor.isNativePlatform()) {
    nativeChain = nativeChain.then(async () => {
      for (const p of parts) {
        await TextToSpeech.speak({ text: p.text, lang: 'en-GB', rate: p.rate ?? 1, pitch: p.pitch ?? 1, volume: p.volume ?? 1, category: 'playback' }).catch(() => {})
      }
    })
    return
  }
  if (typeof speechSynthesis === 'undefined') return
  const v = pickVoice()
  for (const p of parts) {
    const u = new SpeechSynthesisUtterance(p.text)
    if (v) u.voice = v
    u.lang = 'en-GB'
    u.rate = p.rate ?? 1
    u.pitch = p.pitch ?? 1
    u.volume = p.volume ?? 1
    speechSynthesis.speak(u)
  }
}

// Plain announcement in the MC's normal, slightly deep delivery.
export function say(text, enabled = true, style = 'normal') {
  const s = {
    normal: { pitch: 0.85, rate: 0.95, volume: 0.95 },
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
  speakParts([
    { text: 'Game shot!', pitch: big ? 1.25 : 1.1, rate: 0.75, volume: 1 },
    { text: `And the ${kind}.`, pitch: big ? 1.2 : 1.0, rate: 0.72, volume: 1 },
    { text: name, pitch: 1.05, rate: 0.8, volume: 1 },
  ], enabled)
}

export function callRequire(firstName, remaining, enabled) {
  speakParts([{ text: `${firstName}, you require ${numberWords(remaining)}.`, pitch: 0.88, rate: 0.9, volume: 0.95 }], enabled)
}
