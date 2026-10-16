// Mini money games for the child's Learn section. Each game is a handful of
// quick rounds with big tap targets; content is banded by age (see ageMode)
// and amounts use the family's currency.

export const GAMES = [
  { key: "needwant", title: "Need or Want?", blurb: "Tap which one it is.", icon: "Scale" },
  { key: "coins", title: "Make the money", blurb: "Tap coins to make the amount.", icon: "Coins" },
  { key: "jars", title: "Which jar?", blurb: "Save it, spend it or give it?", icon: "PiggyBank" },
  { key: "value", title: "Best deal", blurb: "Spot the better value.", icon: "Tag", bands: ["middle", "big"] },
];

export function gamesFor(mode) {
  return GAMES.filter((g) => !g.bands || g.bands.includes(mode));
}

// Coins per currency, in minor units (pence / cents).
export const COIN_SETS = {
  GBP: [1, 2, 5, 10, 20, 50, 100, 200],
  EUR: [1, 2, 5, 10, 20, 50, 100, 200],
  USD: [1, 5, 10, 25, 100],
  CAD: [5, 10, 25, 100, 200],
  AUD: [5, 10, 20, 50, 100, 200],
  NZD: [10, 20, 50, 100, 200],
};
export function coinsFor(currency, mode) {
  const all = COIN_SETS[currency] || [1, 2, 5, 10, 20, 50, 100];
  if (mode === "little") return all.filter((c) => c <= 20);
  if (mode === "middle") return all.filter((c) => c <= 100);
  return all;
}

/* ---------------- content ---------------- */

const NEED_WANT = {
  little: [
    { label: "Dinner", icon: "Utensils", answer: "need" },
    { label: "A warm coat", icon: "Shirt", answer: "need" },
    { label: "Sweets", icon: "Candy", answer: "want" },
    { label: "A bed", icon: "Bed", answer: "need" },
    { label: "A new toy", icon: "Gamepad2", answer: "want" },
    { label: "Water", icon: "Droplets", answer: "need" },
    { label: "Ice cream", icon: "IceCreamCone", answer: "want" },
    { label: "Shoes", icon: "Footprints", answer: "need" },
    { label: "A balloon", icon: "PartyPopper", answer: "want" },
    { label: "A party hat", icon: "PartyPopper", answer: "want" },
  ],
  middle: [
    { label: "School books", icon: "BookOpen", answer: "need" },
    { label: "Games console", icon: "Gamepad2", answer: "want" },
    { label: "Fruit and veg", icon: "Apple", answer: "need" },
    { label: "Cinema trip", icon: "Clapperboard", answer: "want" },
    { label: "Somewhere to live", icon: "House", answer: "need" },
    { label: "Trainers with lights", icon: "Footprints", answer: "want" },
    { label: "Medicine when ill", icon: "Pill", answer: "need" },
    { label: "Fizzy drinks", icon: "CupSoda", answer: "want" },
    { label: "Bus fare to school", icon: "Bus", answer: "need" },
    { label: "A pet unicorn toy", icon: "Sparkles", answer: "want" },
  ],
  big: [
    { label: "Rent or mortgage", icon: "House", answer: "need" },
    { label: "Newest phone model", icon: "Smartphone", answer: "want" },
    { label: "Electricity bill", icon: "Zap", answer: "need" },
    { label: "Streaming subscription", icon: "Tv", answer: "want" },
    { label: "Weekly food shop", icon: "ShoppingCart", answer: "need" },
    { label: "Designer trainers", icon: "Footprints", answer: "want" },
    { label: "Travel to work", icon: "Bus", answer: "need" },
    { label: "Takeaway on a Friday", icon: "Pizza", answer: "want" },
    { label: "A phone that works", icon: "Smartphone", answer: "need" },
    { label: "Concert tickets", icon: "Music", answer: "want" },
  ],
};

