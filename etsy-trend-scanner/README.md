# etsy-trend-scanner

A daily "what should I list on Etsy next" report.

**Digital products by default, and the niche is an output, not an input.** Each
morning it harvests what is actually trending from unseeded feeds — no keyword
list is supplied — screens out the majority that cannot be sold *as files*, and
only then measures **demand**,
**related searches**, **supply** (how many sellers are already there and how
fast that is growing) and **timing** (how long is left to rank for the next
occasion). Then it tells you what to make, what to charge, what to tag it, and
by when.

That ordering is the point. A scanner seeded with a keyword list can only ever
find trends adjacent to the list, so it structurally cannot see the thing nobody
thought to watch for.

Everything is filtered to what a digital shop can actually make — printables,
SVGs, templates, clipart, patterns. Files have no stock, no shipping and no
lead time, which is what lets you act on a trend inside its window at all. If
you also sell physical goods, add them to `profile.formats` and the whole
pipeline follows.

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

Shop settings live in `config.json` beside the code — market, currency and the
formats you can make. It currently reads:

```json
{ "geo": "GB", "currency": "GBP", "language": "en-GB",
  "profile": { "formats": ["digital-download", "print-on-demand", "handmade-physical"] } }
```

`geo` does more than pick a language. It scopes the trending feeds and search
interest, and it selects which occasions the calendar uses at all: a `GB` shop
gets Mothering Sunday and no Thanksgiving, a `US` shop the reverse. The two
Mother's Days are about eight weeks apart, so this is not cosmetic.

Getting an Etsy API key: register an app at
<https://www.etsy.com/developers/register>. You want the **keystring** from the
app's page. The free tier is ample — a full daily scan of 60 keywords plus 20
long-tail lookups costs 80 requests against a 10,000/day allowance.

The tool works without a key, on search demand, related searches and the
seasonal calendar alone, and says so at the top of every report it produces that
way. You lose competition counts, price bands, tag mining and the listing counts
behind the long-tail table, which is most of what makes the recommendations
concrete.

### Commands

| command | what it does |
|---|---|
| `npm run scan` | Collect today's numbers into `data/snapshots/YYYY-MM-DD.json` |
| `npm run report` | Score the stored snapshots, write `reports/YYYY-MM-DD.{md,html}` |
| `npm run daily` | Both. This is what you schedule. |
| `npm run doctor` | Check keys, connectivity, and how much history you have |
| `npm run demo` | Build a report from bundled sample data |
| `node src/cli.js trending` | Today's raw harvest and what the screen kept — add `--all` to see everything it threw out |
| `npm run prune` | Thin old snapshots, drop stale report pages (`-- --dry-run` to preview) |
| `node src/cli.js related "soy candle"` | What people also search for around one term, across every feed |
| `node src/cli.js keywords` | Print the keyword universe that would be scanned |
| `node src/cli.js calendar` | Print upcoming seasonal listing deadlines |

Useful flags: `--only "term one,term two"`, `--limit 20`, `--geo GB`,
`--no-trends`, `--no-suggest`, `--no-discovery`, `--date 2026-09-15`, `--json`,
`--quiet`.

### Daily on a schedule

`.github/workflows/etsy-trend-scanner-daily.yml` runs `daily` at 06:00 UTC. Add
`ETSY_API_KEY` under the repository's Actions secrets to enable it; without the
secret the job still runs on demand data alone. Locally, `0 6 * * * cd
/path/to/etsy-trend-scanner && npm run daily` in cron does the same collection.

Each run:

1. scans and builds the report
2. prunes old snapshots and stale report pages
3. commits the day's data
4. **posts the plan as a GitHub issue** — this is what actually puts it in
   front of you, since GitHub notifies by email and on the mobile app and
   renders the markdown. Today's plan is opened and yesterday's closed, so the
   notification arrives daily while the issue list stays at one item and closed
   issues become the readable archive. Set a repository variable
   `ETSY_TRENDS_ISSUE` to `off` to disable it.
5. uploads the report as a run artifact as well

