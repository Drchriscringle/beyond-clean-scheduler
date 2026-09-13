#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createStore } from './store.js'
import { createBrief, formatPence, profileOf } from './brief.js'
import { loadDemo } from './demo.js'
import { createDashboardServer } from './index.js'
import { today as todayIn, formatDay, relativeDay } from './lib/dates.js'
import { importCsv, mergeTransactions } from './money/csv.js'
import { bankingConfig, isConfigured } from './money/banking.js'

/**
 * The dashboard from a terminal.
 *
 * `life brief` prints the same day the browser shows, which makes it something
 * you can put in a shell profile or a morning cron job and actually read
 * before you have opened anything.
 */

const COLOURS = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, text) => (COLOURS ? `[${code}m${text}[0m` : text)
const bold = (text) => paint('1', text)
const dim = (text) => paint('2', text)
const red = (text) => paint('31', text)
const amber = (text) => paint('33', text)
const green = (text) => paint('32', text)
const cyan = (text) => paint('36', text)

async function main(argv) {
  const [command = 'brief', ...args] = argv
  const store = createStore()

  switch (command) {
    case 'brief': return printBrief(store, args)
    case 'serve': return serve(store)
    case 'demo': return demo(store)
    case 'import': return runImport(store, args)
    case 'doctor': return doctor(store)
    case 'help': case '--help': case '-h': return help()
    default:
      console.error(`Unknown command: ${command}\n`)
      help()
      process.exitCode = 1
  }
}

function help() {
  console.log(`Life Dashboard

  life brief [--day YYYY-MM-DD] [--no-news]   Print today (the default)
  life serve                                  Run the dashboard at http://localhost:5175
  life demo                                   Fill the dashboard with example data
  life import <file.csv> [--account <id>]     Import a bank statement
  life doctor                                 Check what is configured and reachable
`)
}

function flag(args, name) {
  return args.includes(`--${name}`)
}

function option(args, name) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : null
}

async function printBrief(store, args) {
  const brief = createBrief({ store })
  const result = await brief.build({
    day: option(args, 'day'),
    includeNews: !flag(args, 'no-news'),
  })
  const money = (pence, options) => formatPence(pence, { currency: result.profile.currency, locale: result.profile.locale, ...options })

  console.log('')
  console.log(bold(`${result.greeting}. ${result.heading}.`))

  if (result.attention.length > 0) {
    console.log('')
    for (const item of result.attention) {
      const mark = item.severity === 'high' ? red('!!') : item.severity === 'medium' ? amber(' !') : dim(' ·')
      console.log(`  ${mark} ${item.text}`)
    }
  }

  // ---- today ----
  console.log('')
  console.log(bold('Today'))
  if (result.agenda.today.length === 0) console.log(dim('  Nothing in the diary.'))
  for (const entry of result.agenda.today) {
    console.log(`  ${cyan((entry.time ?? 'all day').padEnd(8))} ${entry.title}${entry.location ? dim(` — ${entry.location}`) : ''}`)
  }
  for (const objective of result.objectives.onToday) {
    console.log(`  ${cyan('to do'.padEnd(8))} ${objective.nextStep.title} ${dim(`(${objective.title})`)}`)
  }

  if (result.agenda.tomorrow.length > 0) {
    console.log('')
    console.log(bold('Tomorrow'))
    for (const entry of result.agenda.tomorrow) {
      console.log(`  ${cyan((entry.time ?? 'all day').padEnd(8))} ${entry.title}`)
    }
  }

  // ---- money ----
  const { runway, reconciliation } = result.money
  console.log('')
  console.log(bold('Money'))
  console.log(`  Balance today      ${money(result.money.openingPence)}`)
  if (runway.payday) {
    console.log(`  Next payday        ${formatDay(runway.payday.day, { weekday: false })} ${dim(`(${relativeDay(runway.payday.day, result.today)})`)}  ${green(money(runway.payday.amountPence, { signed: true }))}`)
    console.log(`  Still to go out    ${money(runway.outgoingBeforePaydayPence)} over ${runway.outgoingCount} payment${runway.outgoingCount === 1 ? '' : 's'}`)
    console.log(`  Lowest point       ${runway.tight ? red(money(runway.lowestBeforePaydayPence)) : money(runway.lowestBeforePaydayPence)}`)
    console.log(`  Safe to spend      ${bold(money(runway.safeToSpendPence))}`)
  }

  if (result.money.dueSoon.length > 0) {
    console.log('')
    console.log(dim('  Due in the next fortnight'))
    for (const item of result.money.dueSoon) {
      const amount = item.amountPence >= 0 ? green(money(item.amountPence, { signed: true })) : money(item.amountPence, { signed: true })
      console.log(`    ${formatDay(item.day, { weekday: false }).padEnd(14)} ${item.name.padEnd(26)} ${amount}${item.moved ? dim(' (moved off a weekend)') : ''}`)
    }
  }

  for (const entry of reconciliation.missing) {
    console.log(`  ${amber('!')} ${entry.name} has not come out (due ${formatDay(entry.day, { weekday: false })}).`)
  }
  for (const entry of reconciliation.unexpected) {
    console.log(`  ${amber('!')} ${entry.description} — ${money(entry.amountPence)} ${entry.frequency}, ${money(entry.annualPence)}/yr, not in your list.`)
  }

  // ---- objectives ----
  if (result.objectives.active.length > 0) {
    console.log('')
    console.log(bold('Objectives'))
    for (const objective of result.objectives.active) {
      const bar = progressBar(objective.progress.fraction)
      const note = objective.overdue
        ? red(` overdue ${objective.dueLabel}`)
        : objective.stalled
          ? amber(` no movement in ${objective.idleDays} days`)
          : objective.dueOn ? dim(` due ${objective.dueLabel}`) : ''
      console.log(`  ${bar} ${objective.title}${note}`)
      if (objective.nextStep) console.log(`       ${dim('next:')} ${objective.nextStep.title}`)
    }
  }

  // ---- news ----
  if (result.news.items.length > 0) {
    console.log('')
    console.log(bold('On your watchlist'))
    for (const item of result.news.items.slice(0, 8)) {
      console.log(`  ${item.title}`)
      console.log(`    ${dim(`${item.targets.map((target) => target.name).join(', ')} · ${item.sources.join(', ')}`)}`)
    }
  }
  if (result.news.problems?.length > 0) {
    console.log(dim(`\n  (${result.news.problems.length} news source${result.news.problems.length === 1 ? '' : 's'} could not be reached)`))
  }
  console.log('')
}

