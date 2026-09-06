// Life expectancy at birth, in years, by place of residence.
//
// Columns: id | name | both sexes | male | female | hemisphere (n/s)
//
// Country figures are approximate 2024 estimates in the spirit of the UN World
// Population Prospects; sub-national figures come from the national statistics
// office for that country (ONS for the UK nations, CDC/NCHS for the US states).
// They are rounded, they lag reality by a couple of years, and for some smaller
// countries they are best-effort. Treat every number here as "roughly right for
// a population", never as a fact about a person.
//
// Hemisphere is taken from where most of the population actually lives, and is
// only used to decide which months count as summer and which as winter.

const COUNTRIES = `
Afghanistan|66.0|64.2|67.8|n
Albania|79.5|77.4|81.6|n
Algeria|77.5|76.4|78.7|n
Andorra|84.0|82.0|86.0|n
Angola|62.3|59.6|65.0|s
Antigua and Barbuda|79.0|77.0|81.0|n
Argentina|77.7|74.6|80.7|s
Armenia|76.5|73.0|79.6|n
Australia|84.1|82.1|86.0|s
Austria|82.3|79.8|84.6|n
Azerbaijan|74.4|71.9|76.9|n
Bahamas|74.5|71.5|77.4|n
Bahrain|79.5|78.2|81.2|n
Bangladesh|74.7|72.5|76.9|n
Barbados|78.0|75.6|80.3|n
Belarus|74.3|69.3|79.0|n
Belgium|82.3|80.1|84.4|n
Belize|72.0|69.0|75.2|n
Benin|60.8|58.9|62.8|n
Bhutan|72.6|71.0|74.4|n
Bolivia|68.5|65.9|71.2|s
Bosnia and Herzegovina|77.8|75.5|80.1|n
Botswana|68.5|65.4|71.6|s
Brazil|76.0|72.4|79.5|s
Brunei|75.0|73.3|76.9|n
Bulgaria|75.7|72.2|79.3|n
Burkina Faso|61.0|59.4|62.6|n
Burundi|63.7|61.6|65.8|s
Cabo Verde|74.6|70.9|78.0|n
Cambodia|70.5|67.5|73.4|n
Cameroon|63.2|61.2|65.2|n
Canada|82.9|80.9|84.9|n
Central African Republic|55.0|52.6|57.4|n
Chad|55.2|53.4|57.0|n
Chile|81.3|78.6|83.8|s
China|78.6|75.9|81.6|n
Colombia|77.7|74.5|80.9|n
Comoros|66.6|64.7|68.5|s
Congo|65.0|63.4|66.6|s
Costa Rica|80.8|78.2|83.5|n
Croatia|78.6|75.4|81.7|n
Cuba|78.1|75.7|80.6|n
Cyprus|81.7|79.9|83.5|n
Czechia|79.9|77.2|82.5|n
Democratic Republic of the Congo|62.4|60.5|64.3|s
Denmark|82.0|80.2|83.8|n
Djibouti|63.6|61.4|65.9|n
Dominica|74.0|71.0|77.0|n
Dominican Republic|73.5|70.5|76.6|n
Ecuador|77.9|75.0|80.9|s
Egypt|71.7|69.6|74.0|n
El Salvador|72.8|68.2|77.0|n
Equatorial Guinea|62.0|60.3|63.8|n
Eritrea|67.5|65.1|69.8|n
Estonia|79.1|74.9|83.0|n
Eswatini|60.0|56.5|63.4|s
Ethiopia|66.3|64.0|68.6|n
Faroe Islands|83.0|81.0|85.0|n
Fiji|68.5|65.5|71.6|s
Finland|82.2|79.6|84.6|n
France|83.4|80.4|86.2|n
Gabon|67.0|65.2|68.8|s
Gambia|66.4|64.5|68.3|n
Georgia|75.0|70.7|79.1|n
Germany|81.4|79.0|83.8|n
Ghana|64.5|62.9|66.1|n
Greece|82.0|79.5|84.4|n
Greenland|71.5|69.0|74.2|n
Grenada|75.5|73.0|78.0|n
Guatemala|71.5|68.2|74.7|n
Guinea|60.0|58.6|61.5|n
Guinea-Bissau|61.5|59.3|63.8|n
Guyana|66.0|63.5|68.8|n
Haiti|64.9|62.0|67.8|n
Honduras|72.5|69.5|75.6|n
Hong Kong|85.5|82.9|88.0|n
Hungary|76.7|73.2|80.0|n
Iceland|83.3|81.5|85.0|n
India|72.0|70.5|73.6|n
Indonesia|71.9|69.9|74.0|s
Iran|77.6|76.0|79.2|n
Iraq|72.7|70.4|75.2|n
Ireland|82.7|80.9|84.4|n
Israel|82.7|80.9|84.4|n
Italy|83.9|81.7|86.0|n
Ivory Coast|62.0|60.5|63.6|n
Jamaica|71.0|68.5|73.5|n
Japan|84.7|81.6|87.7|n
Jordan|78.0|76.3|79.9|n
Kazakhstan|74.4|70.1|78.3|n
Kenya|63.6|61.1|66.1|s
Kiribati|68.0|65.0|71.0|n
Kosovo|77.0|75.0|79.2|n
Kuwait|81.0|79.9|82.5|n
Kyrgyzstan|72.4|68.5|76.3|n
Laos|69.0|67.0|71.0|n
Latvia|76.5|71.5|81.1|n
Lebanon|77.5|75.4|79.6|n
Lesotho|57.0|53.5|60.4|s
Liberia|62.1|60.6|63.6|n
Libya|72.4|69.8|75.1|n
Liechtenstein|84.0|82.0|85.5|n
Lithuania|77.5|72.3|82.2|n
Luxembourg|83.4|81.4|85.4|n
Macao|85.4|82.7|88.0|n
Madagascar|65.6|63.9|67.4|s
Malawi|66.5|63.5|69.4|s
Malaysia|76.5|74.2|79.0|n
Maldives|81.0|79.5|82.8|n
Mali|60.5|59.3|61.7|n
Malta|83.6|81.7|85.4|n
Marshall Islands|66.0|64.0|68.0|n
Mauritania|68.5|66.4|70.6|n
Mauritius|74.7|71.3|78.1|s
Mexico|75.5|72.4|78.5|n
Micronesia|71.0|69.0|73.2|n
Moldova|72.5|68.3|76.6|n
Monaco|86.0|84.0|88.0|n
Mongolia|71.5|66.9|76.0|n
Montenegro|77.5|75.2|79.8|n
Morocco|75.3|74.2|76.5|n
Mozambique|63.5|60.5|66.4|s
Myanmar|67.0|64.0|70.1|n
Namibia|66.5|63.3|69.7|s
Nauru|65.0|62.0|68.0|s
Nepal|71.5|69.8|73.1|n
Netherlands|82.3|80.6|83.9|n
New Zealand|82.9|81.0|84.7|s
Nicaragua|74.5|71.2|77.8|n
Niger|62.0|60.6|63.4|n
Nigeria|54.5|53.6|55.4|n
North Korea|73.6|70.0|77.0|n
North Macedonia|76.5|74.4|78.7|n
Norway|83.4|81.6|85.1|n
Oman|80.0|78.6|82.0|n
Pakistan|67.7|66.5|68.9|n
Palau|73.5|70.0|77.0|n
Palestine|74.5|72.7|76.4|n
Panama|79.5|76.5|82.6|n
Papua New Guinea|66.0|64.0|68.2|s
Paraguay|73.0|70.5|75.7|s
Peru|77.0|74.5|79.7|s
Philippines|70.0|66.7|73.5|n
Poland|78.6|74.8|82.2|n
Portugal|82.4|79.5|85.0|n
Puerto Rico|79.5|75.5|83.2|n
Qatar|82.3|81.5|83.6|n
Romania|76.6|73.1|80.2|n
Russia|73.3|68.0|78.1|n
Rwanda|67.5|65.0|70.0|s
Saint Lucia|73.0|70.0|76.0|n
Samoa|73.5|70.5|76.6|s
San Marino|85.0|83.0|87.0|n
Sao Tome and Principe|70.5|68.3|72.7|n
Saudi Arabia|78.7|77.2|80.7|n
Senegal|68.7|66.5|70.8|n
Serbia|76.5|74.0|79.0|n
Seychelles|73.4|69.4|77.5|s
Sierra Leone|61.8|60.0|63.5|n
Singapore|83.7|81.6|85.8|n
Slovakia|78.0|74.4|81.3|n
Slovenia|82.0|79.4|84.4|n
Solomon Islands|71.0|69.0|73.2|s
Somalia|57.0|54.6|59.5|n
South Africa|66.0|62.5|69.4|s
South Korea|84.3|81.3|87.1|n
South Sudan|57.6|55.7|59.6|n
Spain|84.0|81.4|86.5|n
Sri Lanka|76.9|73.6|80.2|n
Sudan|66.3|64.1|68.5|n
Suriname|71.0|67.8|74.4|n
Sweden|83.4|81.6|85.1|n
Switzerland|84.2|82.3|86.0|n
Syria|72.5|70.0|75.2|n
Taiwan|80.5|77.4|83.7|n
Tajikistan|72.0|69.5|74.6|n
Tanzania|67.0|64.9|69.1|s
Thailand|76.7|73.1|80.2|n
Timor-Leste|69.0|67.0|71.1|s
Togo|62.6|60.7|64.5|n
Tonga|71.5|69.0|74.0|s
Trinidad and Tobago|73.5|70.3|76.9|n
Tunisia|76.9|74.8|79.0|n
Turkey|78.6|75.9|81.3|n
Turkmenistan|70.0|66.5|73.6|n
Tuvalu|65.0|62.5|67.6|s
Uganda|68.2|65.5|70.8|n
Ukraine|73.0|68.0|77.8|n
United Arab Emirates|82.9|82.4|84.0|n
United Kingdom|81.4|79.3|83.4|n
United States|79.3|76.4|82.0|n
Uruguay|78.1|74.7|81.3|s
Uzbekistan|72.5|70.0|75.1|n
Vanuatu|71.0|69.0|73.1|s
Venezuela|72.5|69.0|76.2|n
Vietnam|74.6|70.3|79.0|n
Yemen|68.0|65.5|70.6|n
Zambia|64.0|61.5|66.5|s
Zimbabwe|62.5|59.6|65.3|s
`

