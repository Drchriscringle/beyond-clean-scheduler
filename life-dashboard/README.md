# Life Dashboard

One page for the whole of it: what is on today, what is coming up, what leaves
your account before payday, what your plans are actually doing, and what the
world said about the people and companies you are watching.

It runs on your own machine and keeps its data in plain JSON files next to
itself. There is no account, no cloud, and nothing talks to a server but your
own.

```bash
npm install
npm run demo     # fill it with a worked example
npm run brief    # today, in the terminal
npm run build && npm start   # the dashboard at http://localhost:5175
```

For development with hot reload, `npm run dev` runs the API and the Vite dev
server together.

---

## What it does

**Today** — the diary for the next week, what is due to leave your account, the
next steps on your objectives, and a short list of things that genuinely want a
decision today.

**Money** — every direct debit, standing order, subscription and income stream
as a rule, projected forward day by day; what actually left the account, checked
against what you expected; and what the whole lot costs per year.

**Diary** — subscribed calendars plus anything you add here.

**Plans** — objectives with one number to move and one next step, and an honest
note when one has stopped moving.

**Reel** — news about the companies, people and topics on your watchlist.

Everything on the page is also available as `life brief` in a terminal, built
from the same code, so a shell profile or a morning cron job shows exactly what
the browser would.

---

## The design decisions worth knowing about

### Dates are day keys, not `Date`s

Everything that means "a day in your life" — a bill due, a deadline, tomorrow's
agenda — is a `YYYY-MM-DD` string. A `Date` is a *moment*, and a moment is the
wrong type for "the 3rd of the month": add a month to one and you inherit
whatever the runtime's timezone and daylight saving were doing that night. Day
arithmetic anchors on UTC noon so a ±13h timezone shift can never move a result
onto the wrong day (`server/lib/dates.js`).

### Bills do not behave like meetings, so they use a different engine

A meeting set for the 31st simply does not happen in February — that is what
iCalendar's `RRULE` says, and the calendar engine implements it. Rent set for
the 31st comes out on the **28th**. Money scheduling is therefore its own module
that clamps to the end of a short month, and additionally moves a payment off a
weekend or bank holiday in the direction it really travels (`server/money/schedule.js`).

Bank holidays come from gov.uk's free JSON, cached for a year. The dashboard
works without it; a missing list only makes the forecast slightly optimistic.

### The forecast reports the lowest point, not the closing balance

A month that ends comfortably can still bounce a direct debit on the 12th, and a
closing balance hides exactly that. So the money panel leads with the dip: the
lowest point between now and payday, and what is safe to spend today given
everything still to leave (`server/money/forecast.js`).

"Safe to spend" is measured at that dip minus your buffer — spend it and every
commitment in between still clears.

### Money is pence, always

Integer pence end to end. `0.1 + 0.2` is not `0.3`, and a life dashboard that
drifts by a penny a month is a life dashboard nobody trusts.

### Reconciliation is the point, not a feature

Three things a list of bills can never tell you, all of which this checks for:

- a direct debit that **did not come out**,
- a bill that **quietly went up**,
- a recurring payment **you never set up** and had forgotten you were making.

Bank narratives are shouty and full of reference numbers, so matching normalises
them down to the words that matter and scores on token overlap rather than edit
distance — `DD NETFLIX.COM 1029384756` matches a commitment called `Netflix`
(`server/money/reconcile.js`).

Finding an unknown subscription needs a longer run of history than reconciling
this month's bills does: a monthly charge cannot repeat three times inside a
month. So those two look at different windows.

### Three ways to get real transactions in, and only one of them is required

1. **Type the rules in.** Works offline, needs no bank, and is enough for the
   forecast on its own.
2. **Import a CSV.** Every bank exports a different shape and several of them
   are wrong in the same predictable ways — `DD/MM/YYYY`, separate debit and
   credit columns, `£1,200.00`, accounting brackets for negatives, and merchants
   with commas in their names. Columns are detected rather than assumed, and any
   row that cannot be read is **reported**, never silently dropped.
