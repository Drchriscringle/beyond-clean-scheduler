import { EUROPEAN_CLUBS } from './europeanClubs.js'

// League label for each of the existing European opponent pool's clubs -
// europeanClubs.js itself stays untouched (europe.js's opponent draw doesn't
// need this), it's only used here for display and to group the transfer
// market's foreign pool by league.
const EURO_LEAGUE_BY_ID = {
  'euro-real-madrid': 'La Liga',
  'euro-barcelona': 'La Liga',
  'euro-atletico-madrid': 'La Liga',
  'euro-sevilla': 'La Liga',
  'euro-bayern-munich': 'Bundesliga',
  'euro-dortmund': 'Bundesliga',
  'euro-rb-leipzig': 'Bundesliga',
  'euro-psg': 'Ligue 1',
  'euro-inter-milan': 'Serie A',
  'euro-ac-milan': 'Serie A',
  'euro-juventus': 'Serie A',
  'euro-napoli': 'Serie A',
  'euro-ajax': 'Eredivisie',
  'euro-porto': 'Primeira Liga',
  'euro-benfica': 'Primeira Liga',
  'euro-shakhtar': 'Ukrainian Premier League',
}

const SCOTTISH_CLUBS_RAW = [
  { id: 'scot-celtic', name: 'Celtic', reputation: 3 },
  { id: 'scot-rangers', name: 'Rangers', reputation: 3 },
  { id: 'scot-aberdeen', name: 'Aberdeen', reputation: 2 },
  { id: 'scot-hearts', name: 'Heart of Midlothian', reputation: 2 },
  { id: 'scot-hibernian', name: 'Hibernian', reputation: 1 },
]

const BANK_BALANCE_PER_REPUTATION = 25_000_000

// Foreign clubs are a persistent but deliberately shallow tier: they have
// real, generated squads and a bank balance so the player can buy from and
// sell to them like any other club, and they're drawn on as European
// opponents (see europe.js) - but unlike Premier League/Championship clubs
// they have no fixtures, table position or promotion/relegation of their
// own (division: 'FOREIGN' keeps them out of every division-filtered league
// system), and their squads don't age or take a youth intake at season
// rollover - they stay exactly as generated.
export const FOREIGN_CLUBS = [
  ...EUROPEAN_CLUBS.map((c) => ({
    ...c,
    division: 'FOREIGN',
    league: EURO_LEAGUE_BY_ID[c.id] ?? 'European',
    bankBalance: c.reputation * BANK_BALANCE_PER_REPUTATION,
  })),
  ...SCOTTISH_CLUBS_RAW.map((c) => ({
    ...c,
    division: 'FOREIGN',
    league: 'Scottish Premiership',
    bankBalance: c.reputation * BANK_BALANCE_PER_REPUTATION,
  })),
]
