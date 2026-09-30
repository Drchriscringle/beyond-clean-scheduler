// Regenerates the sigma -> average table used by src/engine/bot.js.
// Usage: node scripts/calibrate.js
import { aimPoint, scoreAt } from '../src/engine/board.js'
import { chooseTarget } from '../src/engine/checkout.js'
import { gaussian, seededRng } from '../src/engine/rng.js'

const rng = seededRng(42)
function legDarts(sigma) {
  let rem = 501
  let darts = 0
  while (rem > 0 && darts < 600) {
    const start = rem
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = aimPoint(chooseTarget(rem, 3 - i))
      const d = scoreAt(ax + gaussian(rng) * sigma, ay + gaussian(rng) * sigma)
      darts++
      const after = rem - d.value
      if (after === 0 && d.mult === 2) return darts
      if (after < 2) { rem = start; break }
      rem = after
    }
  }
  return darts
}

const rows = []
for (const sigma of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 46, 53, 61, 70, 80, 95, 110]) {
  let points = 0
  let darts = 0
  for (let i = 0; i < 1500; i++) {
    darts += legDarts(sigma)
    points += 501
  }
  rows.push([sigma, Math.round(((points * 3) / darts) * 10) / 10])
}
console.log(JSON.stringify(rows))
