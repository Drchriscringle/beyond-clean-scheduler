/**
 * Report assembly: read stored snapshots, score every keyword against its own
 * history, and write the day's report to disk.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SnapshotStore, ensureDir } from '../store.js'
import { scoreKeyword } from '../analyze/score.js'
import { emergingTags } from '../analyze/tags.js'
import { buildReportModel } from './recommend.js'
import { renderMarkdown } from './markdown.js'
import { renderHtml } from './html.js'
import { toISODate } from '../seasonal.js'

/**
 * Score every keyword in the most recent snapshot.
 *
 * History is per-keyword rather than global because keywords enter and leave
 * the universe as they are discovered — a term scanned for the first time
 * today has no supply history and must not be penalised for it.
 */
export function scoreSnapshot(store, { config, today = new Date() } = {}) {
  const latest = store.latest()
  if (!latest) return { latest: null, scored: [] }

  const historyByTerm = new Map()
  for (const snapshot of store.history(config.historyDays ?? 90)) {
    for (const [term, row] of Object.entries(snapshot.keywords ?? {})) {
      if (!historyByTerm.has(term)) historyByTerm.set(term, [])
      historyByTerm.get(term).push({ date: snapshot.date, ...row })
    }
  }

  const scored = []
  for (const [term, row] of Object.entries(latest.keywords ?? {})) {
    const history = historyByTerm.get(term) ?? []
    const result = scoreKeyword({
      term,
      category: row.category,
      etsy: row.etsy?.ok ? row.etsy : (row.etsy ?? {}),
      trends: row.trends?.ok === false ? {} : (row.trends ?? {}),
      suggest: row.suggest?.ok === false ? {} : (row.suggest ?? {}),
      // Snapshots written before related-search merging existed carry no
      // `related`; passing undefined makes the scorer rebuild it from the raw
      // feeds, so old history keeps working.
      related: row.related,
      history,
      config,
      today,
    })

    // Tags that appeared in this niche since the oldest snapshot we hold are a
    // supply-side early signal in their own right, so they join the evidence.
    if (history.length >= 2) {
      const emerging = emergingTags(row.etsy?.topTags, history[0]?.etsy?.topTags)
      const fresh = emerging.filter((tag) => tag.isNew).slice(0, 3)
      if (fresh.length) {
        result.evidence.push(
          `New tags among competing listings since ${history[0].date}: ` +
            fresh.map((tag) => `"${tag.tag}"`).join(', '),
        )
      }
      result.detail.emergingTags = emerging
    }

    scored.push(result)
  }

  scored.sort((a, b) => (b.opportunity ?? -1) - (a.opportunity ?? -1))
  return { latest, scored }
}

export function buildNotes(latest, store) {
  const notes = [...(latest?.notes ?? [])]
  const days = store.dates().length
  if (days < 2) {
    notes.push(
      'This is the first stored scan, so no supply history exists yet. Competition growth and "starting to trend" calls sharpen from the second daily run onward.',
    )
  } else if (days < 14) {
    notes.push(
      `Only ${days} days of history stored — momentum readings firm up after about two weeks of daily scans.`,
    )
  }
  // Judge this on what the snapshot actually contains rather than on whether a
  // key is configured now — a report can be rebuilt from older snapshots that
  // were collected under different settings.
  if (latest?.sources?.etsy === false) {
    notes.push('Collected without an Etsy API key: competition, price and tag data are unavailable.')
  }
  return notes
}

export function buildReport({ config, today = new Date(), write = true } = {}) {
  const store = new SnapshotStore(config.dataDir)
  const { latest, scored } = scoreSnapshot(store, { config, today })
  if (!latest) {
    throw new Error('No snapshots found. Run `npm run scan` first.')
  }

  const model = buildReportModel(scored, { config, today, longTail: latest.longTail ?? [] })
  const notes = buildNotes(latest, store)
  const markdown = renderMarkdown(model, { notes })
  const html = renderHtml(model, { notes })

  const paths = {}
  if (write) {
    ensureDir(config.reportDir)
    const date = toISODate(today)
    paths.markdown = join(config.reportDir, `${date}.md`)
    paths.html = join(config.reportDir, `${date}.html`)
    paths.latestMarkdown = join(config.reportDir, 'latest.md')
    paths.latestHtml = join(config.reportDir, 'latest.html')
    writeFileSync(paths.markdown, markdown)
    writeFileSync(paths.html, html)
    writeFileSync(paths.latestMarkdown, markdown)
    writeFileSync(paths.latestHtml, html)
  }

  return { model, markdown, html, notes, paths, scored }
}
