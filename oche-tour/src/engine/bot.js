// The virtual opponent. Every dart is aimed at a real target and lands with a
// Gaussian scatter; the scatter width (sigma, mm) is what sets their standard.
import { aimPoint, scoreAt } from './board.js'
import { chooseTarget } from './checkout.js'
import { gaussian } from './rng.js'

// [sigma mm, resulting 3-dart average over full 501 legs], from scripts/calibrate.js
export const CALIBRATION = [[3,144.3],[4,127.3],[5,114],[6,104.2],[7,95.8],[8,88.8],[9,82],[10,76.3],[11,70.6],[12,66.3],[14,57.6],[16,51.4],[18,45.7],[20,41.7],[23,36.6],[26,32.5],[30,29],[35,24.8],[40,21.6],[46,18.8],[53,16.4],[61,13.2],[70,11.2],[80,9.1],[95,7],[110,5.8]]

export function sigmaForAverage(avg) {
  const table = CALIBRATION
  if (avg >= table[0][1]) return table[0][0]
  for (let i = 1; i < table.length; i++) {
    const [s1, a1] = table[i - 1]
    const [s2, a2] = table[i]
    if (avg >= a2) return s1 + ((a1 - avg) / (a1 - a2)) * (s2 - s1)
  }
  return table[table.length - 1][0]
}

export function throwDart(target, sigma, rng = Math.random) {
  const [ax, ay] = aimPoint(target)
  const x = ax + gaussian(rng) * sigma
  const y = ay + gaussian(rng) * sigma
  return { ...scoreAt(x, y), x, y, target }
}

// One visit of up to three darts. Handles busts, double-out and (optionally) double-in.
export function playVisit(remaining, sigma, rng = Math.random, { needIn = false } = {}) {
  const darts = []
  let left = remaining
  let opened = !needIn
  for (let i = 0; i < 3; i++) {
    const target = opened ? chooseTarget(left, 3 - i) : 'D20'
    const dart = throwDart(target, sigma, rng)
    darts.push(dart)
    if (!opened) {
      if (dart.mult !== 2) continue
      opened = true
    }
    const after = left - dart.value
    if (after === 0 && dart.mult === 2) {
      return { darts, scored: remaining, bust: false, checkout: true, remaining: 0, opened, double: dart.label }
    }
    if (after < 2) {
      return { darts, scored: 0, bust: true, checkout: false, remaining, opened }
    }
    left = after
  }
  return { darts, scored: remaining - left, bust: false, checkout: false, remaining: left, opened }
}
