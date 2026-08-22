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

const BANK_BALANCE_PER_REPUTATION = 25_000_000

// Foreign clubs are a persistent but deliberately shallow tier: they have
// real, generated squads and a bank balance so the player can buy from and
// sell to them like any other club, and they're drawn on as European
// opponents (see europe.js) - but unlike Premier League/Championship clubs
// they have no fixtures, table position or promotion/relegation of their
// own (division: 'FOREIGN' keeps them out of every division-filtered league
// system), and their squads don't age or take a youth intake at season
// rollover - they stay exactly as generated.
//
// Scottish clubs used to live here too, but now have their own fully
// simulated Scottish Premiership/Championship (see scottishClubs.js) - a
// real division with fixtures and promotion/relegation, not just a
// transfer-market shopping pool.
export const FOREIGN_CLUBS = EUROPEAN_CLUBS.map((c) => ({
  ...c,
  division: 'FOREIGN',
  league: EURO_LEAGUE_BY_ID[c.id] ?? 'European',
  bankBalance: c.reputation * BANK_BALANCE_PER_REPUTATION,
}))
