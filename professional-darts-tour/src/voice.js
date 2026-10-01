// Spoken score entry: "one hundred and forty", "ton eighty", "no score", "bust", "game shot".
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

const UNITS = { zero: 0, nil: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

function wordsToNumber(text) {
  let total = 0
  let current = 0
  let seen = false
  for (const w of text.split(/[\s-]+/)) {
    if (w in UNITS) { current += UNITS[w]; seen = true }
    else if (w in TENS) { current += TENS[w]; seen = true }
    else if (w === 'hundred') { current = (current || 1) * 100; seen = true }
    else if (w === 'ton') { current += 100; seen = true }
    else if (w === 'and' || w === 'a') continue
    else if (seen) break
  }
  total += current
  return seen ? total : null
}

// Returns { score } | { bust: true } | { checkout: true } | null
export function parseSpokenScore(text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim()} `
  if (/ (bust|busted) /.test(t)) return { bust: true }
  if (/ (game shot|check ?out|checked out|finished|game on the bull) /.test(t)) return { checkout: true }
  if (/ (no score|nothing|zero|nil) /.test(t)) return { score: 0 }
  if (/ (maximum|one eighty|one hundred and eighty|ton eighty) /.test(t)) return { score: 180 }
  if (/ bed and breakfast /.test(t)) return { score: 26 }
  const digits = t.match(/\b(\d{1,3})\b/)
  if (digits) return { score: Number(digits[1]) }
  const n = wordsToNumber(t.trim())
  return n === null ? null : { score: n }
}

export function voiceAvailable() {
  if (Capacitor.isNativePlatform()) return true
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// Listen once; resolves with the list of things it might have heard.
export async function listen() {
  if (Capacitor.isNativePlatform()) {
    const perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission is needed for voice scoring')
    const res = await SpeechRecognition.start({ language: 'en-GB', maxResults: 5, partialResults: false, popup: false })
    return res?.matches ?? []
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) throw new Error('Voice scoring is not supported in this browser')
  return new Promise((resolve, reject) => {
    const r = new SR()
    r.lang = 'en-GB'
    r.maxAlternatives = 5
    r.interimResults = false
    let done = false
    r.onresult = (e) => {
      done = true
      resolve(Array.from(e.results[0]).map((x) => x.transcript))
    }
    r.onerror = (e) => { if (!done) reject(new Error(e.error === 'not-allowed' ? 'Microphone permission is needed for voice scoring' : "Didn't catch that")) }
    r.onend = () => { if (!done) reject(new Error("Didn't catch that")) }
    r.start()
  })
}

export function heard(alternatives) {
  for (const a of alternatives) {
    const p = parseSpokenScore(a)
    if (p) return { ...p, text: a }
  }
  return null
}
