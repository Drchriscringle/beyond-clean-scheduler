// Fictional player pool. Names are invented from per-nation name banks so the field
// reads like a real tour without borrowing anyone's identity.
import { gaussian, pick } from '../engine/rng.js'

// code: [display name, flag, first names, surnames, weight in the pool]
export const NATIONS = {
  ENG: ['England', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Danny Lee Ricky Wayne Carl Jamie Kieran Scott Callum Ryan Mark Dean Stuart Luke Joe Nathan Craig Jordan Tommy Adam Ross Matt Liam Gary', 'Ashworth Braddock Pennington Hollis Garside Whitlock Ormerod Tunstall Kettle Birchall Rawcliffe Heap Dunmore Fairclough Lomax Sutcliffe Cropper Mellor Haworth Blakeley Stanworth Pickup Grindrod Entwistle', 34],
  SCO: ['Scotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Alan Graeme Euan Fraser Iain Duncan Kyle Rory Hamish Craig', 'McKellar Drummond Baird Lennox Rennie McAuley Guthrie Imrie Kinnear Strachan', 6],
  WAL: ['Wales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Gareth Rhys Dai Owain Aled Huw Emyr Gethin', 'Pritchard Bevan Prosser Gwilym Rowlands Probert Meredith Llewellyn', 5],
  NIR: ['Northern Ireland', '🇬🇧', 'Brendan Conor Gavin Mervyn Stephen Darren', 'McCartan Fegan Magill Crossey Quinlan Devlin', 4],
  IRL: ['Ireland', '🇮🇪', 'Declan Ciaran Padraig Eoin Niall Shane Cathal Fergal', 'Mulcahy Brennan Tierney Keogh Hanrahan Duggan Moloney Cregan', 5],
  NED: ['Netherlands', '🇳🇱', 'Jeroen Niels Bram Sander Ruud Dirk Wessel Joost Thijs Maarten', 'van_Holst de_Brink Verkade van_Dalen Oosterhout Kuipers van_Wijk Bosveld Hoogeboom Zijlstra', 12],
  BEL: ['Belgium', '🇧🇪', 'Kenny Pieter Joeri Wim Stijn Bart', 'Vermeulen De_Clercq Van_Acker Wouters Goossens Peeters', 5],
  GER: ['Germany', '🇩🇪', 'Lukas Florian Tobias Dennis Kevin Stefan Jannik Marvin', 'Brandtner Hüttemann Kessler Wollny Reinhold Stöckl Lindemann Kranz', 8],
  AUT: ['Austria', '🇦🇹', 'Mario Christoph Dominik Rene', 'Pichler Gruber Haselböck Steinwender', 3],
  SUI: ['Switzerland', '🇨🇭', 'Reto Beat Luca Silvan', 'Ammann Brunner Kälin Zürcher', 2],
  POL: ['Poland', '🇵🇱', 'Krzysztof Tomasz Marek Sebastian', 'Zawadzki Kowalczyk Wrona Sadowski', 3],
  CZE: ['Czechia', '🇨🇿', 'Karel Ondřej Jakub Petr', 'Novotný Dvořák Hájek Kučera', 2],
  SVK: ['Slovakia', '🇸🇰', 'Martin Lukáš Tomáš', 'Horváth Kováč Baláž', 2],
  HUN: ['Hungary', '🇭🇺', 'Gábor Norbert Zoltán Ádám', 'Szabó Farkas Nagy Varga', 2],
  LAT: ['Latvia', '🇱🇻', 'Jānis Mārtiņš Edgars', 'Bērziņš Kalniņš Ozols', 2],
  LTU: ['Lithuania', '🇱🇹', 'Darius Tomas Mindaugas', 'Kazlauskas Petrauskas Jankauskas', 2],
  SWE: ['Sweden', '🇸🇪', 'Johan Oskar Viktor Magnus', 'Lindqvist Björk Sandberg Engström', 3],
  DEN: ['Denmark', '🇩🇰', 'Mads Rasmus Jesper Nikolaj', 'Kjær Holm Lund Thorsen', 3],
  NOR: ['Norway', '🇳🇴', 'Eirik Henrik Sindre', 'Haugen Solberg Aasen', 2],
  FIN: ['Finland', '🇫🇮', 'Mikko Janne Teemu', 'Virtanen Mäkelä Salonen', 2],
  ESP: ['Spain', '🇪🇸', 'Javier Carlos Adrián Sergio', 'Moreno Castillo Navarro Herrero', 3],
  POR: ['Portugal', '🇵🇹', 'Tiago Rui Nuno Bruno', 'Figueira Casimiro Barreto Lacerda', 3],
  ITA: ['Italy', '🇮🇹', 'Marco Stefano Davide Luca', 'Bellini Ferraro Gallo Marchetti', 2],
  FRA: ['France', '🇫🇷', 'Julien Thomas Nicolas Hugo', 'Lefèvre Moreau Girard Roux', 2],
  CRO: ['Croatia', '🇭🇷', 'Ivan Marko Luka', 'Horvat Kovačević Babić', 2],
  GIB: ['Gibraltar', '🇬🇮', 'Dylan Craig Justin', 'Pisarello Bautista Ferrary', 2],
  AUS: ['Australia', '🇦🇺', 'Brody Mitch Shane Corey Damon', 'Whitfield Callister Harrow Kingsley Dalgety', 4],
  NZL: ['New Zealand', '🇳🇿', 'Haydn Ben Warren', 'Tipene Crawford Mahuika', 2],
  CAN: ['Canada', '🇨🇦', 'Jeff Dawson Kyle', 'Tremblay Macintyre Gagnon', 2],
  USA: ['USA', '🇺🇸', 'Tyler Brandon Chase Danny', 'Maddox Holloway Crenshaw Baggett', 3],
  JPN: ['Japan', '🇯🇵', 'Haruto Kenji Daiki Ryusei', 'Morikawa Tanabe Ishida Asano', 3],
  PHI: ['Philippines', '🇵🇭', 'Paolo Christian Lourence', 'Ilagan Perez Dizon', 2],
  HKG: ['Hong Kong', '🇭🇰', 'Man Lok Kai Wah Chi Ho', 'Leung Chan Tsang', 2],
  CHN: ['China', '🇨🇳', 'Xiaochen Lihao Yuanjun', 'Zong Liu Wang', 2],
  RSA: ['South Africa', '🇿🇦', 'Devon Cameron Wessel', 'Petersen van_Rooyen Botha', 2],
  BRA: ['Brazil', '🇧🇷', 'Diogo Rafael Thiago', 'Portela Costa Almeida', 2],
  IND: ['India', '🇮🇳', 'Nitin Ashok Vikram', 'Kumar Sharma Nair', 2],
  BHR: ['Bahrain', '🇧🇭', 'Abdulla Hasan Ali', 'Saeed Al_Mahroos Jaffar', 2],
  SGP: ['Singapore', '🇸🇬', 'Paul Harith Jun', 'Lim Tan Ng', 2],
  ISL: ['Iceland', '🇮🇸', 'Pétur Hallgrímur Vitor', 'Guðmundsson Egilsson Stefánsson', 2],
}

export const NATION_CODES = Object.keys(NATIONS)
export const UK_QSCHOOL_NATIONS = ['ENG', 'SCO', 'WAL', 'NIR', 'IRL']

export function flag(nation) {
  return NATIONS[nation]?.[1] ?? '🎯'
}

export function nationName(nation) {
  return NATIONS[nation]?.[0] ?? nation
}

const words = (s) => s.split(' ').map((w) => w.replace(/_/g, ' '))

const NICK_A = ['The', 'The', 'The', 'Big', 'Mighty', 'Silent', 'Flying', 'Iron', 'Golden', 'Rapid', 'Steel', 'Wild', 'Little', 'Cool']
const NICK_B = ['Hammer', 'Viking', 'Machine', 'Bullet', 'Falcon', 'Rocket', 'Wizard', 'Bronco', 'Cobra', 'Bear', 'Magician', 'Thunder', 'Assassin', 'Diamond', 'Shark', 'Terrier', 'Jackal', 'Stallion', 'Dragon', 'Menace', 'Gladiator', 'Hurricane', 'Maverick', 'Tornado', 'Phoenix', 'Warrior', 'Sniper', 'Professor', 'Tank', 'Iceman']

function pickNation(rng) {
  const entries = Object.entries(NATIONS)
  const total = entries.reduce((s, [, n]) => s + n[4], 0)
  let r = rng() * total
  for (const [code, n] of entries) if ((r -= n[4]) < 0) return code
  return 'ENG'
}

export function generatePlayer(id, { rating, tour, age, nation }, rng = Math.random, used = new Set()) {
  let name
  const code = nation ?? pickNation(rng)
  const [, , firsts, lasts] = NATIONS[code]
  for (let tries = 0; tries < 40; tries++) {
    name = `${pick(words(firsts), rng)} ${pick(words(lasts), rng)}`
    if (!used.has(name)) break
  }
  used.add(name)
  const nickname = `${pick(NICK_A, rng)} ${pick(NICK_B, rng)}`
  return { id, name, nickname, nation: code, age, rating: Math.round(rating * 10) / 10, tour, cardExpiry: null, earn: {}, titles: [] }
}

export const TOUR_CARDS = 128
export const NON_CARD_POOL = 380

function randomAge(rng, youngShare) {
  if (rng() < youngShare) return 17 + Math.floor(rng() * 8) // 17–24
  return 25 + Math.floor(Math.abs(gaussian(rng)) * 12)
}

// Ratings are 3-dart averages the player throws on a normal day.
export function generatePools(startYear, rng = Math.random) {
  const used = new Set()
  const players = {}
  for (let i = 0; i < TOUR_CARDS; i++) {
    const p = generatePlayer(`p${i}`, { rating: 101 - i * 0.17 + gaussian(rng) * 1.8, tour: 'pro', age: randomAge(rng, 0.12) }, rng, used)
    // Two-year cards, so roughly half of the field is up for renewal each season.
    p.cardExpiry = rng() < 0.5 ? startYear : startYear + 1
    // Last season's ranked prize money, so the two-year Order of Merit starts populated.
    p.earn[startYear - 1] = { ranked: Math.round((1400000 * Math.exp(-i / 9) + 180000 * Math.exp(-i / 40) + 25000) / 250) * 250 }
    players[p.id] = p
  }
  // Make sure every nation has at least two players for the World Cup.
  let n = 0
  for (const code of NATION_CODES) {
    for (let k = 0; k < 2; k++) {
      const p = generatePlayer(`c${n}`, { rating: 64 + gaussian(rng) * 5, tour: 'challenge', age: randomAge(rng, 0.3), nation: code }, rng, used)
      players[p.id] = p
      n++
    }
  }
  while (n < NON_CARD_POOL) {
    const i = n
    const p = generatePlayer(`c${i}`, { rating: 84 - (i - 80) * 0.075 + gaussian(rng) * 2.5, tour: 'challenge', age: randomAge(rng, 0.32) }, rng, used)
    players[p.id] = p
    n++
  }
  return players
}

// Yearly aging: youngsters improve, veterans fade, and the oldest retire and are replaced.
export function agePlayers(career, rng = Math.random) {
  const used = new Set(Object.values(career.players).map((p) => p.name))
  for (const p of Object.values(career.players)) {
    if (p.id === 'user') continue
    p.age++
    const trend = p.age <= 24 ? 1.2 : p.age <= 33 ? 0.2 : p.age <= 40 ? -0.4 : -1
    p.rating = Math.round(Math.max(52, Math.min(106, p.rating + trend + gaussian(rng) * 1.6)) * 10) / 10
    if (p.tour !== 'pro' && (p.age > 58 || (p.age > 45 && p.rating < 58))) {
      const fresh = generatePlayer(p.id, { rating: 60 + gaussian(rng) * 5, tour: 'challenge', age: 17 + Math.floor(rng() * 4), nation: p.nation }, rng, used)
      career.players[p.id] = fresh
      career.retired = (career.retired ?? 0) + 1
    }
  }
}
