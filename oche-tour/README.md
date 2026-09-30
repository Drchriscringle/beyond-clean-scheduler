# Oche Tour

A darts career game you play with **real darts on your own board**. You throw your visit and
type in the score, then a virtual opponent throws theirs, dart by dart, on a board on screen.
The career follows the real PDC season: Q-School in January for a two-year Tour Card, the
Challenge Tour (and the Development Tour for 16–24s) if you miss out, and the full Pro Tour and
majors once you have a card. All players, nicknames and sponsors are fictional.

## Running it

```
npm install
npm run dev          # http://localhost:5173
npm test             # engine, formats, entry rules and career rules
npm run build
```

### iOS and Android

The app is wrapped with [Capacitor](https://capacitorjs.com) (as with Retro Premier Manager),
so the same code ships to both stores. `android/` and `ios/` are native shells around `dist/`.

```
npm run cap:android  # build, sync and open Android Studio
npm run cap:ios      # build, sync and open Xcode (needs a Mac)
```

Two native plugins are included: text-to-speech for the match caller (Android's WebView has no
speech of its own) and keep-awake so the screen stays on while you're at the board.

## The season

The calendar mirrors the real 2026 PDC season (the in-game year replaces 2026), 137 events:

| | |
| --- | --- |
| **Q-School** (Jan) | First Stage 5–7 Jan (best of 9; last 16 each day, plus a points list, reach the Final Stage). Final Stage 8–11 Jan: both finalists each day win a card, the rest go to the top of the Q-School Order of Merit (13 cards at UK Q-School, 16 at European). Fee £475 (+VAT in the UK). Lost-card players and the top 16 on last year's Challenge/Development Tour go straight to the Final Stage. |
| **Challenge Tour** | 24 events over five weekends, best of 9, £20,000 per event. Top 2 win cards, top 3 go to the Worlds, #1 goes to the Grand Slam. |
| **Development Tour** | Ages 16–24 outside the top 64. Same format and rewards. |
| **Players Championships** | 34 events for card holders, best of 11 (final best of 15), £150,000 each. Spare places go to the Q-School reserve list. |
| **European Tour** | 15 events, 48 players: top 16 seeded into round two, next 16 on the Pro Tour Order of Merit, then Tour Card Holder, host-nation and associate qualifiers. £230,000 each. |
| **UK Open** | 160 players with staged entry by ranking, open draws, £750,000. |
| **Majors** | World Masters (sets), World Matchplay (win by two), World Grand Prix (double in, sets), European Championship, Grand Slam (groups of four), Players Championship Finals, World Championship (128 players, sets, deciding-set tie-break, £1m to the winner). |
| **Invitationals** | Premier League (16 nights plus play-offs), World Cup of Darts (pairs), six World Series events and the World Series Finals. Non-ranking. |

Qualification uses prize-money Orders of Merit, as on the real tour: the two-year PDC Order of
Merit, the one-year Pro Tour, Players Championship, European Tour, Challenge Tour, Development
Tour and World Series lists. When a card expires you must be in the top 64 to keep it.

Formats, fields and prize money come from the 2025–26 Wikipedia season and event pages and
pdc.tv. Where a 2026 prize breakdown wasn't published (Grand Slam, Players Championship Finals,
European Championship, Premier League places 5–8), it's marked `ESTIMATE` in
`src/career/data/competitions.js`. Dates for Players Championships 18–34, the last Challenge
Tour weekend, the Development Tour and the Premier League venues are placed where they fell in
previous seasons (marked `~` in `src/career/data/schedule.js`).

## Difficulty

Two modes, switchable any time in Settings:

- **Fixed average**: every opponent throws close to the average you choose.
- **Random, getting harder**: each opponent gets a random average from a band that climbs from
  the first round to the final. Better-ranked players sit higher in the band.

| Level | Early rounds | Semis & final |
| --- | --- | --- |
| Q-School, Challenge & Development Tour | 60–75 | 75–90 |
| Players Championships, European Tour, UK Open | 72–86 | 86–98 |
| Majors & invitationals | 84–95 | 94–105 |
| World Championship | 84–96 | 96–108 |

Real formats are scaled by a match-length setting (Quick ≈ a third, Standard ≈ half, Full),
keeping their special rules. Any match can be auto-simulated.

## Features

- **Inbox**: entry confirmations (one per weekend for tour blocks), Q-School registration,
  Premier League invitations, reserve-list call-ups, draw and qualification news, prize money
  statements, monthly Order of Merit updates and a monthly news round-up with winners and prize money.
- **Calendar**: month grid and list, colour-coded by tour, with your entry status on every event.
  Confirm or withdraw from any event ahead of time.
- **News**: every winner, final score and prize, season earnings leaders, Premier League nights.
- **Money**: bank balance, travel costs, entry fees, prize money and sponsorship. Sponsors make
  offers as you hit milestones (Tour Card, first title, top 64/32/16, TV runs, major titles).
- **Stats**: career average, 180s, checkout %, darts at a double, favourite doubles,
  nine-darters, head-to-head records and rivalries, titles and a season-by-season history.
- **Practice**: friendly 501 at any average (with optional double in), Bob's 27, Round the Clock
  on doubles and the 121 checkout challenge, with personal bests.

## The virtual opponent

Every dart is aimed at a real target (T20, a checkout route, a set-up single) and lands with a
Gaussian scatter on a regulation board (`src/engine/board.js`). The scatter width is calibrated
to 3-dart averages (`scripts/calibrate.js`). Busts, double-in, double-out and checkout choices
come from that. AI-vs-AI results across whole brackets use a fast statistical model fitted to
the dart engine (`src/engine/fastsim.js`, `scripts/fit-fastsim.js`).

## Layout

- `src/engine/`: board, checkouts, the thrower, match rules (sets, win-by-two, double-in, pairs), simulation
- `src/career/data/`: competitions (formats, prizes, rules) and the season schedule
- `src/career/`: players, rankings, entry rules, brackets, difficulty, inbox, finance and the career loop
- `src/components/`: React screens
- `scripts/autocareer.js`: plays N seasons headless (`node scripts/autocareer.js 3 85`)
