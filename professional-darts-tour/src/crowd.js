// Crowd noise synthesised with the Web Audio API (no audio files, nothing to license):
// arena ambience, roars for 180s and big finishes, applause after legs, pub chatter.
let ctx = null
let noise = null
let ambience = null

function audio() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    const len = ctx.sampleRate * 2
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function noiseSource(c) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  return src
}

// A swelling crowd roar. intensity 0..1.
export function roar(intensity = 0.6, seconds = 2.8) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (const [freq, q, vol] of [[500, 0.8, 1], [1100, 1.2, 0.7], [2400, 2, 0.35]]) {
    const src = noiseSource(c)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = c.createGain()
    const peak = 0.22 * intensity * vol
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.25)
    g.gain.setValueAtTime(peak, t + seconds * 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    src.connect(bp).connect(g).connect(c.destination)
    src.start(t)
    src.stop(t + seconds + 0.1)
  }
  // A few whistles for the big moments.
  if (intensity > 0.7) {
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      const start = t + 0.2 + Math.random() * 0.8
      o.frequency.setValueAtTime(1800 + Math.random() * 600, start)
      o.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 500, start + 0.35)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.03, start + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
      o.connect(g).connect(c.destination)
      o.start(start)
      o.stop(start + 0.5)
    }
  }
}

// Applause: lots of tiny claps.
export function applause(seconds = 2, density = 40) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const n = Math.round(seconds * density)
  for (let i = 0; i < n; i++) {
    const src = c.createBufferSource()
    src.buffer = noise
    const hp = c.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 1200 + Math.random() * 1800
    const g = c.createGain()
    const at = t + Math.random() * seconds * (1 - (Math.random() * i) / n / 2)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.08 + Math.random() * 0.06, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    src.connect(hp).connect(g).connect(c.destination)
    src.start(at, Math.random() * 1.5, 0.06)
  }
}

// Background hum: 'arena' for TV events, 'hall' for floor events, 'pub' for the local.
export function startAmbience(kind = 'arena') {
  const c = audio()
  if (!c) return
  stopAmbience()
  const src = noiseSource(c)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = kind === 'pub' ? 380 : 650
  bp.Q.value = kind === 'pub' ? 1.4 : 0.6
  const g = c.createGain()
  g.gain.value = { arena: 0.045, hall: 0.018, pub: 0.03 }[kind] ?? 0.03
  // Slow swell so it feels alive.
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.13
  lfoGain.gain.value = g.gain.value * 0.4
  lfo.connect(lfoGain).connect(g.gain)
  src.connect(bp).connect(g).connect(c.destination)
  src.start()
  lfo.start()
  ambience = { src, lfo }
}

export function stopAmbience() {
  if (!ambience) return
  try {
    ambience.src.stop()
    ambience.lfo.stop()
  } catch { /* already stopped */ }
  ambience = null
}

// The "ooooh" when someone busts or misses match darts: a falling, muffled murmur.
export function groan(seconds = 1.6) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const src = noiseSource(c)
  const lp = c.createBiquadFilter()
  lp.type = 'bandpass'
  lp.Q.value = 3
  lp.frequency.setValueAtTime(520, t)
  lp.frequency.exponentialRampToValueAtTime(260, t + seconds)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  src.connect(lp).connect(g).connect(c.destination)
  src.start(t)
  src.stop(t + seconds + 0.1)
}