GitHub Pages is not used: `retro-premier-manager` already occupies it as this
repository's site.

### Retention

The scanner commits a snapshot and two report files daily — that is what makes
week-over-week momentum computable, and roughly 40 MB a year if nothing prunes
it. `npm run prune` runs as part of the daily job and:

- **thins** snapshots older than 35 days to the fields anything actually reads
  back — listing counts, tags, and whether the term was trending. The 52-point
  interest curve, related searches, autocomplete completions and long-tail
  probe results are used on the day they are collected and never again, and
  dropping them saves about 76% of a snapshot.
- **deletes** snapshots past 400 days and dated report HTML past 30 days.
  Report markdown is kept indefinitely: it is small, diffs readably, and is the
  archive worth having.

The newest snapshot is never touched whatever its date says, and `npm run prune
-- --dry-run` reports what would change without writing. Tunable under
`retention` in `config.json`.

---

## How niches get found

Two unseeded feeds, chosen because neither takes a keyword and they fail
independently:

| feed | what it catches |
|---|---|
| Google trending searches | what people are searching *today*, with traffic bands — a trend the moment it becomes a search |
| Wikipedia pageview spikes | what people are suddenly *reading about* — slower and far less noisy, and it names the cultural moment behind a trend |

An article absent from last week's top list entirely is treated as its own
category rather than as a very large rank climb, because expressing it as a
climb would make the score depend on how long the baseline list happened to be.

### First, collapse the same trend under different names

The two feeds disagree about naming by construction — Wikipedia gives you
article titles, Google gives you search phrases — so one trend routinely
arrives as "Wicked", "Wicked movie" and "wicked film soundtrack". Exact-match
de-duplication catches none of that, and each survivor costs four autocomplete
probes, an Etsy lookup and a row in the report.

Near-duplicates are clustered before anything is spent on them. The **searched**
phrase leads the cluster, not the highest number: pageviews and searches are
different units, and the wording buyers type is what belongs in a listing title.
The rest are kept as aliases and shown in the report.

Merging is greedy against cluster leaders rather than transitive, because
"gift" is close to both "christmas gift" and "teacher gift" while those two are
not close to each other — a chained merge would collapse unrelated niches into
one. A single shared weak word ("gift", "decor", "art") is never enough on its
own.

### Then the screen, which is the hard part

On any given day most of what trends is unsellable. Sports fixtures, breaking
news, weather, obituaries and stock moves dominate every trending feed, and none
of them is a product. A discovery scanner without a screen is a news reader.

1. **Shape screen** — free. Pattern-matches the term *and its news headlines*
   against the recognisable forms of unsellable news. The headlines carry most
   of the signal: the bare term "Cardinals" is a bird, a ball club or a
   conclave, and only the headline says which.
2. **Commerce probe** — the real test, and it asks about *your* format. A
   digital shop probes `"<term> printable"`, `"<term> svg"`, `"<term> template"`,
   `"<term> digital download"`. If people are shopping for it as a file, those
   complete richly. If it is a hurricane, nothing completes; and if it only
   completes as ceramics and jewellery, it is commercial but not relevant to
   you — which is recorded as a different rejection, not thrown in with the
   news. Breadth across product categories counts for more than depth in any
   one, because breadth is what separates a real market from a single
   coincidental phrase.

The probe budget goes to the highest-traffic survivors first. Every report opens
with the funnel — harvested, not a product, no buying intent, wrong format,
worth scanning — so a quiet day explains itself rather than just showing an
empty page.

### And a second format check, from Etsy itself

Search intent is one reading; what is actually selling is another. A niche whose
live Etsy listings are 98% physical is telling you buyers there want an object,
not a file, however the autocomplete looked. Those are set aside into a
**Filtered out — wrong format** section with the reason, never dropped silently.

That check needs a decent sample before it means anything: a brand-new trend
with eleven listings says nothing about format either way, and rejecting it on
that basis would throw away the freshest finds. Below 25 listings it abstains.

