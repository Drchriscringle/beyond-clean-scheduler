import { findRegion, regionLifeExpectancy, regionSentenceName } from '../data/lifeExpectancy.js'
import { ageInYears, parseDate, toISODate } from './dates.js'

export const STORAGE_KEY = 'time-left:settings:v1'

export const CUSTOM_REGION = 'custom'

export const DEFAULT_SETTINGS = {
  birthDate: '',
  regionId: '',
  customExpectancy: '80',
  sex: 'both',
  mode: 'simple',
  hemisphere: 'auto',
  factors: {},
}

/** The oldest anyone has got, so a typo in the year is caught rather than counted. */
const MAX_PLAUSIBLE_AGE = 122

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const saved = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      factors: { ...DEFAULT_SETTINGS.factors, ...saved.factors },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(storage, settings) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // A browser with storage switched off still gets a working clock.
  }
}

/**
 * Turns the raw form values into the numbers the clock needs, or into the one
 * thing the person still has to fix. `pending` means they simply have not
 * finished filling it in, which is not an error worth shouting about.
 */
export function resolveInputs(settings, now = new Date()) {
  const birth = parseDate(settings.birthDate)
  if (!birth) return { ok: false, pending: true }
  if (birth > now) return { ok: false, error: 'That date is in the future.' }
  if (ageInYears(birth, now) > MAX_PLAUSIBLE_AGE) {
    return { ok: false, error: 'That would make you older than anyone on record. Check the year?' }
  }

  const custom = settings.regionId === CUSTOM_REGION
  const region = custom ? null : findRegion(settings.regionId)
  if (!custom && !region) return { ok: false, pending: true }

  const lifeExpectancyAtBirth = custom
    ? Number(settings.customExpectancy)
    : regionLifeExpectancy(region, settings.sex)

  if (!Number.isFinite(lifeExpectancyAtBirth) || lifeExpectancyAtBirth < 20 || lifeExpectancyAtBirth > 110) {
    return { ok: false, error: 'Life expectancy should be a number between 20 and 110.' }
  }

  const hemisphere =
    settings.hemisphere === 'auto' ? (region?.hemisphere ?? 'n') : settings.hemisphere

  return {
    ok: true,
    birth,
    lifeExpectancyAtBirth,
    hemisphere,
    region,
    placeLabel: region ? regionSentenceName(region) : 'the figure you entered',
    source: region ? region.source : 'your own number',
  }
}

export const todayISO = () => toISODate(new Date())
