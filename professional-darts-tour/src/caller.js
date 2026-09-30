// The MC. On a phone it uses the native text-to-speech plugin (Android's WebView has no
// speech synthesis); in a browser it uses the Web Speech API, preferring a British voice.
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

export function numberWords(n) {
  if (n === 0) return 'no score'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const restWords = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? '-' + ONES[rest % 10] : ''}`
  if (!hundreds) return restWords
  return `${ONES[hundreds]} hundred${rest ? ' and ' + restWords : ''}`
}

let voice = null
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice
  const voices = speechSynthesis.getVoices()
  voice = voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en')) ?? null
  return voice
}

export function say(text, enabled = true) {
  if (!enabled) return
  if (Capacitor.isNativePlatform()) {
    TextToSpeech.speak({ text, lang: 'en-GB', rate: 0.95, pitch: 0.9, queueStrategy: 1 }).catch(() => {})
    return
  }
  if (typeof speechSynthesis === 'undefined') return
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.lang = 'en-GB'
  u.rate = 0.95
  u.pitch = 0.9
  speechSynthesis.speak(u)
}

export function callScore(score, enabled) {
  say(score === 180 ? 'One hundred and eighty!' : numberWords(score), enabled)
}
