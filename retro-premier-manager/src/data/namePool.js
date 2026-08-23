// Generic name pools used to fill out every player in every squad, star
// "marquee" flavor players (see starPlayers.js) included - a big, broadly
// international mix covering every nationality the game's real club names
// draw players from, so a generated name reads as plausibly footballer-ish
// without matching any specific real individual. None of these are real
// people; first and last names are drawn independently, so the combination
// space is large enough that no output is deliberately built to resemble
// one particular real player.

export const FIRST_NAMES = [
  'James', 'Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'Liam', 'Callum',
  'Ryan', 'Connor', 'Tyler', 'Ben', 'Sam', 'Josh', 'Aaron', 'Dean', 'Lewis',
  'Kian', 'Reece', 'Marcus', 'Andre', 'Kofi', 'Emeka', 'Kwame', 'Idris',
  'Moussa', 'Ibrahim', 'Youssef', 'Karim', 'Omar', 'Bilal', 'Amadou',
  'Lucas', 'Mateus', 'Rafael', 'Diego', 'Bruno', 'Thiago', 'Gabriel',
  'Matheus', 'Joao', 'Pedro', 'Nicolas', 'Mathias', 'Sebastian', 'Andres',
  'Antoine', 'Julien', 'Mathieu', 'Baptiste', 'Hugo', 'Theo', 'Kylian',
  'Lukas', 'Niklas', 'Jonas', 'Felix', 'Maximilian', 'Tobias', 'Elias',
  'Viktor', 'Erik', 'Anders', 'Magnus', 'Henrik', 'Jesper', 'Mikkel',
  'Jakub', 'Tomasz', 'Marek', 'Filip', 'Petr', 'Ondrej', 'Milan',
  'Ivan', 'Nikola', 'Luka', 'Marko', 'Stefan', 'Danijel', 'Ognjen',
  'Kenji', 'Hiroshi', 'Yuto', 'Takumi', 'Daichi', 'Ritsu',
  'Caleb', 'Elliot', 'Finlay', 'Archie', 'Freddie', 'Toby', 'Nathan',
  'Enzo', 'Rodrigo', 'Julian', 'Alejandro', 'Franco', 'Ezequiel', 'Facundo',
  'Thibaut', 'Romelu', 'Kevin', 'Axel', 'Youri', 'Timothy', 'Dries',
  'Goncalo', 'Bernardo', 'Renato', 'Vitor', 'Ruben', 'Cristiano', 'Diogo',
  'Xavi', 'Pau', 'Marc', 'Alvaro', 'Ferran', 'Dani', 'Jordi',
  'Gareth', 'Ethan', 'Rhys', 'Owain', 'Dylan',
  'Kyle', 'Scott', 'Kieran', 'Billy', 'Stuart', 'Fraser',
  'Arda', 'Kerem', 'Hakan', 'Cengiz', 'Baris',
  'Mohammed', 'Hassan', 'Tariq', 'Riyad', 'Sofyan',
  'Chukwuemeka', 'Chidozie', 'Ola', 'Wilfred', 'Alex',
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
  'Alvarez', 'Romero', 'Acuna', 'Molina', 'Correa', 'Paredes',
  'De Bruyne', 'Vermeulen', 'Janssens', 'Van Damme', 'Peeters', 'Willems',
  'Carvalho', 'Neves', 'Andrade', 'Guerreiro', 'Semedo', 'Mendes', 'Vieira',
  'Torres', 'Navarro', 'Serrano', 'Aguilar', 'Vidal', 'Puig', 'Cubarsi',
  'Davies', 'Bale', 'Ramsey', 'James', 'Moore',
  'Robertson', 'Fraser', 'Naismith', 'Dykes', 'Christie',
  'Yilmaz', 'Demir', 'Kaya', 'Sahin', 'Aydin',
  'Amrabat', 'Ziyech', 'Boufal', 'El-Nesyri', 'Saiss',
  'Iwobi', 'Iheanacho', 'Onuachu', 'Chukwueze', 'Osimhen',
]

export function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)]
}

export function generateName(rng = Math.random) {
  return `${pickRandom(FIRST_NAMES, rng)} ${pickRandom(LAST_NAMES, rng)}`
}
