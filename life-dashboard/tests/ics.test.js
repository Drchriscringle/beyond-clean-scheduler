import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { occurrencesOf, parseDateTime, parseIcs, parseLine, unescapeText, unfold } from '../server/calendar/ics.js'

const fixture = await readFile(fileURLToPath(new URL('../fixtures/calendar.ics', import.meta.url)), 'utf8')
const ZONE = 'Europe/London'

test('folded lines are rejoined before parsing', () => {
  const lines = unfold('SUMMARY:A very long\n  title\nUID:1')
  assert.deepEqual(lines, ['SUMMARY:A very long title', 'UID:1'])
})

test('carriage returns from a real feed are handled', () => {
  assert.deepEqual(unfold('BEGIN:VEVENT\r\nUID:1\r\n'), ['BEGIN:VEVENT', 'UID:1'])
})

test('a property splits into name, parameters and value', () => {
  const line = parseLine('DTSTART;TZID=Europe/London;VALUE=DATE-TIME:20260914T093000')
  assert.equal(line.name, 'DTSTART')
  assert.equal(line.parameters.TZID, 'Europe/London')
  assert.equal(line.value, '20260914T093000')
})

test('a colon inside a quoted parameter does not end the name', () => {
  const line = parseLine('ATTENDEE;CN="Smith: Jane":mailto:jane@example.com')
  assert.equal(line.name, 'ATTENDEE')
  assert.equal(line.parameters.CN, 'Smith: Jane')
  assert.equal(line.value, 'mailto:jane@example.com')
})

test('a value containing a colon survives', () => {
  assert.equal(parseLine('SUMMARY:Call: the accountant').value, 'Call: the accountant')
})

test('escaped text is unescaped', () => {
  assert.equal(unescapeText('Call\\, re: VAT'), 'Call, re: VAT')
  assert.equal(unescapeText('one\\ntwo'), 'one\ntwo')
  assert.equal(unescapeText('a\\;b'), 'a;b')
})

test('the three timestamp forms all resolve', () => {
  const allDay = parseDateTime({ parameters: { VALUE: 'DATE' }, value: '20260921' }, ZONE)
  assert.deepEqual({ day: allDay.day, allDay: allDay.allDay }, { day: '2026-09-21', allDay: true })

  const utc = parseDateTime({ parameters: {}, value: '20260915T080000Z' }, ZONE)
  assert.equal(utc.instant.toISOString(), '2026-09-15T08:00:00.000Z')

  // 09:30 London in September is British Summer Time, so 08:30 UTC.
  const zoned = parseDateTime({ parameters: { TZID: ZONE }, value: '20260914T093000' }, ZONE)
  assert.equal(zoned.instant.toISOString(), '2026-09-14T08:30:00.000Z')
})

test('a calendar parses into its events', () => {
  const { calendarName, events } = parseIcs(fixture, { zone: ZONE })
  assert.equal(calendarName, 'Chris — Work')
  assert.equal(events.length, 6)
  const standup = events.find((event) => event.title === 'Team standup')
  assert.equal(standup.rule.frequency, 'WEEKLY')
  assert.deepEqual(standup.exclusions, ['2026-09-16'])
})

test('a folded title is read whole', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const review = events.find((event) => event.uid === 'retro-005@example.com')
  assert.equal(review.title, 'Month-end review with a very long title that the feed will fold across two physical lines')
})

test('a repeating event expands across the window', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-14', to: '2026-09-20', zone: ZONE })
  const standups = entries.filter((entry) => entry.title.startsWith('Team standup'))
  // Monday, Wednesday, Friday — but Wednesday the 16th is an EXDATE, and
  // Friday the 18th was moved to the afternoon.
  assert.deepEqual(standups.map((entry) => `${entry.day} ${entry.time}`), [
    '2026-09-14 09:30',
    '2026-09-18 14:00',
  ])
})

test('a moved occurrence keeps its new title', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-18', to: '2026-09-18', zone: ZONE })
  assert.equal(entries[0].title, 'Team standup (moved to the afternoon)')
})

test('a cancelled event never reaches the agenda', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-17', to: '2026-09-17', zone: ZONE })
  assert.equal(entries.some((entry) => entry.title === 'Dentist'), false)
})

test('a UTC timestamp is shown in the reader clock', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const [call] = occurrencesOf(events, { from: '2026-09-15', to: '2026-09-15', zone: ZONE })
  // 08:00Z during British Summer Time reads as 09:00.
  assert.equal(call.time, '09:00')
  assert.equal(call.title, 'Call with the accountant, re: VAT')
})

test('an all-day event has no time and leads its day', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-21', to: '2026-09-21', zone: ZONE })
  assert.equal(entries[0].allDay, true)
  assert.equal(entries[0].time, null)
  assert.equal(entries[0].title, 'Annual leave')
})

test('entries come back in day then clock order', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-01', to: '2026-10-31', zone: ZONE })
  const keys = entries.map((entry) => `${entry.day}${entry.allDay ? ' ' : entry.time}`)
  assert.deepEqual([...keys].sort(), keys)
})

test('the monthly last-Friday review lands correctly', () => {
  const { events } = parseIcs(fixture, { zone: ZONE })
  const entries = occurrencesOf(events, { from: '2026-09-01', to: '2026-11-30', zone: ZONE })
  const reviews = entries.filter((entry) => entry.title.startsWith('Month-end review'))
  assert.deepEqual(reviews.map((entry) => entry.day), ['2026-09-25', '2026-10-30', '2026-11-27'])
})

test('a feed with nothing in it parses rather than throwing', () => {
  const { events } = parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', { zone: ZONE })
  assert.deepEqual(events, [])
})

test('an event with no DTSTART is dropped rather than dated wrongly', () => {
  const { events } = parseIcs(
    'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nSUMMARY:Undated\nEND:VEVENT\nEND:VCALENDAR',
    { zone: ZONE },
  )
  assert.deepEqual(events, [])
})