function progressBar(fraction, width = 10) {
  const filled = Math.round((fraction ?? 0) * width)
  return `${'█'.repeat(filled)}${dim('░'.repeat(width - filled))}`
}

function serve(store) {
  const port = Number(process.env.PORT) || 5175
  createDashboardServer({ store }).listen(port, '127.0.0.1', () => {
    console.log(`Life Dashboard  →  http://localhost:${port}`)
    console.log(`Data            →  ${store.root}`)
  })
}

async function demo(store) {
  const profile = profileOf(await store.get('profile'))
  await loadDemo(store, todayIn(profile.timezone))
  console.log(`Example data written to ${store.root}. Run \`life brief\` or \`life serve\`.`)
}

async function runImport(store, args) {
  const [file] = args.filter((argument) => !argument.startsWith('--'))
  if (!file) {
    console.error('Usage: life import <file.csv> [--account <id>] [--month-first]')
    process.exitCode = 1
    return
  }

  const text = await readFile(file, 'utf8')
  const { transactions, skipped, columns } = importCsv(text, {
    accountId: option(args, 'account'),
    dayFirst: !flag(args, 'month-first'),
  })

  let added = 0
  let duplicates = 0
  await store.update('transactions', (existing) => {
    const merged = mergeTransactions(existing, transactions)
    added = merged.added
    duplicates = merged.duplicates
    return merged.transactions
  })

  console.log(`Read ${transactions.length} transactions (${Object.keys(columns).join(', ')}).`)
  console.log(`  ${added} new, ${duplicates} already held.`)
  if (skipped.length > 0) {
    console.log(`  ${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped:`)
    for (const row of skipped.slice(0, 5)) console.log(`    line ${row.line}: ${row.reason}`)
  }
}

async function doctor(store) {
  const profile = profileOf(await store.get('profile'))
  const counts = {}
  for (const collection of ['accounts', 'commitments', 'transactions', 'events', 'feeds', 'targets', 'objectives']) {
    counts[collection] = (await store.get(collection)).length
  }

  console.log(`\nData directory   ${store.root}`)
  console.log(`Timezone         ${profile.timezone}`)
  console.log(`Currency         ${profile.currency}`)
  console.log(`Open Banking     ${isConfigured(bankingConfig()) ? `configured (${bankingConfig().environment})` : 'not configured — optional'}`)
  console.log('')
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${String(count).padStart(4)}  ${name}`)
  }

  const feeds = await store.get('feeds')
  if (feeds.length > 0) {
    console.log('\nCalendar feeds')
    const { createCalendar } = await import('./calendar/agenda.js')
    const report = await createCalendar({ store }).refresh({ force: true })
    for (const entry of report) {
      console.log(`  ${entry.error ? red('✗') : green('✓')} ${entry.name}${entry.error ? ` — ${entry.error}` : ` (${entry.events} events)`}`)
    }
  }
  console.log('')
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
