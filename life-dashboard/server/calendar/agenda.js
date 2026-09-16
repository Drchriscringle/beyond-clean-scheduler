import { assertHttpUrl, fetchText, normalizeFeedUrl } from '../lib/http.js'
import { byDayThenTime, occurrencesOf, parseIcs } from './ics.js'
import { expandRecurrence, parseRule } from './recurrence.js'

/**
 * The agenda: subscribed calendar feeds and events typed into the dashboard,
 * merged into one ordered list of days.
 *
 * Feeds are cached with their ETag so a refresh every few minutes costs a 304
 * rather than a re-download, and a feed that is down keeps serving its last
 * good copy instead of blanking the panel — a dashboard that loses today's
 * meetings because a server hiccuped is worse than one showing them slightly
 * stale, as long as it says so.
 */

const REFRESH_AFTER_MS = 15 * 60 * 1000

export function createCalendar({ store, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cache = new Map()

  async function loadFeed(feed, { force = false } = {}) {
    const url = assertHttpUrl(normalizeFeedUrl(feed.url))
    const cached = cache.get(feed.id)
    const fresh = cached && !force && now() - cached.fetchedAt < REFRESH_AFTER_MS
    if (fresh) return cached

    const headers = {}
    if (cached?.etag) headers['if-none-match'] = cached.etag
    if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified

    try {
      const response = await fetchText(url, { headers, fetchImpl })
      if (response.status === 304 && cached) {
        const kept = { ...cached, fetchedAt: now(), error: null }
        cache.set(feed.id, kept)
        return kept
      }
      const { calendarName, events } = parseIcs(response.text, { zone: feed.zone ?? 'UTC' })
      const entry = {
        id: feed.id,
        name: feed.name ?? calendarName ?? 'Calendar',
        events,
        etag: response.etag,
        lastModified: response.lastModified,
        fetchedAt: now(),
        error: null,
      }
      cache.set(feed.id, entry)
      return entry
    } catch (error) {
      // Keep serving the last good copy, but carry the error so the UI can say
      // "these are from 40 minutes ago, the feed is not answering".
      const entry = cached
        ? { ...cached, error: error.message }
        : { id: feed.id, name: feed.name ?? 'Calendar', events: [], fetchedAt: now(), error: error.message }
      cache.set(feed.id, entry)
      return entry
    }
  }

  return {
    /** Fetches every subscribed feed, in parallel, and reports on each. */
    async refresh({ force = false } = {}) {
      const feeds = await store.get('feeds')
      const loaded = await Promise.all(
        feeds.filter((feed) => feed.enabled !== false).map((feed) => loadFeed(feed, { force })),
      )
      return loaded.map((entry) => ({
        id: entry.id,
        name: entry.name,
        events: entry.events.length,
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
        error: entry.error,
      }))
    },

    /**
     * Everything on between `from` and `to`, from feeds and from the
     * dashboard's own events.
     */
    async between(from, to, { zone = 'UTC', refresh = true } = {}) {
      const [feeds, events] = await Promise.all([store.get('feeds'), store.get('events')])
      const active = feeds.filter((feed) => feed.enabled !== false)
      if (refresh) await Promise.all(active.map((feed) => loadFeed(feed)))

      const entries = []
      const problems = []
      for (const feed of active) {
        const loaded = cache.get(feed.id)
        if (!loaded) continue
        if (loaded.error) problems.push({ feed: loaded.name, error: loaded.error })
        entries.push(
          ...occurrencesOf(loaded.events, {
            from,
            to,
            zone: feed.zone ?? zone,
            source: { id: feed.id, name: loaded.name, colour: feed.colour ?? null, kind: 'feed' },
          }),
        )
      }

      entries.push(...expandOwnEvents(events, from, to))
      return { entries: entries.sort(byDayThenTime), problems }
    },

    /** Drops cached feed bodies; the next read re-fetches. */
    forget() {
      cache.clear()
    },
  }
}

/**
 * Events typed into the dashboard. They use the same recurrence engine as the
 * feeds, so "every other Thursday" means the same thing wherever it came from.
 */
export function expandOwnEvents(events, from, to) {
  const entries = []
  for (const event of events) {
    if (!event.day) continue
    const days = event.rrule
      ? expandRecurrence(event.day, parseRule(event.rrule), from, to, { exclude: event.exclusions ?? [] })
      : event.day >= from && event.day <= to
        ? [event.day]
        : []

    for (const day of days) {
      entries.push({
        id: `${event.id}:${day}`,
        eventId: event.id,
        title: event.title,
        day,
        allDay: !event.time,
        time: event.time ?? null,
        endTime: event.endTime ?? null,
        minutes: event.time ? toMinutes(event.time) : null,
        location: event.location ?? null,
        notes: event.notes ?? null,
        done: Boolean(event.done),
        source: { id: 'own', name: 'Added here', kind: 'own' },
        kind: 'event',
      })
    }
  }
  return entries
}

export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}
