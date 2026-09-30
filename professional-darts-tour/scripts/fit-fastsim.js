// Measures leg-win probability from the full dart engine, to tune fastsim.js.
import { playVisit, sigmaForAverage } from '../src/engine/bot.js'
import { seededRng } from '../src/engine/rng.js'

const rng = seededRng(1)
function leg(a, b) {
  const s = [sigmaForAverage(a), sigmaForAverage(b)]
  const rem = [501, 501]
  let p = 0
  for (;;) {
    const v = playVisit(rem[p], s[p], rng)
    rem[p] -= v.scored
    if (v.checkout) return p
    p = 1 - p
  }
}
for (const base of [55, 70, 85, 95]) {
  for (const d of [0, 5, 10, 20]) {
    let w = 0
    const n = 3000
    for (let i = 0; i < n; i++) if (leg(base + d / 2, base - d / 2) === 0) w++
    console.log(base, d, (w / n).toFixed(3))
  }
}