The seed list still exists as an **optional watchlist**, off by default. Turn on
`watchlist.enabled` to keep a fixed set of terms in every scan alongside
whatever discovery turns up; they are added, never substituted for discovered
ones.

## What people are also searching for

Around every niche the scanner pulls the phrases sitting next to it in people's
heads, from four independent feeds:

| feed | what it is | side |
|---|---|---|
| Google related queries | the "people also search for" list | buyer |
| Google rising queries | the same feed, filtered to what is growing fast | buyer |
| Search autocomplete | the exact phrasing people type, long tail included | buyer |
| Etsy tag co-occurrence | tags on the niche's live listings | seller |

Three are buyer-side, one is seller-side, and the interesting information is in
where they disagree. A phrase confirmed by more than one feed is a real search
rather than an artefact of one endpoint — those are marked **confirmed**. A
phrase buyers type that sellers here have *not* tagged is marked as a **gap**,
and it is the most useful thing in the report: demand with nobody claiming it.

The report uses this three ways:

- **Tags and titles** are built from confirmed search phrases, strongest first,
  rather than from whatever competitors happen to be tagging.
- **Every recommendation** carries its own "people also search for" line, with
  the untapped phrases called out separately.
- **A second scan pass** takes the strongest phrases across all niches and gives
  each one its own Etsy competition lookup, so the report ends with a
  **long-tail table**: phrases people search that came back thin on Etsy, with a
  listing count attached. Those are not niches to build a shop around — they are
  the specific wording to put in a title so a brand-new listing has something it
  can rank for on day one.

New phrases that clear the bar are also added to the watched keyword universe
permanently, so the tool's coverage grows from what buyers are actually typing
rather than from the seed list alone.

```bash
node src/cli.js related "soy candle"   # look one term up on demand
```

## How it decides

Five components, each scored 0-100, combined with the weights in `config.js`
(override them in a `config.json` beside it):

- **demand** — where the term sits inside its own 12-month search range.
- **momentum** — recent 4 weeks against the prior 12, blended with Google's
  rising-query feed. A term appearing on an unseeded trending feed today
  overrides this when it reads higher: a trend that did not exist a month ago
  has no 12-month curve to fit, which would otherwise score the newest finds as
  flat.
- **competitionGap** — active Etsy listings, log-scaled. ~2,500 listings scores
  around 72, ~200,000 around 25.
- **saturationRisk** — how fast the listing count is growing, centred on the
  marketplace's own background churn so a niche only reads as crowding when it
  outpaces Etsy as a whole. Damped by absolute niche size: a niche going from
  330 to 580 listings has "grown 74%" and is still empty, and without that
  damping every freshly discovered trend would be thrown out as crowded.
- **seasonalFit** — how close today is to the last date you could list and still
  rank for the next relevant occasion.

The product form is chosen from the completions the discovery probe found, not
from the niche name: if people search "sourdough gift printable tags", the
recommendation is a template, not the default wall-art print.

A component that is missing is dropped and the remaining weights renormalised,
so an absent signal lowers the stated confidence instead of silently scoring
zero. A niche with no upcoming occasion has no `seasonalFit` at all — that is
the normal case, not a gap.

The classifier then reads level and slope separately to place each niche in one
of: starting to trend, seasonal window, trending now, steady, saturated, fading,
or insufficient data. Recommendations are (niche x product form) pairs filtered
to formats your shop actually makes — set that in `config.profile.formats`.

### How long has it been trending?

The biggest weakness of same-day discovery is that most of what spikes on any
given day is noise — a news blip, a one-off mention, a feed artefact. A term
still trending on day four is a different proposition from the same term on day
one, and every report now says which it is:

| label | meaning |
|---|---|
| **unproven** | first seen trending today. Could be a real trend starting or a one-day blip, and there is no way to tell yet |
| **confirmed** | seen on two or more separate scans — not an artefact of one feed on one day |
| **sustained** | present in most scans since it appeared. This one has legs |

