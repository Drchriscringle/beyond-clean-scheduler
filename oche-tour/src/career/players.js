// Fictional player pool. Every name is invented, generated from mixed nationalities
// so the field reads like a real tour without borrowing anyone's identity.
import { gaussian, pick } from '../engine/rng.js'

const NAMES = {
  ENG: {
    first: ['Danny', 'Lee', 'Ricky', 'Wayne', 'Carl', 'Jamie', 'Kieran', 'Scott', 'Callum', 'Ryan', 'Mark', 'Dean', 'Stuart', 'Luke', 'Joe', 'Nathan', 'Craig', 'Jordan', 'Tommy', 'Adam', 'Ross', 'Matt', 'Liam', 'Gary'],
    last: ['Ashworth', 'Braddock', 'Pennington', 'Hollis', 'Garside', 'Whitlock', 'Ormerod', 'Tunstall', 'Kettle', 'Birchall', 'Rawcliffe', 'Heap', 'Dunmore', 'Fairclough', 'Lomax', 'Sutcliffe', 'Cropper', 'Mellor', 'Haworth', 'Blakeley', 'Stanworth', 'Pickup', 'Grindrod', 'Entwistle'],
  },
  SCO: {
    first: ['Alan', 'Graeme', 'Euan', 'Fraser', 'Iain', 'Duncan', 'Kyle', 'Rory', 'Hamish', 'Craig'],
    last: ['McKellar', 'Drummond', 'Baird', 'Lennox', 'Rennie', 'McAuley', 'Guthrie', 'Imrie', 'Kinnear', 'Strachan'],
  },
  WAL: {
    first: ['Gareth', 'Rhys', 'Dai', 'Owain', 'Aled', 'Huw', 'Emyr', 'Gethin'],
    last: ['Pritchard', 'Bevan', 'Prosser', 'Gwilym', 'Jenkins-Lloyd', 'Rowlands', 'Probert', 'Meredith'],
  },
  IRL: {
    first: ['Declan', 'Ciaran', 'Padraig', 'Eoin', 'Niall', 'Shane', 'Cathal', 'Fergal'],
    last: ['Mulcahy', 'Brennan', 'Tierney', 'Keogh', 'Hanrahan', 'Duggan', 'Moloney', 'Cregan'],
  },
  NED: {
    first: ['Jeroen', 'Niels', 'Bram', 'Sander', 'Ruud', 'Dirk', 'Wessel', 'Joost', 'Thijs', 'Maarten'],
    last: ['van Holst', 'de Brink', 'Verkade', 'van Dalen', 'Oosterhout', 'Kuipers', 'van Wijk', 'Bosveld', 'Hoogeboom', 'Zijlstra'],
  },
  BEL: {
    first: ['Kenny', 'Pieter', 'Joeri', 'Wim', 'Stijn'],
    last: ['Vermeulen', 'De Clercq', 'Van Acker', 'Wouters', 'Goossens'],
  },
  GER: {
    first: ['Lukas', 'Florian', 'Tobias', 'Dennis', 'Kevin', 'Stefan', 'Jannik'],
    last: ['Brandtner', 'Hüttemann', 'Kessler', 'Wollny', 'Reinhold', 'Stöckl', 'Lindemann'],
  },
  AUS: {
    first: ['Brody', 'Mitch', 'Shane', 'Corey', 'Damon'],
    last: ['Whitfield', 'Callister', 'Harrow', 'Kingsley', 'Dalgety'],
  },
  POL: { first: ['Krzysztof', 'Tomasz', 'Marek'], last: ['Zawadzki', 'Kowalczyk', 'Wrona'] },
  POR: { first: ['Tiago', 'Rui', 'Nuno'], last: ['Figueira', 'Casimiro', 'Barreto'] },
  USA: { first: ['Tyler', 'Brandon', 'Chase'], last: ['Maddox', 'Holloway', 'Crenshaw'] },
  JPN: { first: ['Haruto', 'Kenji', 'Daiki'], last: ['Morikawa', 'Tanabe', 'Ishida'] },
}

const NATION_WEIGHTS = [
  ['ENG', 42], ['NED', 12], ['SCO', 7], ['WAL', 6], ['IRL', 6], ['GER', 6], ['BEL', 5],
  ['AUS', 4], ['POL', 3], ['POR', 3], ['USA', 3], ['JPN', 3],
]

const NICK_A = ['The', 'The', 'The', 'Big', 'Mighty', 'Silent', 'Flying', 'Iron', 'Golden', 'Rapid', 'Steel', 'Wild']
const NICK_B = ['Hammer', 'Viking', 'Machine', 'Bullet', 'Falcon', 'Rocket', 'Wizard', 'Bronco', 'Cobra', 'Bear', 'Magician', 'Thunder', 'Assassin', 'Diamond', 'Shark', 'Terrier', 'Jackal', 'Stallion', 'Dragon', 'Menace', 'Gladiator', 'Hurricane', 'Maverick', 'Tornado', 'Phoenix', 'Warrior']

function pickNation(rng) {
  const total = NATION_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [code, w] of NATION_WEIGHTS) {
    if ((r -= w) < 0) return code
  }
  return 'ENG'
}

export function generatePlayer(id, rating, tour, rng = Math.random, used = new Set()) {
  let name
  let nation
  for (let tries = 0; tries < 50; tries++) {
    nation = pickNation(rng)
    name = `${pick(NAMES[nation].first, rng)} ${pick(NAMES[nation].last, rng)}`
    if (!used.has(name)) break
  }
  used.add(name)
  const nickname = `${pick(NICK_A, rng)} ${pick(NICK_B, rng)}`.replace(/^The The/, 'The')
  return { id, name, nickname, nation, rating: Math.round(rating * 10) / 10, tour, money: {}, ctMoney: {}, titles: [] }
}

export const TOUR_CARD_POOL = 128
export const CHALLENGE_POOL = 176

// Ratings are "pro-scale" 3-dart averages. The difficulty setting rescales them
// onto the human's own standard at match time (see difficulty.js).
export function generatePools(startYear, rng = Math.random) {
  const used = new Set()
  const players = {}
  for (let i = 0; i < TOUR_CARD_POOL; i++) {
    const rating = 101 - i * 0.16 + gaussian(rng) * 1.8
    const p = generatePlayer(`p${i}`, rating, 'pro', rng, used)
    // Seed last season's prize money so the two-year Order of Merit starts populated.
    p.money[startYear - 1] = Math.round((420000 * Math.exp(-i / 14) + 45000 * Math.exp(-i / 70) + 4000) / 250) * 250
    players[p.id] = p
  }
  for (let i = 0; i < CHALLENGE_POOL; i++) {
    const rating = 83 - i * 0.12 + gaussian(rng) * 2.2
    const p = generatePlayer(`c${i}`, rating, 'challenge', rng, used)
    players[p.id] = p
  }
  return players
}

export const NATION_FLAGS = {
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', IRL: '🇮🇪', NED: '🇳🇱', BEL: '🇧🇪', GER: '🇩🇪',
  AUS: '🇦🇺', POL: '🇵🇱', POR: '🇵🇹', USA: '🇺🇸', JPN: '🇯🇵',
}