// ONS national life tables, 2020-2022.
const UK_NATIONS = `
England|80.9|79.0|82.9|n
Northern Ireland|80.3|78.3|82.3|n
Scotland|78.6|76.5|80.7|n
Wales|80.0|78.0|82.0|n
`

// CDC/NCHS state life expectancy. The published figures are for both sexes; the
// male and female splits below apply the national gap of about 5.7 years, so
// treat them as an indication rather than a state-level measurement.
const US_STATES = `
Alabama|73.2|n
Alaska|76.6|n
Arizona|76.3|n
Arkansas|73.8|n
California|79.0|n
Colorado|78.3|n
Connecticut|78.4|n
Delaware|76.7|n
District of Columbia|76.0|n
Florida|77.5|n
Georgia|75.6|n
Hawaii|79.9|n
Idaho|78.4|n
Illinois|76.8|n
Indiana|75.3|n
Iowa|77.6|n
Kansas|76.4|n
Kentucky|73.5|n
Louisiana|73.1|n
Maine|77.6|n
Maryland|77.0|n
Massachusetts|79.0|n
Michigan|76.0|n
Minnesota|79.1|n
Mississippi|71.9|n
Missouri|75.1|n
Montana|76.5|n
Nebraska|77.7|n
Nevada|76.3|n
New Hampshire|79.0|n
New Jersey|77.5|n
New Mexico|74.5|n
New York|77.7|n
North Carolina|76.1|n
North Dakota|77.3|n
Ohio|75.3|n
Oklahoma|74.1|n
Oregon|78.8|n
Pennsylvania|76.5|n
Rhode Island|78.2|n
South Carolina|74.8|n
South Dakota|76.6|n
Tennessee|73.8|n
Texas|76.5|n
Utah|78.6|n
Vermont|78.8|n
Virginia|77.0|n
Washington|79.2|n
West Virginia|72.8|n
Wisconsin|77.7|n
Wyoming|76.2|n
`

