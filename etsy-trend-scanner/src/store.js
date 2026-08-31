/**
 * Snapshot store.
 *
 * One JSON file per scan day. This is what turns a point-in-time lookup into a
 * trend detector: "starting to trend" is only observable by comparing today's
 * numbers against the same numbers a week ago, and Etsy gives you no history,
 * so we build our own. The files are small and diff-readably plain, which
 * means they can live in git and accumulate via a scheduled CI job.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export class SnapshotStore {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.snapshotDir = join(dataDir, 'snapshots')
    this.discoveredPath = join(dataDir, 'discovered-keywords.json')
  }

  save(snapshot) {
    ensureDir(this.snapshotDir)
    const path = join(this.snapshotDir, `${snapshot.date}.json`)
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`)
    return path
  }

  dates() {
    if (!existsSync(this.snapshotDir)) return []
    return readdirSync(this.snapshotDir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.slice(0, 10))
      .sort()
  }

  load(date) {
    const path = join(this.snapshotDir, `${date}.json`)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return null
    }
  }

  /** Most recent `days` snapshots, oldest first. */
  history(days = 90) {
    return this.dates()
      .slice(-days)
      .map((date) => this.load(date))
      .filter(Boolean)
  }

  latest() {
    const dates = this.dates()
    return dates.length ? this.load(dates[dates.length - 1]) : null
  }

  /**
   * The stored series for one keyword across snapshots, as
   * `[{date, etsy, trends}]` oldest first, skipping days it was not scanned.
   */
  seriesFor(term, days = 90) {
    const out = []
    for (const snapshot of this.history(days)) {
      const row = snapshot?.keywords?.[term]
      if (!row) continue
      out.push({ date: snapshot.date, ...row })
    }
    return out
  }

  readDiscovered() {
    if (!existsSync(this.discoveredPath)) return []
    try {
      const parsed = JSON.parse(readFileSync(this.discoveredPath, 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /**
   * Merge newly discovered terms into the persisted list. Existing entries keep
   * their original discovery date (that age is what lets the report say "this
   * has been rising for three weeks") but refresh their hit count.
   */
  mergeDiscovered(terms, { today, max = 400 } = {}) {
    const existing = new Map(this.readDiscovered().map((row) => [row.term, row]))
    for (const entry of terms) {
      const term = typeof entry === 'string' ? entry : entry.term
      if (!term) continue
      const prior = existing.get(term)
      existing.set(term, {
        term,
        category: entry.category ?? prior?.category ?? 'discovered',
        parent: entry.parent ?? prior?.parent,
        discoveredAt: prior?.discoveredAt ?? today,
        lastSeenAt: today,
        hits: (prior?.hits ?? 0) + 1,
      })
    }
    const rows = [...existing.values()]
      .sort(
        (a, b) =>
          String(b.lastSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? '')) || b.hits - a.hits,
      )
      .slice(0, max)
    ensureDir(this.dataDir)
    writeFileSync(this.discoveredPath, `${JSON.stringify(rows, null, 2)}\n`)
    return rows
  }
}
