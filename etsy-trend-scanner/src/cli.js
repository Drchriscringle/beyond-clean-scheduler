#!/usr/bin/env node
/**
 * etsy-trends — command line entry point.
 *
 *   scan      collect today's numbers into data/snapshots/YYYY-MM-DD.json
 *   report    score the stored snapshots and write today's report
 *   daily     scan then report (what the scheduled job runs)
 *   doctor    check credentials and connectivity before you rely on it
 *   demo      build a report from bundled sample data, no API key needed
 *   keywords  show the current keyword universe
 *   related   show what people also search for around one term
 *   calendar  show upcoming seasonal listing deadlines
 */

import { loadConfig } from './config.js'
import { runScan } from './scan.js'
import { buildReport } from './report/build.js'
import { SnapshotStore } from './store.js'
import { EtsyClient, summariseListings } from './sources/etsy.js'
import { TrendsClient } from './sources/googleTrends.js'
import { SuggestClient } from './sources/suggest.js'
import { SOURCE_LABELS, mergeRelated } from './analyze/related.js'
import { activeSeasonalThemes, upcomingEvents } from './seasonal.js'
import { buildKeywordUniverse } from './keywords.js'
import { writeDemoData } from './demo.js'

const USAGE = `etsy-trends — find what to list on Etsy next

Usage: etsy-trends <command> [options]

Commands:
  scan        Collect today's demand and competition numbers into a snapshot
  report      Score stored snapshots and write today's report
  daily       scan + report (run this on a schedule)
  doctor      Check API keys, connectivity and stored history
  demo        Build a report from bundled sample data (no API key required)
  keywords    Print the keyword universe that would be scanned
  calendar    Print upcoming seasonal listing deadlines
  related     Show what people also search for around a term

Options:
  --limit <n>        Cap keywords scanned this run
  --only <terms>     Comma-separated keywords to scan instead of the universe
  --no-etsy          Skip the Etsy API
  --no-trends        Skip Google Trends
  --no-suggest       Skip search autocomplete
  --geo <code>       Override market country (default US)
  --date <ISO>       Treat this date as "today" (for backfills and tests)
  --json             Print the report model as JSON instead of text
  --quiet            Suppress per-keyword progress output
`

function parseArgs(argv) {
  const args = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      args._.push(token)
      continue
    }
    const key = token.slice(2)
    if (key.startsWith('no-')) {
      args.flags[key.slice(3)] = false
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args.flags[key] = true
    } else {
      args.flags[key] = next
      i += 1
    }
  }
  return args
}

function resolveToday(flags) {
  if (!flags.date || flags.date === true) return new Date()
  const parsed = new Date(flags.date)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --date: ${flags.date}`)
  return parsed
}

function summarise(model) {
  const lines = []
  for (const section of model.sections) {
    if (!section.rows.length) continue
    lines.push('')
    lines.push(section.heading.toUpperCase())
    for (const row of section.rows.slice(0, 8)) {
      const score = row.opportunity ?? '—'
      const product = row.product ? ` → ${row.product.form}` : ''
      const when = row.deadline ? `  [start by ${row.deadline.startBy}]` : ''
      lines.push(`  ${String(score).padStart(3)}  ${row.term}${product}${when}`)
    }
  }
  return lines.join('\n')
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const command = args._[0] ?? 'help'

  if (command === 'help' || args.flags.help) {
    process.stdout.write(USAGE)
    return
  }

  const overrides = {}
  if (typeof args.flags.geo === 'string') overrides.geo = args.flags.geo
  const config = loadConfig({ overrides })
  const today = resolveToday(args.flags)
  const quiet = args.flags.quiet === true
  const logger = quiet ? () => {} : (msg) => process.stderr.write(`${msg}\n`)

  const scanOptions = {
    config,
    today,
    logger,
    useEtsy: args.flags.etsy !== false,
    useTrends: args.flags.trends !== false,
    useSuggest: args.flags.suggest !== false,
    limit: args.flags.limit ? Number(args.flags.limit) : undefined,
    only:
      typeof args.flags.only === 'string'
        ? args.flags.only.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
  }

  switch (command) {
    case 'scan': {
      const { snapshot, path } = await runScan(scanOptions)
      process.stdout.write(
        `Snapshot written: ${path} (${Object.keys(snapshot.keywords).length} keywords)\n`,
      )
      for (const note of snapshot.notes) process.stdout.write(`note: ${note}\n`)
      break
    }

    case 'report': {
      const result = buildReport({ config, today })
      if (args.flags.json) {
        process.stdout.write(`${JSON.stringify(result.model, null, 2)}\n`)
      } else {
        process.stdout.write(`Etsy listing plan — ${result.model.date}\n`)
        process.stdout.write(`${summarise(result.model)}\n\n`)
        for (const note of result.notes) process.stdout.write(`note: ${note}\n`)
        process.stdout.write(`\nWritten: ${result.paths.markdown}\n         ${result.paths.html}\n`)
      }
      break
    }

    case 'daily': {
      await runScan(scanOptions)
      const result = buildReport({ config, today })
      process.stdout.write(`Etsy listing plan — ${result.model.date}\n`)
      process.stdout.write(`${summarise(result.model)}\n\n`)
      for (const note of result.notes) process.stdout.write(`note: ${note}\n`)
      process.stdout.write(`\nWritten: ${result.paths.markdown}\n         ${result.paths.html}\n`)
      break
    }

    case 'demo': {
      const demoConfig = writeDemoData({ config, today })
      const result = buildReport({ config: demoConfig, today })
      process.stdout.write(`Sample report (bundled data, not live)\n`)
      process.stdout.write(`${summarise(result.model)}\n\n`)
      process.stdout.write(`Written: ${result.paths.markdown}\n         ${result.paths.html}\n`)
      break
    }

    case 'doctor': {
      await doctor(config, today)
      break
    }

    case 'keywords': {
      const store = new SnapshotStore(config.dataDir)
      const universe = buildKeywordUniverse({
        discovered: [...store.readDiscovered(), ...activeSeasonalThemes(today)],
        max: config.limits.maxKeywordsPerScan,
      })
      for (const row of universe) {
        process.stdout.write(`${row.origin.padEnd(11)} ${row.category.padEnd(26)} ${row.term}\n`)
      }
      process.stdout.write(`\n${universe.length} keywords\n`)
      break
    }

    case 'related': {
      const term = args._.slice(1).join(' ').trim()
      if (!term) {
        process.stderr.write('Usage: etsy-trends related "<term>"\n')
        process.exitCode = 1
        break
      }
      await showRelated(term, config, logger)
      break
    }

    case 'calendar': {
      for (const event of upcomingEvents(today)) {
        process.stdout.write(
          `${event.date.toISOString().slice(0, 10)}  ${event.name.padEnd(38)} ` +
            `buyer peak in ${String(event.daysToPeak).padStart(4)}d, needs ~${event.rankDays}d of listing age\n`,
        )
      }
      break
    }

    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`)
      process.exitCode = 1
  }
}

