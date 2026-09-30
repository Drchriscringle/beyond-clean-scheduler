# Oche Tour

A darts career game you play with **real darts on your own board**. You throw your
visit, type in the score, and a virtual opponent throws theirs. The career follows the
shape of the professional tour: Q-School in January for a Tour Card, the Challenge Tour
if you miss out, then Players Championships, European Tour events, majors and the World
Championship, with a two-year Order of Merit deciding whether you keep your card.

All players, nicknames and event branding are fictional.

## Running it

```
npm install
npm run dev      # http://localhost:5173
npm test         # engine + career rules
npm run build
```

Best on a phone or tablet propped up next to the board. Progress autosaves in the browser,
including a match in progress.

## How the season works

| When | What |
| --- | --- |
| January | **Q-School**, four one-day knockouts (128 players). Reach a day's final, or finish top 4 on the Q-School Order of Merit, for a two-year Tour Card. |
| Feb–Oct | **Challenge Tour** (18 events) if you have no card. Top 2 on its Order of Merit earn a card and a World Championship place. |
| Feb–Nov | **Pro Tour** with a card: 14 Players Championships, The Open, 3 European Tour events (top 32 seeded, everyone else through a qualifier). |
| Jul–Dec | **Majors** by Order of Merit: World Matchplay, World Grand Prix (sets), Grand Slam, Players Championship Finals, World Championship (sets). |
| Season end | Card holders whose card expires must be inside the **top 64** on the two-year Order of Merit, or it's back to Q-School. |

Events you're not in are simulated, so the rankings move all year.

## The virtual opponent

- Every dart is aimed at a real target (T20, a checkout route, a set-up single) and lands
  with a Gaussian scatter on a regulation board (`src/engine/board.js`). How wide the
  scatter is sets their standard, calibrated against 3-dart averages
  (`scripts/calibrate.js`). Busts, double-out and checkout choices emerge from that.
- **Difficulty is relative to you.** You set your own average, and it updates as you play.
  Opponents' tour ratings are scaled to it, so on Normal a Challenge Tour grinder is usually
  a bit weaker than you, a mid-ranked pro is about level and the elite are better. *Real
  averages* turns the scaling off.
- **It gets harder as you go.** Every opponent has a random form swing, and they get sharper
  each round and in bigger events (`src/career/difficulty.js`). Stronger players also
  survive the bracket, so later rounds are naturally tougher.

## Match length

Real tour formats (first to 6 legs, first to 18 in the Matchplay final, sets at the
Worlds) are scaled by a setting: **Quick** (about a third), **Standard** (about half) or
**Full**. Any match can also be auto-simulated.

## Layout

- `src/engine/`: board geometry, checkout routes, the thrower, match rules and fast simulation
- `src/career/`: players, calendar, brackets, difficulty and career progression
- `src/components/`: React screens
- `scripts/autocareer.js`: plays N seasons headless (`node scripts/autocareer.js 5 normal`) to check balance
