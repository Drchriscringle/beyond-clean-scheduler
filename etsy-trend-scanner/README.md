# etsy-trend-scanner

A daily "what should I list on Etsy next" report.

It watches a universe of Etsy niches, measures **demand** (search interest and
its rate of change), **supply** (how many sellers are already there and how fast
that number is growing) and **timing** (how long is left to rank for the next
occasion), then tells you what to make, what to charge, what to tag it, and by
when.

The distinction the whole tool is built around:

| | what it looks like | what it's worth |
|---|---|---|
| **Trending now** | high interest, still climbing | you can sell into it, but so can everyone |
| **Starting to trend** | low base, steep climb, few sellers | this is the window where a new listing can still reach page one |
| **Saturated** | sellers arriving faster than buyers | listing here buys you nothing |

Anyone can see what is trending. The money is in the second row, which is why
momentum and market level are scored separately and never averaged before the
classifier sees both.

---

## Quick look, no setup

```bash
cd etsy-trend-scanner
npm run demo          # builds a report from bundled sample data
open reports/demo/latest.html
```

A committed sample of that output lives in [`docs/sample-report.md`](docs/sample-report.md).

## Real setup

```bash
cp .env.example .env
# put your Etsy keystring in .env, then:
npm run doctor        # checks credentials, connectivity and stored history
npm run daily         # scan + report
```

Getting an Etsy API key: register an app at
<https://www.etsy.com/developers/register>. You want the **keystring** from the
app's page. The free tier is ample — a full daily scan of 60 keywords costs 60
requests against a 10,000/day allowance.

The tool works without a key, on search demand and the seasonal calendar alone,
and says so at the top of every report it produces that way. You lose
competition counts, price bands and tag mining, which is most of what makes the
recommendations concrete.

### Commands

| command | what it does |
|---|---|
| `npm run scan` | Collect today's numbers into `data/snapshots/YYYY-MM-DD.json` |
| `npm run report` | Score the stored snapshots, write `reports/YYYY-MM-DD.{md,html}` |
| `npm run daily` | Both. This is what you schedule. |
| `npm run doctor` | Check keys, connectivity, and how much history you have |
| `npm run demo` | Build a report from bundled sample data |
| `node src/cli.js keywords` | Print the keyword universe that would be scanned |
| `node src/cli.js calendar` | Print upcoming seasonal listing deadlines |

Useful flags: `--only "term one,term two"`, `--limit 20`, `--geo GB`,
`--no-trends`, `--date 2026-09-15`, `--json`, `--quiet`.

### Daily on a schedule

`.github/workflows/etsy-trend-scanner-daily.yml` runs `daily` at 06:00 UTC and
commits the new snapshot and report. Add `ETSY_API_KEY` under the repository's
Actions secrets to enable it; without the secret the job still runs on demand
data alone. Locally, `0 6 * * * cd /path/to/etsy-trend-scanner && npm run daily`
in cron does the same job.

---

## How it decides

Five components, each scored 0-100, combined with the weights in `config.js`
(override them in a `config.json` beside it):

- **demand** — where the term sits inside its own 12-month search range.
- **momentum** — recent 4 weeks against the prior 12, blended with Google's
  rising-query feed. Breakout queries count heavily; they are the earliest
  usable signal there is.
- **competitionGap** — active Etsy listings, log-scaled. ~2,500 listings scores
  around 72, ~200,000 around 25.
- **saturationRisk** — how fast the listing count is growing, centred on the
  marketplace's own background churn so a niche only reads as crowding when it
  outpaces Etsy as a whole.
- **seasonalFit** — how close today is to the last date you could list and still
  rank for the next relevant occasion.

A component that is missing is dropped and the remaining weights renormalised,
so an absent signal lowers the stated confidence instead of silently scoring
zero. A niche with no upcoming occasion has no `seasonalFit` at all — that is
the normal case, not a gap.

The classifier then reads level and slope separately to place each niche in one
of: starting to trend, seasonal window, trending now, steady, saturated, fading,
or insufficient data. Recommendations are (niche x product form) pairs filtered
to formats your shop actually makes — set that in `config.profile.formats`.

### Why it needs a few days

"Starting to trend" on the supply side means *competing listings grew slower
than demand*, and Etsy publishes no history for that. So the tool builds its
own: one small JSON file per day in `data/snapshots/`, committed alongside the
code. Day one gives you demand momentum and the seasonal calendar; supply
momentum arrives from day two and firms up over about a fortnight. Every report
states how much history it had.

---

## What this cannot tell you

Worth being straight about, because plenty of tools in this space are not:

- **There is no sales data in here.** Etsy's public API exposes no views,
  favourites or sales counts for listings you do not own, and there is no public
  "trending on Etsy" feed. Nothing in the report is a revenue forecast. What it
  measures is *interest* and *competition*, which is what you can actually
  observe.
- **Google Trends numbers are normalised per query** — 0-100 against that term's
  own 12-month peak — so they are not comparable between keywords. The tool
  never treats them as volume; cross-keyword comparison is carried by the Etsy
  listing counts, which are absolute.
- **The Trends endpoint is unofficial.** It rate-limits hard and its response
  shape can change. Failures are recorded, never fatal; a scan that loses Trends
  still writes a snapshot so tomorrow's momentum calculation has today's row.
- **Nothing here scrapes etsy.com.** Everything comes from the documented Open
  API v3 with an application key, which is both more reliable and within Etsy's
  terms.
- **The seasonal model is opinionated.** It assumes a listing needs 35-55 days of
  age to rank into a crowded peak, so it will tell you Halloween is closed in
  late August. That is a deliberate bias toward listing early; adjust
  `rankDays` per event in `src/seasonal.js` if you disagree.

## Layout

```
src/
  cli.js            command line entry point
  config.js         defaults, .env and config.json resolution
  keywords.js       seed niches, product forms, universe assembly
  seasonal.js       occasion calendar and list-by date maths
  store.js          daily snapshot persistence
  scan.js           collection orchestration
  demo.js           deterministic sample data
  sources/          etsy.js, googleTrends.js, http.js
  analyze/          momentum.js, score.js, tags.js
  report/           build.js, recommend.js, markdown.js, html.js
tests/              node --test, no network required
```

```bash
npm test     # 77 tests, all offline
npm run lint
```
