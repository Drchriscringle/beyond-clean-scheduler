// The season, modelled on the real 2026 PDC calendar (the in-game year replaces 2026).
// [month (1-12), day, competition key, name, venue, country]
// Dates marked ~ were not published at the time of writing and are placed where they
// sat in previous seasons.

const V = {
  MK: ['Arena MK, Milton Keynes', 'ENG'],
  KALKAR: ['Wunderland Kalkar', 'GER'],
  LEICESTER: ['Mattioli Arena, Leicester', 'ENG'],
  WIGAN: ['Robin Park Tennis Centre, Wigan', 'ENG'],
  HILDESHEIM: ['Halle 39, Hildesheim', 'GER'],
  MINEHEAD: ["Butlin's Resort, Minehead", 'ENG'],
  O2: ['The O2, London', 'ENG'],
}

const PC_DATES = [
  [2, 9, 'HILDESHEIM'], [2, 10, 'HILDESHEIM'], [2, 16, 'WIGAN'], [2, 17, 'WIGAN'], [2, 24, 'LEICESTER'], [2, 25, 'LEICESTER'],
  [3, 30, 'LEICESTER'], [3, 31, 'LEICESTER'], [4, 13, 'WIGAN'], [4, 14, 'WIGAN'], [4, 27, 'MK'], [4, 28, 'MK'],
  [5, 4, 'HILDESHEIM'], [5, 5, 'HILDESHEIM'], [5, 12, 'LEICESTER'], [5, 13, 'LEICESTER'], [5, 18, 'LEICESTER'],
  // ~ PC 18–34
  [5, 19, 'LEICESTER'], [6, 1, 'HILDESHEIM'], [6, 2, 'HILDESHEIM'], [6, 29, 'LEICESTER'], [6, 30, 'LEICESTER'],
  [7, 6, 'WIGAN'], [7, 7, 'WIGAN'], [8, 3, 'MK'], [8, 4, 'MK'], [8, 10, 'LEICESTER'], [8, 11, 'LEICESTER'],
  [9, 22, 'HILDESHEIM'], [9, 23, 'HILDESHEIM'], [10, 12, 'WIGAN'], [10, 13, 'WIGAN'], [11, 2, 'WIGAN'], [11, 3, 'WIGAN'],
]

const EURO_TOUR = [
  [2, 20, 'Poland Darts Open', 'EXPO Kraków', 'POL'],
  [3, 13, 'European Darts Trophy', 'Lokhalle, Göttingen', 'GER'],
  [3, 20, 'Belgian Darts Open', 'Oktoberhallen, Wieze', 'BEL'],
  [4, 4, 'German Darts Grand Prix', 'Zenith, Munich', 'GER'],
  [4, 17, 'European Darts Grand Prix', 'Glaspalast, Sindelfingen', 'GER'],
  [5, 8, 'Austrian Darts Open', 'Messe Graz', 'AUT'],
  [5, 22, 'International Darts Open', 'WT Energiesysteme Arena, Riesa', 'GER'],
  [5, 29, 'Baltic Sea Darts Open', 'Wunderino Arena, Kiel', 'GER'],
  [6, 19, 'Slovak Darts Open', 'Bratislava', 'SVK'],
  [7, 10, 'European Darts Open', 'Ostermann-Arena, Leverkusen', 'GER'],
  [8, 28, 'Hungarian Darts Trophy', 'MVM Dome, Budapest', 'HUN'],
  [9, 4, 'Czech Darts Open', 'PVA Expo, Prague', 'CZE'],
  [9, 11, 'Flanders Darts Trophy', 'Antwerp Expo', 'BEL'],
  [10, 9, 'Swiss Darts Trophy', 'St. Jakobshalle, Basel', 'SUI'],
  [10, 16, 'Dutch Darts Championship', 'MECC, Maastricht', 'NED'],
]

// Challenge Tour: four weekends of five events and one of four.
const CT_WEEKENDS = [[1, 16, 'MK', 5], [3, 27, 'LEICESTER', 5], [5, 1, 'HILDESHEIM', 5], [8, 14, 'MK', 5], [9, 25, 'LEICESTER', 4]] // last weekend ~
// ~ Development Tour weekends
const DT_WEEKENDS = [[2, 20, 'HILDESHEIM', 5], [4, 24, 'MK', 5], [6, 26, 'LEICESTER', 5], [8, 7, 'LEICESTER', 5], [10, 30, 'WIGAN', 4]]

// ~ Women's Series: six weekends of four events
const WO_WEEKENDS = [[2, 28, 'HILDESHEIM', 4], [4, 11, 'LEICESTER', 4], [5, 23, 'WIGAN', 4], [6, 13, 'MK', 4], [8, 29, 'LEICESTER', 4], [10, 24, 'WIGAN', 4]]

// ~ Premier League venues (2026 visited the UK, Ireland, Germany, the Netherlands and Belgium)
const PL_NIGHTS = [
  'Utilita Arena, Newcastle', 'OVO Hydro, Glasgow', '3Arena, Dublin', 'Westpoint, Exeter', 'Motorpoint Arena, Nottingham',
  'SSE Arena, Belfast', 'Cardiff International Arena', 'Brighton Centre', 'Lotto Arena, Antwerp', 'AO Arena, Manchester',
  'Uber Arena, Berlin', 'Rotterdam Ahoy', 'M&S Bank Arena, Liverpool', 'P&J Live, Aberdeen', 'Utilita Arena, Birmingham', 'First Direct Arena, Leeds',
]