Persistence only ever *adds* to the score, never subtracts. Being early is the
entire thesis of this tool, so a first-day trend is still recommended — it is
recommended with "unproven" attached and capped below high confidence, rather
than hidden. A trend that comes and goes rather than building is flagged
separately as episodic (a weekly release, a recurring event), which is a
different thing from one growing.

Measured as a share of the scans that actually ran, not calendar days: if the
scheduled job fails on a Tuesday that is our outage, not the trend going quiet.

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
- **Prices are per-listing currency, and are not converted.** Etsy returns each
  listing's price in the seller's own currency, so the median is taken over the
  dominant currency on the page and the rest are excluded rather than averaged
  in. Where coverage is thin the report says so and the band should be read as
  indicative. There is no FX conversion anywhere in this tool.

- **Google Trends numbers are normalised per query** — 0-100 against that term's
  own 12-month peak — so they are not comparable between keywords. The tool
  never treats them as volume; cross-keyword comparison is carried by the Etsy
  listing counts, which are absolute.
- **The Trends and autocomplete endpoints are unofficial.** Both are Google
  internals — the ones behind the Trends site and the browser search bar — not
  supported APIs. Trends rate-limits hard; both can change shape without notice.
  Failures are recorded, never fatal; a scan that loses one still writes a
  snapshot so tomorrow's momentum calculation has today's row.

- **Autocomplete is phrasing, not volume.** It tells you a completion is common
  enough for Google to offer it and roughly how it ranks against its siblings.
  It does not tell you how many people searched it, and nothing here pretends
  otherwise — which is why a suggestion only becomes a recommendation once
  another feed or an Etsy listing count backs it up.

- **Etsy has no public "related searches" endpoint.** The seller-side view here
  is tag co-occurrence across the niche's live listings, which is a good proxy
  for what sellers *believe* buyers search — not Etsy's own search data, which
  is not published.
- **Nothing here scrapes etsy.com.** Everything comes from the documented Open
  API v3 with an application key, which is both more reliable and within Etsy's
  terms.
- **Format screening is two heuristics, not a guarantee.** The search-intent
  probe can miss a niche that people buy as files without using file words, and
  the Etsy digital-share check is a sample of 100 listings, not a census.
  `node src/cli.js trending --all` shows every rejection with its reason.

- **Most of what trends cannot be sold, and the screen is a heuristic.** It will
  occasionally reject something sellable (a craft term that shares a word with a
  news story) and occasionally pass something that is not. `node src/cli.js
  trending --all` shows every rejection with its reason, which is the fastest
  way to tune it. Rejection patterns live in `src/analyze/sellable.js`.

- **Trending does not mean yours to sell.** Discovery surfaces films, shows,
  characters, bands and people, because that is a large share of both what
  trends and what sells on Etsy. It is also the fastest route to a takedown, a
  suspended shop, or worse. Every name-shaped trend carries a trademark warning
  in the report, and the tool deliberately does not decide for you: a generic
  craft term is yours, a protected title is not, and there is real space in
  between. Treat a high-risk flag as "sell the style, not the named thing".

- **The seasonal model is opinionated.** It assumes a listing needs 35-55 days of
  age to rank into a crowded peak, so it will tell you Halloween is closed in
  late August. That is a deliberate bias toward listing early; adjust
  `rankDays` per event in `src/seasonal.js` if you disagree.

## Layout

```
src/
  cli.js            command line entry point
  config.js         defaults, .env and config.json resolution
  keywords.js       product forms, optional watchlist, universe assembly
  seasonal.js       occasion calendar and list-by date maths
  store.js          daily snapshot persistence
  scan.js           collection orchestration
  demo.js           deterministic sample data
  prune.js          snapshot thinning and retention
  sources/          trending.js, etsy.js, googleTrends.js, suggest.js, http.js
  analyze/          momentum.js, score.js, sellable.js, cluster.js, persistence.js,
                    related.js, tags.js
  report/           build.js, recommend.js, markdown.js, html.js
tests/              node --test, no network required
```

```bash
npm test     # 170 tests, all offline
npm run lint
```
