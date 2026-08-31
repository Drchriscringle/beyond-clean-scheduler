/**
 * Snapshot and report retention.
 *
 * The scanner commits a snapshot and two report files every day, which is what
 * makes week-over-week momentum computable at all — but left alone it adds
 * roughly 40 MB a year to the repository, most of it detail that nothing ever
 * reads again.
 *
 * Only three things ever look backwards, and between them they need very
 * little of a snapshot:
 *
 *   supplyMomentum    etsy.totalListings, per date
 *   emergingTags      etsy.topTags from the oldest snapshot in the window
 *   trendPersistence  whether the term was trending that day
 *
 * Everything else in a snapshot — the 52-point interest curve, related
 * searches, autocomplete completions, the long-tail probe results — is used
 * once, on the day it is collected, and never again. Thinning drops exactly
 * those and keeps the rest, so pruning changes no report output. The tests
 * assert that directly by running the three consumers over thinned history.
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_RETENTION = {
  // Days of complete snapshots. Must comfortably exceed the 28-day window
  // supplyMomentum looks back over, so a full-detail rebuild is always possible
  // for any period still being actively scored.
  fullDetailDays: 35,
  // Snapshots older than this are deleted outright.
  maxDays: 400,
  // Dated report HTML is a rendering of the snapshot, not a source of truth,
  // and `latest.html` always exists. The markdown is kept indefinitely — it is
  // small, diffs readably, and is the archive worth having.
  reportHtmlDays: 30,
}

function daysOld(isoDate, today) {
  return Math.round((new Date(today) - new Date(isoDate)) / DAY_MS)
}

/**
 * Strip a snapshot to what history consumers actually read.
 *
 * Idempotent: thinning an already-thinned snapshot is a no-op, so the daily job
 * can run this every day without rewriting files that are already minimal.
 */
export function thinSnapshot(snapshot) {
  if (!snapshot || snapshot.thinned) return { snapshot, changed: false }

  const keywords = {}
  for (const [term, row] of Object.entries(snapshot.keywords ?? {})) {
    const { trends, suggest, related, ...keep } = row
    void trends
    void suggest
    void related
    keywords[term] = keep
  }

  const { longTail, notes, ...rest } = snapshot
  void longTail
  void notes

  return { snapshot: { ...rest, keywords, thinned: true }, changed: true }
}

/**
 * Apply retention to the snapshot store.
 *
 * The newest snapshot is never touched, whatever the dates say — the report is
 * built from it, and a clock skew or a backfill should not be able to gut the
 * data the next report depends on.
 */
export function pruneSnapshots(dataDir, { today = new Date(), retention = {}, dryRun = false } = {}) {
  const settings = { ...DEFAULT_RETENTION, ...retention }
  const dir = join(dataDir, 'snapshots')
  if (!existsSync(dir)) return { thinned: [], deleted: [], bytesSaved: 0 }

  const files = readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()

  const newest = files[files.length - 1]
  const thinned = []
  const deleted = []
  let bytesSaved = 0

  for (const file of files) {
    if (file === newest) continue
    const date = file.slice(0, 10)
    const age = daysOld(date, today)
    const path = join(dir, file)

    if (age > settings.maxDays) {
      bytesSaved += readFileSync(path).length
      if (!dryRun) rmSync(path)
      deleted.push(date)
      continue
    }

    if (age > settings.fullDetailDays) {
      let parsed
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        // A corrupt snapshot is left alone rather than replaced with a guess.
        continue
      }
      const { snapshot, changed } = thinSnapshot(parsed)
      if (!changed) continue
      const before = readFileSync(path).length
      const body = `${JSON.stringify(snapshot, null, 2)}\n`
      if (!dryRun) writeFileSync(path, body)
      bytesSaved += before - Buffer.byteLength(body)
      thinned.push(date)
    }
  }

  return { thinned, deleted, bytesSaved }
}

/**
 * Drop dated report HTML past its retention. Markdown and the `latest.*` files
 * are always kept.
 */
export function pruneReports(reportDir, { today = new Date(), retention = {}, dryRun = false } = {}) {
  const settings = { ...DEFAULT_RETENTION, ...retention }
  if (!existsSync(reportDir)) return { deleted: [], bytesSaved: 0 }

  const deleted = []
  let bytesSaved = 0

  for (const name of readdirSync(reportDir)) {
    const match = /^(\d{4}-\d{2}-\d{2})\.html$/.exec(name)
    if (!match) continue
    if (daysOld(match[1], today) <= settings.reportHtmlDays) continue
    const path = join(reportDir, name)
    bytesSaved += readFileSync(path).length
    if (!dryRun) rmSync(path)
    deleted.push(match[1])
  }

  return { deleted, bytesSaved }
}

export function prune({ config, today = new Date(), dryRun = false } = {}) {
  const retention = config.retention ?? {}
  const snapshots = pruneSnapshots(config.dataDir, { today, retention, dryRun })
  const reports = pruneReports(config.reportDir, { today, retention, dryRun })
  return {
    snapshots,
    reports,
    bytesSaved: snapshots.bytesSaved + reports.bytesSaved,
  }
}
