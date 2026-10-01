// Regulation dartboard geometry, in millimetres from the centre of the bull.
export const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

export const RADII = {
  bull: 6.35,
  outerBull: 15.9,
  trebleIn: 99,
  trebleOut: 107,
  doubleIn: 162,
  doubleOut: 170,
}

// Targets are strings: 'T20', 'D16', 'S5', 'SB' (outer bull, 25), 'DB' (bull, 50).
export function parseTarget(target) {
  if (target === 'DB') return { mult: 2, number: 25, value: 50 }
  if (target === 'SB') return { mult: 1, number: 25, value: 25 }
  const mult = { S: 1, D: 2, T: 3 }[target[0]]
  const number = Number(target.slice(1))
  return { mult, number, value: mult * number }
}

export function targetValue(target) {
  return parseTarget(target).value
}

export function isDouble(target) {
  return parseTarget(target).mult === 2
}

export function labelFor(mult, number) {
  if (mult === 0) return 'MISS'
  if (number === 25) return mult === 2 ? 'DB' : 'SB'
  return ({ 1: 'S', 2: 'D', 3: 'T' })[mult] + number
}

// Angle in degrees, 0 at the top of the board, increasing clockwise.
function segmentCentreAngle(number) {
  return SEGMENTS.indexOf(number) * 18
}

export function aimPoint(target) {
  const { mult, number } = parseTarget(target)
  if (number === 25) return [0, 0]
  const r =
    mult === 3 ? (RADII.trebleIn + RADII.trebleOut) / 2 : mult === 2 ? (RADII.doubleIn + RADII.doubleOut) / 2 : 134
  const a = (segmentCentreAngle(number) * Math.PI) / 180
  return [r * Math.sin(a), r * Math.cos(a)]
}

// x to the right, y upwards.
export function scoreAt(x, y) {
  const r = Math.hypot(x, y)
  if (r <= RADII.bull) return { mult: 2, number: 25, value: 50, label: 'DB' }
  if (r <= RADII.outerBull) return { mult: 1, number: 25, value: 25, label: 'SB' }
  if (r > RADII.doubleOut) return { mult: 0, number: 0, value: 0, label: 'MISS' }
  let angle = (Math.atan2(x, y) * 180) / Math.PI
  if (angle < 0) angle += 360
  const number = SEGMENTS[Math.floor(((angle + 9) % 360) / 18)]
  let mult = 1
  if (r >= RADII.trebleIn && r <= RADII.trebleOut) mult = 3
  else if (r >= RADII.doubleIn) mult = 2
  return { mult, number, value: mult * number, label: labelFor(mult, number) }
}
