import { addDays } from '../lib/dates.js'
import { assertHttpUrl, fetchText } from '../lib/http.js'
import { parseFeed, searchFeedUrl, targetQuery } from './feed.js'
import { dedupe, scoreItem } from './match.js'

/**
 * The reel: what happened, about the things you are watching.
 *
 * Two kinds of source feed it. A target you name generates a search feed
 * automatically, so adding "Acme Group" to the watchlist starts working
 * immediately with nothing to configure. Alongside that you can subscribe to
 * any RSS or Atom feed directly — a regulator, a trade journal, a competitor's
 * own blog — and every story from those is matched against the whole watchlist.
 */

const CACHE_MS = 20 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 7

export const TARGET_KINDS = { company: 'Company or market', person: 'Person', topic: 'Topic' }

export function createReel({ store, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cache = new Map()

  async function load(source) {
    const cached = cache.get(source.url)
    if (cached && now() - cached.fetchedAt < CACHE_MS) return cached

    try {
      const { text } = await fetchText(assertHttpUrl(source.url), { fetchImpl })
      const { items } = parseFeed(text, { sourceName: source.name, sourceUrl: source.url })
      const entry = { url: source.url, items, fetchedAt: now(), error: null }
      cache.set(source.url, entry)
      return entry
    } catch (error) {
      const entry = cached
        ? { ...cached, error: error.message }
        : { url: source.url, items: [], fetchedAt: now(), error: error.message }
      cache.set(source.url, entry)
      return entry
    }
  }

  /**
   * Every source to poll: one search feed per active target, plus any feeds
   * subscribed to directly.
   */
  async function sourcesFor(targets, { search = true } = {}) {
    const profile = await store.get('profile')
    const sources = []

    if (search) {
      for (const target of targets) {
        const query = targetQuery(target)
        if (!query) continue
        sources.push({
          name: `Search: ${target.name}`,
          url: searchFeedUrl(query, {
            language: profile.newsLanguage ?? 'en-GB',
            country: profile.newsCountry ?? 'GB',
          }),
          targetId: target.id,
        })
      }
    }

    for (const target of targets) {
      for (const url of target.sources ?? []) {
        sources.push({ name: target.name, url, targetId: target.id })
      }
    }
    return sources
  }

  return {
    /**
     * Builds the reel.
     *
     * Every story is scored against every target rather than only the target
     * whose search found it — a story found while searching for one competitor
     * that also names another should show under both.
     */
    async build({ days = DEFAULT_WINDOW_DAYS, today, limit = 60, search = true } = {}) {
      const [targets, subscribed, dismissals] = await Promise.all([
        store.get('targets'),
        store.get('newsSources'),
        store.get('dismissals'),
      ])
      const active = targets.filter((target) => target.active !== false)
      if (active.length === 0) return { items: [], problems: [], targets: [] }

      const sources = [
        ...(await sourcesFor(active, { search })),
        ...subscribed.filter((source) => source.enabled !== false),
      ]
      const loaded = await Promise.all(sources.map(load))

      const since = today ? `${addDays(today, -days)}T00:00:00.000Z` : new Date(now() - days * 86_400_000).toISOString()
      const dismissed = new Set(dismissals.filter((entry) => entry.kind === 'news').map((entry) => entry.key))
      const scored = []

      for (const feed of loaded) {
        for (const item of feed.items) {
          if (item.publishedAt && item.publishedAt < since) continue
          const matches = []
          let best = 0
          for (const target of active) {
            const result = scoreItem(item, target, { now: now() })
            if (!result) continue
            matches.push({ id: target.id, name: target.name, kind: target.kind ?? 'topic', where: result.where })
            best = Math.max(best, result.score)
          }
          if (matches.length === 0) continue
          // A story naming two things you watch is more interesting than one.
          const score = best + (matches.length - 1) * 0.15
          scored.push({ ...item, score, targets: matches })
        }
      }

      const items = dedupe(scored)
        .filter((item) => !dismissed.has(item.url ?? item.title))
        .sort((a, b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
        .slice(0, limit)

      return {
        items,
        problems: loaded.filter((feed) => feed.error).map((feed) => ({ url: feed.url, error: feed.error })),
        targets: active.map((target) => ({
          id: target.id,
          name: target.name,
          kind: target.kind ?? 'topic',
          count: items.filter((item) => item.targets.some((match) => match.id === target.id)).length,
        })),
      }
    },

    forget() {
      cache.clear()
    },
  }
}
