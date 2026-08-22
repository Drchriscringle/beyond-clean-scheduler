// Curated real-world derbies across every division in the game - a
// deliberately short, well-known list per country rather than an attempt at
// exhaustive coverage, since a "is this even a real rivalry" pairing loses
// its flavour fast. A derby match gets a small extra dose of unpredictability
// (see matchSim.js) and a livelier discipline record, on top of whatever the
// two sides' actual quality says should happen.
const RIVALRIES = [
  ['arsenal', 'tottenham', 'North London Derby'],
  ['man-utd', 'man-city', 'Manchester Derby'],
  ['man-utd', 'liverpool', 'Liverpool vs Manchester United'],
  ['liverpool', 'everton', 'Merseyside Derby'],
  ['chelsea', 'tottenham', 'London rivalry'],
  ['newcastle', 'sunderland', 'Tyne-Wear Derby'],
  ['forest', 'derby', 'East Midlands Derby'],
  ['norwich', 'ipswich', 'East Anglian Derby'],
  ['cardiff', 'swansea', 'South Wales Derby'],
  ['portsmouth', 'southampton', 'South Coast Derby'],
  ['blackburn', 'burnley', 'East Lancashire Derby'],
  ['celtic', 'rangers', 'Old Firm'],
  ['hearts', 'hibernian', 'Edinburgh Derby'],
  ['dundee', 'dundee-united', 'Dundee Derby'],
  ['real-madrid', 'barcelona', 'El Clasico'],
  ['real-madrid', 'atletico-madrid', 'Madrid Derby'],
  ['barcelona', 'espanyol', 'Barcelona Derby'],
  ['sevilla', 'real-betis', 'Seville Derby'],
  ['athletic-bilbao', 'real-sociedad', 'Basque Derby'],
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