const JARS = {
  little: [
    { text: "Birthday money you want to keep for a big toy", answer: "save" },
    { text: "A comic you want today", answer: "spend" },
    { text: "Helping the animal shelter", answer: "give" },
    { text: "Saving up for a bike", answer: "save" },
    { text: "A present for Grandma", answer: "give" },
    { text: "An ice cream at the park", answer: "spend" },
  ],
  middle: [
    { text: "A new game that comes out in 3 months", answer: "save" },
    { text: "Sponsoring a friend's charity run", answer: "give" },
    { text: "A magazine you want this week", answer: "spend" },
    { text: "Your emergency money for a broken headphone cable", answer: "save" },
    { text: "Lunch out with friends on Saturday", answer: "spend" },
    { text: "Food bank collection at school", answer: "give" },
  ],
  big: [
    { text: "A laptop for secondary school next year", answer: "save" },
    { text: "Monthly donation to a cause you care about", answer: "give" },
    { text: "Cinema tickets this weekend", answer: "spend" },
    { text: "An emergency fund so a surprise doesn't wipe you out", answer: "save" },
    { text: "A birthday present for your best friend", answer: "give" },
    { text: "A bus pass for this month", answer: "spend" },
  ],
};

// Pairs of offers; the better value is the lower price per unit.
const VALUE = [
  { a: { label: "3 pens", pence: 120, units: 3 }, b: { label: "1 pen", pence: 45, units: 1 }, per: "pen" },
  { a: { label: "6 apples", pence: 150, units: 6 }, b: { label: "4 apples", pence: 120, units: 4 }, per: "apple" },
  { a: { label: "500g pasta", pence: 90, units: 1 }, b: { label: "1kg pasta", pence: 160, units: 2 }, per: "500g" },
  { a: { label: "2 cinema tickets", pence: 1500, units: 2 }, b: { label: "1 ticket", pence: 800, units: 1 }, per: "ticket" },
  { a: { label: "10 stickers", pence: 200, units: 10 }, b: { label: "25 stickers", pence: 400, units: 25 }, per: "sticker" },
  { a: { label: "1 month streaming", pence: 799, units: 1 }, b: { label: "12 months streaming", pence: 7990, units: 12 }, per: "month" },
];

function shuffle(list, seed) {
  const a = [...list];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function needWantRounds(mode, seed = Date.now(), count = 6) {
  return shuffle(NEED_WANT[mode] || NEED_WANT.middle, seed).slice(0, count);
}

export function jarRounds(mode, seed = Date.now(), count = 6) {
  return shuffle(JARS[mode] || JARS.middle, seed).slice(0, count);
}

export function valueRounds(seed = Date.now(), count = 5) {
  return shuffle(VALUE, seed).slice(0, count).map((r) => {
    const better = r.a.pence / r.a.units <= r.b.pence / r.b.units ? "a" : "b";
    return { ...r, better, unitA: Math.round(r.a.pence / r.a.units), unitB: Math.round(r.b.pence / r.b.units) };
  });
}

// Targets a child can actually make with the coins they're given.
export function coinRounds(mode, coins, seed = Date.now(), count = 5) {
  const max = mode === "little" ? 30 : mode === "middle" ? 150 : 500;
  const smallest = Math.min(...coins);
  const rounds = [];
  let s = seed;
  while (rounds.length < count) {
    s = (s * 9301 + 49297) % 233280;
    const raw = smallest + Math.floor((s / 233280) * (max - smallest));
    const target = raw - (raw % smallest);
    if (target > 0 && !rounds.includes(target)) rounds.push(target);
  }
  return rounds;
}

// Fewest coins for a target (greedy works for these coin sets).
export function fewestCoins(target, coins) {
  let left = target;
  let n = 0;
  for (const c of [...coins].sort((a, b) => b - a)) {
    n += Math.floor(left / c);
    left %= c;
  }
  return left === 0 ? n : Infinity;
}

// One game a day, rotating through the games this age can play.
export function dailyGame(mode, seed = "", date = new Date()) {
  const list = gamesFor(mode);
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const dayNumber = Math.floor(date.getTime() / 86400000) + h;
  return list[dayNumber % list.length];
}
