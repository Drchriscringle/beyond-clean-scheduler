// Curated derbies across every division in the game - a deliberately short
// list per country rather than an attempt at exhaustive coverage, since a
// "is this even a real rivalry" pairing loses its flavour fast. These are
// invented rivalries between this game's fictional clubs (see clubs.js and
// friends), not real-world fixtures. A derby match gets a small extra dose
// of unpredictability (see matchSim.js) and a livelier discipline record,
// on top of whatever the two sides' actual quality says should happen.
const RIVALRIES = [
  ['arsenal', 'tottenham', 'North Side Derby'],
  ['man-utd', 'man-city', 'City Rivals Derby'],
  ['man-utd', 'liverpool', 'The Long Rivalry'],
  ['liverpool', 'everton', 'Riverside Derby'],
  ['chelsea', 'tottenham', 'Capital Rivalry'],
  ['newcastle', 'sunderland', 'Coastal Derby'],
  ['forest', 'derby', 'Heartlands Derby'],
  ['norwich', 'ipswich', 'East Country Derby'],
  ['cardiff', 'swansea', 'Coastline Derby'],
  ['portsmouth', 'southampton', 'South Shore Derby'],
  ['blackburn', 'burnley', 'Millstone Derby'],
  ['celtic', 'rangers', 'The Old Rivalry'],
  ['hearts', 'hibernian', 'Capital Derby'],
  ['dundee', 'dundee-united', 'Riverfront Derby'],
  ['real-madrid', 'barcelona', 'The Grand Clasico'],
  ['real-madrid', 'atletico-madrid', 'Capital Derby'],
  ['barcelona', 'espanyol', 'Harbour Derby'],
  ['sevilla', 'real-betis', 'River Derby'],
  ['athletic-bilbao', 'real-sociedad', 'Northern Coast Derby'],
]

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

const RIVALRY_BY_KEY = new Map(RIVALRIES.map(([a, b, label]) => [pairKey(a, b), label]))

export function derbyLabel(clubIdA, clubIdB) {
  return RIVALRY_BY_KEY.get(pairKey(clubIdA, clubIdB)) ?? null
}

export function isDerbyMatch(clubIdA, clubIdB) {
  return RIVALRY_BY_KEY.has(pairKey(clubIdA, clubIdB))
}
