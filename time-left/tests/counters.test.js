import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDate } from '../src/lib/dates.js'
import {
  SEASONS,
  buildCounters,
  buildLivedCounters,
  buildMilestones,
  countFullMoons,
  countSeasons,
} from '../src/lib/counters.js'

const NOW = parseDate('2026-09-06')
const BIRTH = parseDate('1980-07-01')
const END = parseDate('2061-11-23')

const summer = SEASONS.find((season) => season.id === 'summer')
const winter = SEASONS.find((season) => season.id === 'winter')

const counters = buildCounters({ now: NOW, endDate: END, birth: BIRTH, hemisphere: 'n' })
const find = (id) => {
  for (const group of counters) {
    const item = group.items.find((entry) => entry.id === id)
    if (item) return item.value
  }
  throw new Error(`no counter called ${id}`)
}

test('a summer you are standing in still counts as one you have left', () => {
  // 15 July, northern hemisphere: this summer is not over yet.
  assert.equal(countSeasons(parseDate('2026-07-15'), parseDate('2026-12-31'), summer, 'n'), 1)
  // 15 September: that summer has gone.
  assert.equal(countSeasons(parseDate('2026-09-15'), parseDate('2026-12-31'), summer, 'n'), 0)
})

test('seasons flip with the hemisphere', () => {
  const span = [parseDate('2026-07-15'), parseDate('2026-08-15')]
  assert.equal(countSeasons(span[0], span[1], summer, 'n'), 1)
  assert.equal(countSeasons(span[0], span[1], summer, 's'), 0)
  assert.equal(countSeasons(span[0], span[1], winter, 's'), 1)
})

test('a 35-year span holds about 35 summers and 35 winters', () => {
  assert.equal(find('summers'), 35)
  assert.equal(find('winters'), 35)
})

test('full moons come round about every 29.5 days', () => {
  const moons = countFullMoons(parseDate('2026-01-01'), parseDate('2027-01-01'))
  assert.ok(moons === 12 || moons === 13, `expected 12 or 13 full moons, got ${moons}`)
  assert.equal(countFullMoons(NOW, NOW), 0)
  assert.ok(Math.abs(countFullMoons(NOW, END) - 12862 / 29.53) < 2)
})

test('weekends, weeks and days line up with each other', () => {
  assert.equal(find('days'), 12862)
  assert.equal(find('weeks'), Math.floor(12862 / 7))
  assert.equal(find('weekends'), 1837)
  assert.equal(find('sunrises'), find('days'))
})

test('birthdays left match the years left', () => {
  assert.equal(find('birthdays'), 35)
  assert.equal(find('leapdays'), 9)
})

test('the rough rates are derived from the same span', () => {
  assert.equal(find('meals'), find('days') * 3)
  assert.equal(find('sleeps'), find('days'))
  assert.ok(find('heartbeats') > 1e9)
})

test('nothing is left to count once the span has run out', () => {
  const empty = buildCounters({ now: NOW, endDate: NOW, birth: BIRTH, hemisphere: 'n' })
  for (const group of empty) {
    for (const item of group.items) {
      assert.ok(item.value >= 0, `${item.id} should not go negative`)
    }
  }
})

test('the lived counters run the same sums backwards', () => {
  const lived = buildLivedCounters({ birth: BIRTH, now: NOW, hemisphere: 'n' })
  const days = lived.find((item) => item.id === 'days-lived')
  const summers = lived.find((item) => item.id === 'summers-lived')
  assert.equal(days.value, 16868)
  assert.equal(summers.value, 47)
})

test('milestones are ordered and marked by whether the estimate reaches them', () => {
  const milestones = buildMilestones({ birth: BIRTH, now: NOW, endDate: END })
  assert.ok(milestones.every((milestone) => milestone.date > NOW))
  for (let i = 1; i < milestones.length; i += 1) {
    assert.ok(milestones[i].date >= milestones[i - 1].date, 'milestones should be in date order')
  }
  const fiftieth = milestones.find((milestone) => milestone.id === 'birthday-50')
  assert.equal(fiftieth.likely, true)
  const century = milestones.find((milestone) => milestone.id === 'century')
  assert.equal(century.likely, false)
})

test('a short horizon marks the far milestones as long shots', () => {
  const milestones = buildMilestones({
    birth: BIRTH,
    now: NOW,
    endDate: parseDate('2028-01-01'),
  })
  assert.ok(milestones.every((milestone) => milestone.likely === false))
})
