// A small pool of fictional-in-scope (real-named) European opposition for
// the Champions League / Europa League campaigns. The game only simulates
// English (and now Scottish and Spanish) clubs in full, so a European run
// only ever tracks the player's own single-elimination path - opponents are
// drawn from this pool on demand rather than needing a full continental
// league/squad simulation of their own.
//
// Real Madrid, Barcelona, Atletico Madrid and Sevilla used to live here too,
// but now have their own fully simulated La Liga (see laLigaClubs.js) - a
// real division with fixtures and their own European qualification, not
// just opposition drawn for someone else's cup run. Bayern Munich, Borussia
// Dortmund and RB Leipzig graduated the same way into the Bundesliga (see
// bundesligaClubs.js), Inter Milan, AC Milan, Juventus and Napoli into
// Serie A (see serieAClubs.js), PSG into Ligue 1 (see ligue1Clubs.js), Ajax
// into the Eredivisie (see eredivisieClubs.js), and Porto and Benfica into
// the Primeira Liga (see primeiraLigaClubs.js).
export const EUROPEAN_CLUBS = [{ id: 'euro-shakhtar', name: 'Shakhtar Donetsk', reputation: 2 }]
