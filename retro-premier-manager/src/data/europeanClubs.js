// A small pool of fictional European opposition for the Champions League /
// Europa League campaigns. The game only simulates English (and now
// Scottish, Spanish, Italian, German, French, Dutch and Portuguese) clubs
// in full, so a European run only ever tracks the player's own
// single-elimination path - opponents are drawn from this pool on demand
// rather than needing a full continental league/squad simulation of their
// own.
//
// This pool used to be much bigger, but every entry that graduated into its
// own fully simulated domestic division (see laLigaClubs.js, serieAClubs.js,
// bundesligaClubs.js, ligue1Clubs.js, eredivisieClubs.js,
// primeiraLigaClubs.js and friends) moved out - a real division with
// fixtures and its own European qualification, not just opposition drawn
// for someone else's cup run.
export const EUROPEAN_CLUBS = [{ id: 'euro-shakhtar', name: 'Donetsk Oranges', reputation: 2 }]
