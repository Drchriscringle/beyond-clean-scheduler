// A small pool of fictional-in-scope (real-named) European opposition for
// the Champions League / Europa League campaigns. The game only simulates
// English clubs in full, so a European run only ever tracks the player's own
// single-elimination path - opponents are drawn from this pool on demand
// rather than needing a full continental league/squad simulation of their own.
export const EUROPEAN_CLUBS = [
  { id: 'euro-real-madrid', name: 'Real Madrid', reputation: 5 },
  { id: 'euro-barcelona', name: 'Barcelona', reputation: 5 },
  { id: 'euro-bayern-munich', name: 'Bayern Munich', reputation: 5 },
  { id: 'euro-psg', name: 'Paris Saint-Germain', reputation: 5 },
  { id: 'euro-inter-milan', name: 'Inter Milan', reputation: 4 },
  { id: 'euro-ac-milan', name: 'AC Milan', reputation: 4 },
  { id: 'euro-juventus', name: 'Juventus', reputation: 4 },
  { id: 'euro-dortmund', name: 'Borussia Dortmund', reputation: 4 },
  { id: 'euro-atletico-madrid', name: 'Atletico Madrid', reputation: 4 },
  { id: 'euro-napoli', name: 'Napoli', reputation: 4 },
  { id: 'euro-ajax', name: 'Ajax', reputation: 3 },
  { id: 'euro-porto', name: 'Porto', reputation: 3 },
  { id: 'euro-benfica', name: 'Benfica', reputation: 3 },
  { id: 'euro-sevilla', name: 'Sevilla', reputation: 3 },
  { id: 'euro-rb-leipzig', name: 'RB Leipzig', reputation: 3 },
  { id: 'euro-shakhtar', name: 'Shakhtar Donetsk', reputation: 2 },
]