3. **Connect a bank** through TrueLayer Open Banking (optional). Read-only
   scopes; nothing in this codebase can move money, and the payments API is never
   touched. Tokens live in `connections.json`, written `0600`. See
   `.env.example`; the sandbox environment is the default so a misconfiguration
   cannot reach a real bank.

Whichever route, transactions arrive in one shape, so everything downstream
cannot tell where they came from.

### Calendars are read-only, by subscription

Point it at the secret `.ics` address Google, Apple or Outlook publishes. No
OAuth dance, no write access, and it works with any calendar. The parser handles
what feeds actually emit: folded lines, escaped text, three flavours of
timestamp, cancelled events, `EXDATE`, and single occurrences of a repeating
event moved to another day.

A feed that fails keeps serving its last good copy **and says so** — losing
today's meetings because a server hiccuped is worse than showing them slightly
stale with a note.

`RRULE` support covers `DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY` with `INTERVAL`,
`COUNT`, `UNTIL`, `BYDAY` (including `-1FR`, "the last Friday"), `BYMONTHDAY`
and `BYMONTH`. `BYSETPOS`, `BYWEEKNO` and sub-daily frequencies are **not**
supported, and an event using them falls back to its start date rather than
landing on wrong days silently.

### A watchlist that works the moment you type a name

Each target becomes a news search automatically, so adding "Acme Group" starts
working with nothing to configure. You can also subscribe to any RSS or Atom
feed directly, and everything from those is matched against the whole watchlist.

The failure mode a news reel dies of is noise, so matching is on whole words and
whole phrases (watch "Apex" and you do not get apex predators), a target can
carry exclusions, and it can insist a story also mentions something else before
it counts. The same story from several outlets collapses into one item that
credits them all.

### Stalled is information, not a reproach

An objective is only ever shown with its next action attached, and one that has
not moved in a fortnight says so. A list of goals you never revisit is worse
than no list, because it quietly converts ambition into guilt — and "this has
not moved in 23 days" is usually the signal that a goal needs re-scoping or
dropping. Both are fine outcomes.

Progress prefers a real metric over counting ticked boxes: "12 of 20 clients"
says more than "3 of 5 tasks", and tasks are a proxy people game without meaning
to.

### The attention list is deliberately short

Capped at six, worst first. A dashboard that flags fifteen things flags nothing.

### It is bound to localhost

The server listens on `127.0.0.1` only. This is one person's calendar, bank
balance and plans; it should not become reachable from the network because a
laptop joined a café's wifi.

---

## Data

Plain JSON, one file per collection, in `./data` (override with
`LIFE_DASHBOARD_DATA_DIR`). Back it up, diff it, move it, edit it in a text
editor. Writes go to a temporary file and are renamed into place, so a crash
mid-write cannot truncate a collection.

`connections.json` holds bank tokens and is written user-readable only.

---

## Commands

```
life brief [--day YYYY-MM-DD] [--no-news]   Print today (the default)
life serve                                  Run the dashboard
life demo                                   Fill it with example data
life import <file.csv> [--account <id>]     Import a bank statement
life doctor                                 Check what is configured and reachable
```

`npm test` runs the suite; `npm run lint` runs oxlint.

---

## What is not done

- **Live feed fetching is unverified in CI.** The parsers, matchers, caching and
  failure handling are all tested against fixtures and stubs, but no test makes
  a real network call — so the first time you add a calendar or news source,
  check `life doctor`.
- **Open Banking is written against TrueLayer's documented API and tested against
  stubbed responses**, including token refresh and expiry. It has not been run
  against a live TrueLayer sandbox account.
- **One person, one dashboard.** No sharing, no multi-user, no auth — that is
  the point, but it means the localhost binding is the only thing protecting it.
- The reel ranks by recency and match strength only. It does not summarise, and
  it has no opinion about whether a story matters.
