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
// bundesligaClubs.js), and Inter Milan, AC Milan, Juventus and Napoli into
// Serie A (see serieAClubs.js).
export const EUROPEAN_CLUBS = [
  { id: 'euro-psg', name: 'Paris Saint-Germain', reputation: 5 },
  { id: 'euro-ajax', name: 'Ajax', reputation: 3 },
  { id: 'euro-porto', name: 'Porto', reputation: 3 },
  { id: 'euro-benfica', name: 'Benfica', reputation: 3 },
  { id: 'euro-shakhtar', name: 'Shakhtar Donetsk', reputation: 2 },
]
