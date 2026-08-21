// Generic name pools used to fill out the remainder of each 22-30 man squad
// once the curated "star" players (starPlayers.js) are placed. Mixed
// British/European/South American flavour, matching the modern Premier
// League's international make-up. None of these are real individuals.

export const FIRST_NAMES = [
  'James', 'Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'Liam', 'Callum',
  'Ryan', 'Connor', 'Tyler', 'Ben', 'Sam', 'Josh', 'Aaron', 'Dean', 'Lewis',
  'Kian', 'Reece', 'Marcus', 'Andre', 'Kofi', 'Emeka', 'Kwame', 'Idris',
  'Moussa', 'Ibrahim', 'Youssef', 'Karim', 'Omar', 'Bilal', 'Amadou',
  'Lucas', 'Mateus', 'Rafael', 'Diego', 'Bruno', 'Thiago', 'Gabriel',
  'Matheus', 'Joao', 'Pedro', 'Nicolas', 'Mathias', 'Sebastian', 'Andres',
  'Antoine', 'Julien', 'Mathieu', 'Baptiste', 'Nicolas', 'Hugo', 'Theo',
  'Lukas', 'Niklas', 'Jonas', 'Felix', 'Maximilian', 'Tobias', 'Elias',
  'Viktor', 'Erik', 'Anders', 'Magnus', 'Henrik', 'Jesper', 'Mikkel',
  'Jakub', 'Tomasz', 'Marek', 'Filip', 'Petr', 'Ondrej', 'Milan',
  'Ivan', 'Nikola', 'Luka', 'Marko', 'Stefan', 'Danijel', 'Ognjen',
  'Kenji', 'Hiroshi', 'Yuto', 'Takumi', 'Daichi', 'Ritsu',
  'Caleb', 'Elliot', 'Finlay', 'Archie', 'Freddie', 'Toby', 'Nathan',
]

export const LAST_NAMES = [
  'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts',
  'Walker', 'Wright', 'Turner', 'Hughes', 'Edwards', 'Green', 'Hall', 'Cooper',
  'Ward', 'Foster', 'Marsh', 'Hunt', 'Bishop', 'Chapman', 'Barrett', 'Doyle',
  'Okafor', 'Adeyemi', 'Boateng', 'Mensah', 'Diallo', 'Toure', 'Keita',
  'Osei', 'Owusu', 'Sarr', 'Diop', 'Cisse', 'Bakayoko', 'Kone',
  'Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Ferreira', 'Rocha',
  'Almeida', 'Ramos', 'Cardoso', 'Machado', 'Teixeira', 'Nunes',
  'Garcia', 'Martinez', 'Lopez', 'Fernandez', 'Gonzalez', 'Rodriguez',
  'Dubois', 'Lefevre', 'Moreau', 'Girard', 'Bernard', 'Rousseau',
  'Muller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann',
  'Andersen', 'Nielsen', 'Hansen', 'Jensen', 'Pedersen', 'Larsen',
  'Nowak', 'Kowalski', 'Wojcik', 'Kaminski', 'Zajac',
  'Novak', 'Dvorak', 'Prochazka', 'Svoboda',
  'Ito', 'Suzuki', 'Tanaka', 'Watanabe', 'Nakamura',
]

export function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)]
}

export function generateName(rng = Math.random) {
  return `${pickRandom(FIRST_NAMES, rng)} ${pickRandom(LAST_NAMES, rng)}`
}
