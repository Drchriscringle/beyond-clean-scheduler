// A faint national flag watermark behind the app shell, picked from the
// player's current club's division - a simple decorative touch, not an
// attempt at heraldically exact flags (no coat of arms, approximate cross/
// saltire proportions). Built as inline SVG data URIs so there's no new
// image asset to ship.
const DIVISION_COUNTRY = {
  PL: 'ENGLAND',
  CH: 'ENGLAND',
  SPL: 'SCOTLAND',
  SCH: 'SCOTLAND',
  LALIGA: 'SPAIN',
  SEGUNDA: 'SPAIN',
  SERIEA: 'ITALY',
  SERIEB: 'ITALY',
  BUNDESLIGA: 'GERMANY',
  BUNDESLIGA2: 'GERMANY',
  LIGUE1: 'FRANCE',
  LIGUE2: 'FRANCE',
  EREDIVISIE: 'NETHERLANDS',
  EERSTEDIVISIE: 'NETHERLANDS',
}

const ENGLAND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#ffffff"/>
  <rect x="200" width="100" height="300" fill="#ce1124"/>
  <rect y="120" width="500" height="60" fill="#ce1124"/>
</svg>
`.trim()

const SCOTLAND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#005eb8"/>
  <line x1="0" y1="0" x2="500" y2="300" stroke="#ffffff" stroke-width="70"/>
  <line x1="500" y1="0" x2="0" y2="300" stroke="#ffffff" stroke-width="70"/>
</svg>
`.trim()

const SPAIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#aa151b"/>
  <rect y="75" width="500" height="150" fill="#f1bf00"/>
</svg>
`.trim()

const ITALY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#ffffff"/>
  <rect width="167" height="300" fill="#008c45"/>
  <rect x="333" width="167" height="300" fill="#cd212a"/>
</svg>
`.trim()

const GERMANY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#ffce00"/>
  <rect width="500" height="200" fill="#dd0000"/>
  <rect width="500" height="100" fill="#000000"/>
</svg>
`.trim()

const FRANCE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#ffffff"/>
  <rect width="167" height="300" fill="#0055a4"/>
  <rect x="333" width="167" height="300" fill="#ef4135"/>
</svg>
`.trim()

const NETHERLANDS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <rect width="500" height="300" fill="#ffffff"/>
  <rect width="500" height="100" fill="#ae1c28"/>
  <rect y="200" width="500" height="100" fill="#21468b"/>
</svg>
`.trim()

const FLAG_SVGS = {
  ENGLAND: ENGLAND_SVG,
  SCOTLAND: SCOTLAND_SVG,
  SPAIN: SPAIN_SVG,
  ITALY: ITALY_SVG,
  GERMANY: GERMANY_SVG,
  FRANCE: FRANCE_SVG,
  NETHERLANDS: NETHERLANDS_SVG,
}

// Style object for the `.pm97-app` shell: sets the `--flag-bg` custom
// property the CSS watermark reads, or {} (no flag) when the division isn't
// mapped to a country - e.g. before a club has been chosen.
export function flagBackgroundStyle(division) {
  const country = DIVISION_COUNTRY[division]
  if (!country) return {}
  const dataUri = `url("data:image/svg+xml,${encodeURIComponent(FLAG_SVGS[country])}")`
  return { '--flag-bg': dataUri }
}
