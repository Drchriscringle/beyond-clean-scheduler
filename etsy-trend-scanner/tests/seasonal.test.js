import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  addDays,
  daysBetween,
  easterSunday,
  nthWeekdayOf,
  seasonalFit,
  themeMatches,
  toISODate,
  upcomingEvents,
} from '../src/seasonal.js'

test('nthWeekdayOf finds the right dates', () => {
  // Second Sunday of May 2026 is the 10th (Mother's Day, US).
  assert.equal(toISODate(nthWeekdayOf(2026, 4, 0, 2)), '2026-05-10')
  // Fourth Thursday of November 2026 is the 26th (Thanksgiving).
  assert.equal(toISODate(nthWeekdayOf(2026, 10, 4, 4)), '2026-11-26')
  // Last Monday of May 2026 is the 25th.
  assert.equal(toISODate(nthWeekdayOf(2026, 4, 1, -1)), '2026-05-25')
})

test('easterSunday matches known dates', () => {
  assert.equal(toISODate(easterSunday(2026)), '2026-04-05')
  assert.equal(toISODate(easterSunday(2027)), '2027-03-28')
  assert.equal(toISODate(easterSunday(2030)), '2030-04-21')
})

test('date helpers are UTC-stable', () => {
  assert.equal(toISODate(addDays('2026-02-27', 3)), '2026-03-02')
  assert.equal(daysBetween('2026-01-01', '2026-03-01'), 59)
  assert.equal(daysBetween('2026-03-01', '2026-01-01'), -59)
})

test('upcomingEvents rolls past events into next year and sorts by buyer peak', () => {
  const events = upcomingEvents(new Date('2026-08-31T00:00:00Z'))
  assert.ok(events.length > 0)
  const ids = events.map((e) => e.id)
  assert.ok(ids.includes('halloween'))
  // Mother's Day has long since passed in August, so it must be next year's.
  const mothers = events.find((e) => e.id === 'mothers-day-us')
  assert.equal(mothers.year, 2027)
  for (let i = 1; i < events.length; i += 1) {
    assert.ok(events[i].daysToPeak >= events[i - 1].daysToPeak)
  }
})

test('year placeholders in themes resolve to the event year', () => {
  const events = upcomingEvents(new Date('2026-08-31T00:00:00Z'))
  const newYear = events.find((e) => e.id === 'new-year')
  assert.ok(newYear.themes.includes('2027 planner'), JSON.stringify(newYear.themes))
})

test('themeMatches ignores words that are generic across every occasion', () => {
  assert.ok(themeMatches('christmas gift wrap', 'christmas gift'))
  assert.ok(themeMatches('spooky halloween bunting', 'halloween decor'))
  // "gift" alone must not tie an evergreen niche to every gifting holiday.
  assert.ok(!themeMatches('sourdough gift', 'christmas gift'))
  assert.ok(!themeMatches('personalised name necklace', 'personalised christmas'))
})

test('seasonalFit returns null when no occasion applies', () => {
  const fit = seasonalFit({ term: 'macrame wall hanging', today: new Date('2026-08-31T00:00:00Z') })
  assert.equal(fit.score, null)
  assert.equal(fit.event, null)
})

test('seasonalFit peaks at the list-by date and collapses after it', () => {
  const today = new Date('2026-08-31T00:00:00Z')
  const profile = { leadTimeDays: 7, rankRampDays: 21 }
  const inWindow = seasonalFit({ term: 'christmas gift', today, profile })

  assert.ok(inWindow.score > 55, `expected an open Q4 window, got ${inWindow.score}`)
  assert.equal(inWindow.missed, false)
  assert.ok(inWindow.listByDate < inWindow.peakDate)
  assert.ok(inWindow.peakDate < inWindow.eventDate)

  // Same niche, checked after the list-by date but before the buyer peak.
  const tooLate = seasonalFit({
    term: 'christmas gift',
    today: new Date('2026-10-20T00:00:00Z'),
    profile,
  })
  assert.equal(tooLate.missed, true)
  assert.equal(tooLate.score, 0)
})

test('a missed window never outscores an open one, however narrowly missed', () => {
  const profile = { leadTimeDays: 7, rankRampDays: 21 }
  const open = seasonalFit({ term: 'christmas gift', today: new Date('2026-09-11T00:00:00Z'), profile })
  const justMissed = seasonalFit({
    term: 'christmas gift',
    today: new Date('2026-09-13T00:00:00Z'),
    profile,
  })
  assert.equal(open.missed, false)
  assert.equal(justMissed.missed, true)
  assert.ok(justMissed.score < 55, `a missed window must stay below the seasonal threshold`)
  assert.ok(justMissed.score < open.score)
})

test('a longer build time pulls the list-by date earlier', () => {
  const today = new Date('2026-08-31T00:00:00Z')
  const quick = seasonalFit({ term: 'christmas gift', today, effortDays: 1 })
  const slow = seasonalFit({ term: 'christmas gift', today, effortDays: 14 })
  assert.ok(slow.listByDate < quick.listByDate)
  assert.ok(slow.score < quick.score)
})
