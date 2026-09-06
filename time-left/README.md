# Time Left

Put in your date of birth and where you live. Time Left works out how long the
averages say you have, and counts it down — years, days, hours, minutes,
seconds — along with the summers, winters, weekends and full moons that come
with it.

It runs entirely in the browser. Nothing is sent anywhere; your date of birth is
kept in `localStorage` on your own device and nowhere else.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the maths, in node --test
npm run build
```

## What it works out

Say you are 46 years, 2 months and 5 days old and you live in the UK, where life
expectancy at birth is about 81.4 years. The clock counts down the 35.2 years
between the two, landing on a specific date, and everything else is counted
between now and that date:

| Group | Counted |
| --- | --- |
| Seasons | Summers, winters, springs, autumns — a season you are in the middle of still counts |
| The week | Weekends, Friday nights, Monday mornings, weeks |
| Dates | Birthdays, New Year Eves, 25 Decembers, leap days |
| Overhead | Sunrises, full moons, Summer Olympics, World Cups |
| Rough rates | Heartbeats, breaths, meals, nights of sleep, hot drinks, books |
| The span | Days, months, hours asleep, hours awake |

Plus a life-in-weeks grid (one box a week, 52 to a row), a list of things still
to come marked by whether the estimate has you there for them — your 80th
birthday, the year 2050, Halley's Comet in 2061 — and the same counting run
backwards over the years already behind you.

Seasons follow the hemisphere of the place you pick, so an Australian gets their
summers in December.

## Two ways of working it out

**Straight subtraction** is life expectancy at birth minus your age. It is what
most people mean, and it is what the app does by default.

It is also, for anyone over about 60, pessimistic. An average at birth includes
everybody who died young, and you did not. So there is a second mode,
**adjusted for having got this far**, which builds a crude life table from the
same single number and asks a different question: of the people still alive at
your age, how much longer do they last?

The table splits deaths into a lump of child mortality — sized from how low the
region's life expectancy is — and a Gompertz curve for everyone who makes it
past five, then solves for the level of that curve until the whole table
reproduces the life expectancy it started from. It is a caricature of a real
life table, and for countries where the average is dragged down mostly by child
mortality it is still too gloomy about adults. But it knows the thing that
matters here: reaching 46 is itself information.

For a UK figure of 81.4 years, straight subtraction gives a 46-year-old 35.2
years; the adjusted table gives 36.7, and puts the expected age at death at 82.9.
When the two disagree by more than a couple of years, the app says so under the
clock and offers to switch.

## Life factors

An optional panel of seven questions — smoking, exercise, diet, alcohol, weight,
sleep, and how connected you are to other people — each worth a few years either
way, drawn from the broad findings of long-running cohort studies. The total is
capped at 12 years in either direction, because a questionnaire cannot know that
much. They are averages over large groups, they overlap heavily with each other,
and none of them knows anything about you.

## Where the numbers come from

`src/data/lifeExpectancy.js` holds 254 places: countries, the four UK nations,
and the US states and DC. Country figures are approximate 2024 estimates in the
spirit of the UN World Population Prospects; UK nations come from ONS national
life tables (2020–2022); US states from CDC/NCHS. Male and female figures are
listed separately where they are published, and derived from the national gap
where they are not — the US states, mainly. Every figure is rounded and a couple
of years behind reality, and for smaller countries some are best-effort. If none
of them fits, "Set the number myself" takes any figure between 20 and 110.

## Layout

```
src/
  data/lifeExpectancy.js   the table of places and figures
  lib/dates.js             calendar arithmetic: exact ages, anniversaries, weekdays
  lib/lifespan.js          the two models, the life table, the life factors
  lib/counters.js          seasons, weekends, moons, milestones
  lib/format.js            the countdown split, and how numbers read
  lib/settings.js          form values in, validated inputs out, storage
  components/              the panels, each a thin layer over lib/
tests/                     51 tests, all of it on lib/ and the data
```

The clock re-renders ten times a second, so only the countdown itself depends on
the current instant. Anything counted in days or longer is memoised against the
date, which means the life table is solved once a day rather than ten times a
second.

## One caveat, which is the whole point

This is an average, not a prophecy. Life expectancy describes what happened to a
whole population, and half of that population lived longer than the number.
Nothing here knows anything about your health, and none of it is medical advice.