const US_SEX_GAP = 5.7

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseTable(table, { group, source, prefix = '', suffix = '' }) {
  return table
    .trim()
    .split('\n')
    .map((line) => {
      const parts = line.split('|')
      const name = parts[0]
      const both = Number(parts[1])
      // Rows with four numeric columns carry their own sex split; the shorter
      // rows only publish a combined figure, so we widen it by a typical gap.
      const hasSplit = parts.length > 3
      const male = hasSplit ? Number(parts[2]) : both - US_SEX_GAP / 2
      const female = hasSplit ? Number(parts[3]) : both + US_SEX_GAP / 2
      const hemisphere = parts[parts.length - 1] === 's' ? 's' : 'n'
      return {
        id: `${prefix}${slug(name)}`,
        name: `${name}${suffix}`,
        searchName: name,
        group,
        source,
        hemisphere,
        both,
        male: Math.round(male * 10) / 10,
        female: Math.round(female * 10) / 10,
      }
    })
}

export const REGIONS = [
  ...parseTable(COUNTRIES, { group: 'Countries', source: 'UN estimates, approx. 2024' }),
  ...parseTable(UK_NATIONS, {
    group: 'United Kingdom',
    source: 'ONS national life tables, 2020-2022',
    prefix: 'uk-',
  }),
  ...parseTable(US_STATES, {
    group: 'United States',
    source: 'CDC/NCHS state life expectancy',
    prefix: 'us-',
  }),
]

export const REGIONS_BY_ID = new Map(REGIONS.map((region) => [region.id, region]))

export const GROUP_ORDER = ['Countries', 'United Kingdom', 'United States']

// Names that need a "the" in front of them when they appear in a sentence.
const TAKES_THE = new Set([
  'united-kingdom',
  'united-states',
  'united-arab-emirates',
  'netherlands',
  'philippines',
  'bahamas',
  'gambia',
  'maldives',
  'comoros',
  'seychelles',
  'marshall-islands',
  'solomon-islands',
  'democratic-republic-of-the-congo',
  'congo',
  'central-african-republic',
])

/** The region's name as it reads mid-sentence: "in the United Kingdom". */
export function regionSentenceName(region) {
  if (!region) return ''
  return TAKES_THE.has(region.id) ? `the ${region.name}` : region.name
}

export function findRegion(id) {
  return REGIONS_BY_ID.get(id) ?? null
}

/** Life expectancy at birth for a region, for the chosen sex. */
export function regionLifeExpectancy(region, sex) {
  if (!region) return null
  if (sex === 'male') return region.male
  if (sex === 'female') return region.female
  return region.both
}
