// Competition formats, prize money and entry rules, taken from the real 2026 PDC season.
// Legs and sets are "first to" numbers at full length; the match-length setting scales them.
// Prize arrays run from the winner down: [winner, runner-up, semi, quarter, last 16, last 32, ...].
//
// Sources: Wikipedia season/event pages for 2025–26 and pdc.tv. Where a 2026 breakdown
// had not been published it is marked ESTIMATE and scaled from the 2025 figures.

export const COMPETITIONS = {
  qsFirst: {
    name: 'Q-School First Stage', kind: 'qschool', stage: 'first', tier: 0, level: 'dev', size: 256,
    legs: Array(8).fill(5), prizes: [], cats: [],
    blurb: 'Best of 9 legs. The last 16 each day go through to the Final Stage; more places come from the points list (a point per win) after day three.',
  },
  qsFinal: {
    name: 'Q-School Final Stage', kind: 'qschool', stage: 'final', tier: 0, level: 'dev', size: 128,
    legs: Array(7).fill(5), prizes: [], cats: [],
    blurb: 'Best of 9 legs. Both finalists each day win a two-year Tour Card; the rest go to the top of the Q-School Order of Merit.',
  },
  ct: {
    name: 'Challenge Tour', kind: 'knockout', tier: 0, level: 'dev', size: 256, legs: Array(8).fill(5),
    prizes: [3000, 2000, 1000, 750, 350, 250, 100], cats: ['ct'], entry: 'challenge',
    blurb: 'Best of 9 legs, open to Q-School entrants without a Tour Card. Top 2 on the Order of Merit win Tour Cards, top 3 go to the Worlds, #1 goes to the Grand Slam.',
  },
  dt: {
    name: 'Development Tour', kind: 'knockout', tier: 0, level: 'dev', size: 256, legs: Array(8).fill(5),
    prizes: [3000, 2000, 1000, 750, 350, 250, 100], cats: ['dt'], entry: 'development',
    blurb: 'Best of 9 legs for players aged 16–24 outside the top 64. Top 2 win Tour Cards, top 3 go to the Worlds, #1 goes to the Grand Slam.',
  },
  pc: {
    name: 'Players Championship', kind: 'knockout', tier: 1, level: 'pro', size: 128, legs: [6, 6, 6, 6, 6, 6, 8],
    prizes: [15000, 10000, 6500, 4000, 3000, 2000, 1250, 0], cats: ['ranked', 'pt', 'pc'], entry: 'tour',
    blurb: 'Best of 11 legs, best of 15 in the final. Tour Card holders, with spares filled from the Q-School reserve list.',
  },
  et: {
    name: 'European Tour', kind: 'knockout', tier: 2, level: 'pro', size: 64, seeded: true, legs: [6, 6, 6, 6, 7, 8],
    prizes: [35000, 15000, 10000, 8000, 5000, 3500, 2000], cats: ['ranked', 'pt', 'et'], entry: 'euroTour',
    blurb: '48 players. Top 16 on the Order of Merit are seeded into round two; the next 16 on the Pro Tour Order of Merit, 10 Tour Card Holder Qualifiers, 4 host-nation and 2 associate qualifiers start in round one.',
  },
  ukopen: {
    name: 'UK Open', kind: 'staged', tier: 3, level: 'pro', size: 160, legs: [6, 6, 6, 10, 10, 10, 10, 11, 11],
    prizes: [120000, 60000, 35000, 20000, 12500, 7500, 3000, 2000, 1250, 0], cats: ['ranked'], entry: 'ukOpen',
    blurb: "The FA Cup of darts: 160 players, random draws every round. Card holders ranked 97–128 start in round one with 16 Challenge/Development Tour qualifiers and 16 Riley's amateur qualifiers; 65–96 join in round two, 33–64 in round three, the top 32 in round four.",
  },
  masters: {
    name: 'World Masters', kind: 'knockout', tier: 3, level: 'major', size: 32, seeded: true, sets: [3, 4, 4, 5, 6], setLegs: 3,
    prizes: [100000, 50000, 30000, 17500, 10000, 5000], cats: ['ranked'], entry: 'masters',
    blurb: 'Set play. Top 24 on the Order of Merit plus 8 through a preliminary round (players ranked 25–40).',
  },
  matchplay: {
    name: 'World Matchplay', kind: 'knockout', tier: 3, level: 'major', size: 32, seeded: true, legs: [10, 11, 16, 17, 18], winBy2: true,
    prizes: [225000, 125000, 65000, 35000, 22500, 12500], cats: ['ranked'], entry: 'top16plusPT',
    blurb: 'Top 16 on the Order of Merit (seeded) plus the top 16 on the Pro Tour Order of Merit. Every match must be won by two clear legs, with sudden death two legs past the target.',
  },
  grandprix: {
    name: 'World Grand Prix', kind: 'knockout', tier: 3, level: 'major', size: 32, seeded: true, sets: [2, 3, 3, 5, 6], setLegs: 3, doubleIn: true,
    prizes: [150000, 80000, 50000, 35000, 20000, 7500], cats: ['ranked'], entry: 'top16plusPT',
    blurb: 'Double in, double out, in sets (each best of 5 legs). Top 16 on the Order of Merit plus the top 16 on the Pro Tour Order of Merit.',
  },
  eurochamp: {
    name: 'European Championship', kind: 'knockout', tier: 3, level: 'major', size: 32, seeded: true, legs: [6, 10, 10, 11, 11],
    // ESTIMATE: 2026 fund is £750,000 (breakdown assumed to match the World Grand Prix, as it did in 2025).
    prizes: [150000, 80000, 50000, 35000, 20000, 7500], cats: ['ranked'], entry: 'euroChamp',
    blurb: 'Top 32 on the European Tour Order of Merit.',
  },
  grandslam: {
    name: 'Grand Slam of Darts', kind: 'groups', groupSize: 4, groups: 8, advance: 2, tier: 3, level: 'major', size: 32,
    groupLegs: 5, legs: [10, 16, 16, 16],
    // ESTIMATE: 2026 fund is £1,000,000; scaled from the 2025 breakdown.
    prizes: [225000, 105000, 75000, 37500, 18500], groupPrizes: { third: 12000, fourth: 7500, winnerBonus: 5000 },
    cats: ['ranked'], entry: 'grandSlam',
    blurb: 'Eight groups of four (best of 9 legs), top two go through. TV finalists, affiliate tour winners and European Tour/Players Championship winners qualify, with the last 8 places from a Tour Card Holder Qualifier.',
  },
  pcfinals: {
    name: 'Players Championship Finals', kind: 'knockout', tier: 3, level: 'major', size: 64, seeded: true, legs: [6, 6, 10, 10, 11, 11],
    // ESTIMATE: 2026 fund is £750,000; scaled from the 2025 breakdown.
    prizes: [150000, 75000, 37500, 25000, 12500, 8500, 4000], cats: ['ranked'], entry: 'pcFinals',
    blurb: 'Top 64 on the Players Championship Order of Merit (this season’s 34 events).',
  },
  worlds: {
    name: 'World Championship', kind: 'knockout', tier: 4, level: 'worlds', size: 128, seeded: true, sets: [3, 3, 4, 4, 5, 6, 7], setLegs: 3, setTiebreak: true,
    prizes: [1000000, 400000, 200000, 100000, 60000, 35000, 25000, 15000], cats: ['ranked'], entry: 'worlds',
    blurb: '128 players, all from round one. Top 40 on the Order of Merit, top 40 on the Pro Tour Order of Merit, and 48 qualifiers (including the top 3 on the Challenge and Development Tours). Deciding sets must be won by two legs.',
  },
  premier: {
    name: 'Premier League Night', kind: 'plNight', tier: 3, level: 'major', size: 8, legs: [6, 6, 6],
    prizes: [], nightBonus: 10000, cats: [], entry: 'premier',
    blurb: 'Eight invited players, a knockout every Thursday. 5 points for the night winner, 3 for the runner-up, 2 for semi-finalists. Non-ranking.',
  },
  plPlayoffs: {
    name: 'Premier League Play-Offs', kind: 'plPlayoffs', tier: 3, level: 'major', size: 4, legs: [10, 11],
    // Positions 5–8 are ESTIMATES.
    prizes: [350000, 170000, 110000, 110000, 90000, 85000, 80000, 75000], cats: [], entry: 'premier',
    blurb: 'Top four after 16 nights: 1st v 4th and 2nd v 3rd (best of 19), final best of 21.',
  },
  worldcup: {
    name: 'World Cup of Darts', kind: 'worldcup', tier: 3, level: 'major', size: 40, pairs: true, groupLegs: 4, legs: [8, 8, 8, 10],
    prizes: [100000, 48000, 30000, 20000, 9000], groupPrizes: { second: 5000, third: 4000 }, cats: [], entry: 'worldCup',
    blurb: '40 nations, two players each (best combined ranking), playing pairs. Seeds 1–4 go straight to round two; the rest play 12 groups of three (best of 7), winners go through. Prize money is per team. Non-ranking.',
  },
  ws: {
    name: 'World Series', kind: 'knockout', tier: 2, level: 'major', size: 16, seeded: true, legs: [6, 6, 7, 8],
    prizes: [30000, 16000, 10000, 5000, 1750], cats: ['ws'], entry: 'worldSeries',
    blurb: 'Invitational: eight PDC stars against eight local qualifiers. Non-ranking; counts towards the World Series Order of Merit.',
  },
  wsfinals: {
    name: 'World Series Finals', kind: 'knockout', tier: 3, level: 'major', size: 32, seeded: true, legs: [6, 6, 6, 10, 11],
    prizes: [80000, 40000, 25000, 17500, 10000, 5000], cats: [], entry: 'wsFinals',
    blurb: 'Top 8 on the World Series Order of Merit (seeded, bye to round two) and 16 more from the Order of Merit. Non-ranking.',
  },
  women: {
    name: "Women's Series", kind: 'knockout', tier: 0, level: 'dev', size: 64, legs: Array(6).fill(5),
    prizes: [2500, 1000, 750, 500, 300, 200, 75], cats: ['wo'], entry: 'women',
    blurb: "Best of 9 legs for female players outside the top 64. Top 3 on the Order of Merit go to the World Championship, #1 goes to the Grand Slam, the top 8 get free Q-School entry and qualify for the Women's World Matchplay.",
  },
  womensMatchplay: {
    name: "Women's World Matchplay", kind: 'knockout', tier: 3, level: 'major', size: 8, seeded: true, legs: [4, 5, 6],
    prizes: [10000, 5000, 2500, 1250], cats: [], entry: 'womensMatchplay',
    blurb: "The top 8 on the Women's Series Order of Merit at the Winter Gardens during World Matchplay week. The winner qualifies for the Grand Slam and the World Championship.",
  },
  // Seniors: not a PDC tour. Modelled on the last World Seniors Darts Tour events (the 2026
  // World Seniors Championship was cancelled). Open to players aged 45+ without a Tour Card.
  seniorsWorlds: {
    name: 'World Seniors Championship', kind: 'knockout', tier: 3, level: 'pro', size: 32, seeded: true, sets: [3, 3, 4, 4, 5], setLegs: 3,
    prizes: [30000, 12500, 4000, 2000, 1000, 500], cats: ['sn'], entry: 'seniors', seniorsField: 28,
    blurb: 'Seniors Tour (not PDC): 28 players aged 45+ without a Tour Card, four seeds straight into round two. Set play, final first to 5 sets.',
  },
  seniorsMasters: {
    name: 'World Seniors Masters', kind: 'knockout', tier: 3, level: 'pro', size: 16, seeded: true, sets: [4, 4, 5, 6], setLegs: 2,
    prizes: [10000, 5000, 2500, 1250, 750], cats: ['sn'], entry: 'seniors',
    blurb: 'Seniors Tour (not PDC): 16 players, sets of first to 2 legs.',
  },
  seniorsMatchplay: {
    name: 'World Seniors Matchplay', kind: 'knockout', tier: 3, level: 'pro', size: 16, seeded: true, legs: [8, 8, 9, 9],
    prizes: [10000, 5000, 2500, 1250, 750], cats: ['sn'], entry: 'seniors',
    blurb: 'Seniors Tour (not PDC): 16 players, best of 15 legs, semi-finals and final best of 17.',
  },
}

// Nine-dart bonuses (paid on top of prize money when you hit one on your board).
export const NINE_DART_BONUS = { 4: 60000, 3: 25000, 2: 10000, 1: 5000, 0: 2500 }
export const BIG_FISH_BONUS = 1000 // a 170 checkout (game feature, not a real PDC prize)

// Everything that counts as a televised final for Grand Slam qualification.
export const TV_EVENTS = ['worlds', 'plPlayoffs', 'matchplay', 'grandprix', 'masters', 'ukopen', 'eurochamp', 'pcfinals', 'wsfinals']

export const QSCHOOL_FEE = { UK: 570, EU: 475 } // £475 + VAT in the UK, £475 in Kalkar
export const QSCHOOL_CARDS = { UK: 13, EU: 16 }
