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

const LISTEN_TIMEOUT = 7000

// Listen once. Returns { promise, cancel }: the promise resolves with what might have been
// heard, or rejects with a readable message. It always settles: after a few seconds of
// silence (or a browser that never answers) it gives up, and cancel() stops it straight away.
export function listen() {
  let settle = null
  let stop = () => {}
  const promise = new Promise((resolve, reject) => {
    let done = false
    const finish = (fn, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { stop() } catch { /* already stopped */ }
      fn(value)
    }
    settle = { resolve: (v) => finish(resolve, v), reject: (e) => finish(reject, e) }
    const timer = setTimeout(() => settle.reject(new Error("Didn't catch that. Tap 🎤 to try again, or use the keypad.")), LISTEN_TIMEOUT)

    if (Capacitor.isNativePlatform()) {
      stop = () => SpeechRecognition.stop().catch(() => {})
      SpeechRecognition.requestPermissions()
        .then((perm) => {
          if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission is needed for voice scoring')
          return SpeechRecognition.start({ language: 'en-GB', maxResults: 5, partialResults: false, popup: false })
        })
        .then((res) => settle.resolve(res?.matches ?? []))
        .catch((e) => settle.reject(new Error(e?.message || "Didn't catch that")))
      return
    }
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      settle.reject(new Error('Voice scoring is not supported in this browser. Use the keypad.'))
      return
    }
    let r
    try {
      r = new SR()
    } catch {
      settle.reject(new Error('Voice scoring is not available here. Try Safari or Chrome directly, or use the keypad.'))
      return
    }
    stop = () => r.abort()
    r.lang = 'en-GB'
    r.maxAlternatives = 5
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => settle.resolve(Array.from(e.results[0]).map((x) => x.transcript))
    r.onerror = (e) => settle.reject(new Error(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone or speech recognition is blocked. Allow it in your browser settings (on iPhone: Settings → Siri & Dictation), or use the keypad.'
        : e.error === 'aborted' ? 'cancelled' : "Didn't catch that. Tap 🎤 to try again, or use the keypad.",
    ))
    r.onend = () => settle.reject(new Error("Didn't catch that. Tap 🎤 to try again, or use the keypad."))
    try {
      r.start()
    } catch {
      settle.reject(new Error('Voice scoring is not available here. Use the keypad.'))
    }
  })
  return { promise, cancel: () => settle?.reject(new Error('cancelled')) }
}

export function heard(alternatives) {
  for (const a of alternatives) {
    const p = parseSpokenScore(a)
    if (p) return { ...p, text: a }
  }
  return null
}
