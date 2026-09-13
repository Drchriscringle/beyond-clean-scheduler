import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  productRevenue,
  productConversion,
  pinCtr,
  pinNeedsRedesign,
  postEngagement,
  pipelineFullyReady,
  trendPercent,
  dailyAverage,
  urgencyFor,
  pipelineBottleneck,
} from '../src/lib/calc.js'
import { todayISO, weekStart, weekEnd, addDays, minutesUntil, weekdayIndex } from '../src/lib/dates.js'

test('revenue = sales * price', () => {
  assert.equal(productRevenue({ etsy_sales_30d: 12, price: '29.99' }), 359.88)
  assert.equal(productRevenue({}), 0)
})

test('conversion needs views', () => {
  assert.equal(productConversion({ etsy_views_30d: 0, etsy_sales_30d: 3 }), null)
  assert.equal(productConversion({ etsy_views_30d: 200, etsy_sales_30d: 5 }), 2.5)
})

test('pin CTR only when impressions > 0', () => {
  assert.equal(pinCtr({ clicks_7d: 10, impressions_7d: 0 }), null)
  assert.equal(pinCtr({ clicks_7d: 30, impressions_7d: 200 }), 15)
  assert.equal(pinNeedsRedesign({ clicks_7d: 10, impressions_7d: 200 }), true)
  assert.equal(pinNeedsRedesign({ clicks_7d: 30, impressions_7d: 200 }), false)
  assert.equal(pinNeedsRedesign({ clicks_7d: 0, impressions_7d: 0 }), false)
})

test('engagement sums likes, saves and comments', () => {
  assert.equal(postEngagement({ likes: 10, saves: 5, comments: 2 }), 17)
})

test('pipeline fully ready needs all six', () => {
  const all = {
    idea_complete: true,
    template_built: true,
    images_done: true,
    etsy_copy_written: true,
    pinterest_copy_written: true,
    instagram_post_written: true,
  }
  assert.equal(pipelineFullyReady(all), true)
  assert.equal(pipelineFullyReady({ ...all, images_done: false }), false)
})

test('trend percent', () => {
  assert.equal(trendPercent(150, 100), 50)
  assert.equal(trendPercent(50, 100), -50)
  assert.equal(trendPercent(0, 0), 0)
  assert.equal(trendPercent(10, 0), null)
})

test('daily average', () => {
  assert.equal(dailyAverage(70, 7), 10)
  assert.equal(dailyAverage(70, 0), 0)
})

test('urgency colours', () => {
  const today = '2026-09-16' // a Wednesday
  const end = weekEnd(today)
  assert.equal(end, '2026-09-20')
  assert.equal(urgencyFor('2026-09-15', today, end), 'overdue')
  assert.equal(urgencyFor('2026-09-16', today, end), 'today')
  assert.equal(urgencyFor('2026-09-19', today, end), 'week')
  assert.equal(urgencyFor('2026-09-21', today, end), 'later')
  assert.equal(urgencyFor(null, today, end), 'none')
})

test('bottleneck picks the most common unchecked step', () => {
  const steps = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
  ]
  const rows = [
    { a: true, b: false },
    { a: false, b: false },
  ]
  assert.deepEqual(pipelineBottleneck(rows, steps), { key: 'b', label: 'B', count: 2 })
  assert.equal(pipelineBottleneck([{ a: true, b: true }], steps), null)
})

test('week helpers use Monday-Sunday weeks', () => {
  assert.equal(weekdayIndex('2026-09-14'), 0) // Monday
  assert.equal(weekdayIndex('2026-09-20'), 6) // Sunday
  assert.equal(weekStart('2026-09-16'), '2026-09-14')
  assert.equal(addDays('2026-09-30', 1), '2026-10-01')
})

test('todayISO respects timezone', () => {
  const now = new Date('2026-06-30T23:30:00Z') // 00:30 BST on 1 July in London
  assert.equal(todayISO('UTC', now), '2026-06-30')
  assert.equal(todayISO('Europe/London', now), '2026-07-01')
})

test('minutesUntil handles BST offset', () => {
  const now = new Date('2026-07-01T09:00:00Z') // 10:00 BST
  assert.equal(minutesUntil('2026-07-01', '11:30', 'Europe/London', now), 90)
  assert.equal(minutesUntil('2026-07-01', '11:30', 'UTC', now), 150)
  assert.equal(minutesUntil('2026-07-01', null, 'UTC', now), null)
})
