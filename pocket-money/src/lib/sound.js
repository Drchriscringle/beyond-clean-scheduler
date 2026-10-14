// Synthesised sound effects via Web Audio — no audio files to ship, and it
// works offline. Browsers (iOS especially) only allow sound after a user
// gesture, so unlockAudio() primes the context on the first tap.

const SOUND_KEY = "pm_sound";
let ctx = null;

export function soundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

function getContext() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

// Call once at startup: resumes the context on the first tap so later,
// non-gesture playback (e.g. a realtime approval) is allowed.
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const c = getContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchend", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchend", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function clink(c, at, freq, gain = 0.18, decay = 0.09) {
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc2.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  osc2.frequency.setValueAtTime(freq * 2.47, at); // inharmonic partial = metallic
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(g);
  osc2.connect(g);
  g.connect(c.destination);
  osc.start(at);
  osc2.start(at);
  osc.stop(at + decay + 0.02);
  osc2.stop(at + decay + 0.02);
}

// A shower of coin clinks spread over the animation, then a "cha-ching".
export function playCoinShower(count = 14, duration = 1.6) {
  if (!soundEnabled()) return;
  const c = getContext();
  if (!c) return;
  const go = () => {
    const t0 = c.currentTime + 0.02;
    for (let i = 0; i < count; i++) {
      const at = t0 + Math.random() * duration;
      const freq = 1800 + Math.random() * 2400;
      clink(c, at, freq, 0.12 + Math.random() * 0.1, 0.07 + Math.random() * 0.06);
    }
    // cha-ching: two quick bright hits, the second higher and longer
    const end = t0 + duration + 0.05;
    clink(c, end, 2600, 0.22, 0.12);
    clink(c, end + 0.11, 3900, 0.26, 0.35);
  };
  if (c.state === "suspended") c.resume().then(go).catch(() => {});
  else go();
}

// A single soft tap for "I did it!" / Done.
export function playTap() {
  if (!soundEnabled()) return;
  const c = getContext();
  if (!c) return;
  const go = () => clink(c, c.currentTime + 0.01, 1200, 0.12, 0.08);
  if (c.state === "suspended") c.resume().then(go).catch(() => {});
  else go();
}