function add(list, month, day, key, name, venue, country, extra = {}) {
  // Normalise day overflow (e.g. 30 October + 2 days).
  const d = new Date(Date.UTC(2026, month - 1, day))
  list.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate(), key, name, venue, country, ...extra })
}

export function seasonSchedule() {
  const s = []
  // January: Q-School (First Stage 5–7, Final Stage 8–11)
  for (let d = 1; d <= 3; d++) add(s, 1, 4 + d, 'qsFirst', `Q-School First Stage Day ${d}`, null, null, { qsDay: d })
  for (let d = 1; d <= 4; d++) add(s, 1, 7 + d, 'qsFinal', `Q-School Final Stage Day ${d}`, null, null, { qsDay: d })
  add(s, 1, 15, 'ws', 'Bahrain Darts Masters', 'Exhibition World Bahrain, Sakhir', 'BHR')
  add(s, 1, 19, 'ws', 'Saudi Arabia Darts Masters', 'Global Theatre, Riyadh', 'KSA')
  add(s, 1, 28, 'masters', 'World Masters', ...V.MK)
  add(s, 3, 6, 'ukopen', 'UK Open', ...V.MINEHEAD)
  add(s, 6, 5, 'ws', 'Nordic Darts Masters', 'Forum Copenhagen', 'DEN')
  add(s, 6, 11, 'worldcup', 'World Cup of Darts', 'Eissporthalle Frankfurt', 'GER')
  add(s, 6, 25, 'ws', 'US Darts Masters', 'Madison Square Garden, New York', 'USA')
  add(s, 7, 18, 'matchplay', 'World Matchplay', 'Winter Gardens, Blackpool', 'ENG')
  add(s, 8, 14, 'ws', 'New Zealand Darts Masters', 'Spark Arena, Auckland', 'NZL')
  add(s, 8, 21, 'ws', 'Australian Darts Masters', 'WIN Entertainment Centre, Wollongong', 'AUS')
  add(s, 9, 17, 'wsfinals', 'World Series Finals', 'AFAS Live, Amsterdam', 'NED')
  add(s, 9, 28, 'grandprix', 'World Grand Prix', ...V.LEICESTER)
  add(s, 10, 22, 'eurochamp', 'European Championship', 'Westfalenhallen, Dortmund', 'GER')
  add(s, 11, 14, 'grandslam', 'Grand Slam of Darts', 'WV Active Aldersley, Wolverhampton', 'ENG')
  add(s, 11, 27, 'pcfinals', 'Players Championship Finals', ...V.MINEHEAD)
  add(s, 12, 11, 'worlds', 'World Championship', 'Alexandra Palace, London', 'ENG')

  PC_DATES.forEach(([m, d, v], i) => add(s, m, d, 'pc', `Players Championship ${i + 1}`, ...V[v], { number: i + 1 }))
  EURO_TOUR.forEach(([m, d, name, venue, country], i) => add(s, m, d, 'et', name, venue, country, { number: i + 1 }))

  let ct = 1
  for (const [m, d, v, n] of CT_WEEKENDS) for (let i = 0; i < n; i++) add(s, m, d + Math.min(i, 2), 'ct', `Challenge Tour ${ct}`, ...V[v], { number: ct++ })
  let dt = 1
  for (const [m, d, v, n] of DT_WEEKENDS) for (let i = 0; i < n; i++) add(s, m, d + Math.min(i, 2), 'dt', `Development Tour ${dt}`, ...V[v], { number: dt++ })

  let wo = 1
  for (const [m, d, v, n] of WO_WEEKENDS) for (let i = 0; i < n; i++) add(s, m, d + Math.floor(i / 2), 'women', `Women's Series ${wo}`, ...V[v], { number: wo++ })
  add(s, 7, 26, 'womensMatchplay', "Women's World Matchplay", 'Winter Gardens, Blackpool', 'ENG')
  add(s, 2, 19, 'seniorsWorlds', 'World Seniors Championship', 'Circus Tavern, Purfleet', 'ENG')
  add(s, 5, 29, 'seniorsMasters', 'World Seniors Masters', 'Lakeside Country Club, Frimley Green', 'ENG')
  add(s, 9, 5, 'seniorsMatchplay', 'World Seniors Matchplay', 'York Barbican', 'ENG')

  // Premier League: Thursdays from 5 February, play-offs 28 May.
  const start = Date.UTC(2026, 1, 5)
  PL_NIGHTS.forEach((venue, i) => {
    const date = new Date(start + i * 7 * 86400000)
    add(s, date.getUTCMonth() + 1, date.getUTCDate(), 'premier', `Premier League Night ${i + 1}`, venue, null, { night: i + 1 })
  })
  add(s, 5, 28, 'plPlayoffs', 'Premier League Play-Offs', ...V.O2)

  return s.sort((a, b) => a.month - b.month || a.day - b.day)
}