/**
 * Ad-hoc lookup: every related-search feed for one term, side by side. Useful
 * for sanity-checking a niche before committing a listing to it.
 */
async function showRelated(term, config, logger) {
  const trends = new TrendsClient({
    geo: config.geo,
    language: config.language,
    limits: config.limits,
    logger,
  })
  const suggest = new SuggestClient({
    geo: config.geo,
    language: config.language,
    limits: config.limits,
    logger,
  })
  const etsy = config.etsyApiKey
    ? new EtsyClient({ apiKey: config.etsyApiKey, limits: config.limits, logger })
    : null

  const [trendsResult, suggestResult, etsyResult] = await Promise.all([
    trends.collect(term),
    suggest.collect(term),
    etsy ? etsy.searchActiveListings(term).catch(() => null) : Promise.resolve(null),
  ])

  const rows = mergeRelated({
    term,
    trendsTop: trendsResult.ok ? trendsResult.top : [],
    trendsRising: trendsResult.ok ? trendsResult.rising : [],
    suggestions: suggestResult.ok ? suggestResult.suggestions : [],
    topTags: etsyResult ? summariseListings(etsyResult).topTags : [],
    limit: 25,
  })

  process.stdout.write(`People also search for — "${term}" (${config.geo})\n\n`)
  if (!trendsResult.ok) process.stdout.write(`  google trends unavailable: ${trendsResult.error}\n`)
  if (!suggestResult.ok) process.stdout.write(`  autocomplete unavailable: ${suggestResult.error}\n`)
  if (!rows.length) {
    process.stdout.write('  nothing found.\n')
    return
  }

  for (const row of rows) {
    const marks = [
      row.breakout ? 'BREAKOUT' : null,
      row.crossConfirmed ? 'confirmed' : null,
      row.inEtsyTags ? null : 'untagged on Etsy',
    ].filter(Boolean)
    process.stdout.write(
      `  ${String(Math.round(row.score)).padStart(3)}  ${row.query.padEnd(38)} ` +
        `${row.sources.map((source) => SOURCE_LABELS[source] ?? source).join(', ')}` +
        `${marks.length ? `  [${marks.join(', ')}]` : ''}\n`,
    )
  }
}

async function doctor(config, today) {
  const out = (msg) => process.stdout.write(`${msg}\n`)
  out('etsy-trends doctor')
  out('')

  out(`market            ${config.geo}`)
  out(`data directory    ${config.dataDir}`)
  out(`report directory  ${config.reportDir}`)

  const store = new SnapshotStore(config.dataDir)
  const dates = store.dates()
  out(
    `stored snapshots  ${dates.length}${dates.length ? ` (${dates[0]} → ${dates[dates.length - 1]})` : ''}`,
  )
  out(`discovered terms  ${store.readDiscovered().length}`)
  out('')

  if (!config.etsyApiKey) {
    out('etsy api          NOT CONFIGURED')
    out('                  Create an app at https://www.etsy.com/developers/register')
    out('                  then put ETSY_API_KEY=<keystring> in etsy-trend-scanner/.env')
  } else {
    const client = new EtsyClient({ apiKey: config.etsyApiKey, limits: config.limits })
    try {
      await client.ping()
      out('etsy api          OK')
    } catch (err) {
      out(`etsy api          FAILED — ${err.message}`)
    }
  }

  const trends = new TrendsClient({ geo: config.geo, language: config.language, limits: config.limits })
  const probe = await trends.collect('soy candle')
  out(probe.ok ? 'google trends     OK' : `google trends     FAILED — ${probe.error}`)

  const suggest = new SuggestClient({
    geo: config.geo,
    language: config.language,
    limits: config.limits,
  })
  const suggestProbe = await suggest.collect('soy candle')
  out(
    suggestProbe.ok
      ? `autocomplete      OK (${suggestProbe.suggestions.length} suggestions for "soy candle")`
      : `autocomplete      FAILED — ${suggestProbe.error}`,
  )

  const events = upcomingEvents(today).slice(0, 3)
  out('')
  out('next deadlines')
  for (const event of events) {
    out(`  ${event.name} — buyer peak in ${event.daysToPeak} days`)
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err.message}\n`)
  process.exitCode = 1
})
