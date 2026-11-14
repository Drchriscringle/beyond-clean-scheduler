// Pure business rules shared by the web app (imported by Vite) and the
// Supabase Edge Functions (imported by Deno). No imports, no I/O, so the
// browser and the server always agree on prices and slot availability.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Average weeks in a month. A plan bills the same amount every month,
// averaged across the year, rather than charging more in 5-week months.
export const WEEKS_PER_MONTH = 52 / 12

// "Every 2 weeks" is stored as 0.5 cleans a week.
export const FORTNIGHTLY = 0.5

export const DEFAULT_SETTINGS = {
  businessName: 'Beyond Clean Ltd',
  area: 'Ayrshire',
  phone: '',
  email: '',
  googleReviewUrl: 'https://maps.app.goo.gl/m64hKCH1bkFQjyd27',
  // Postcode areas or districts you cover, e.g. "KA" (all of KA) or "KA7". Empty = everywhere.
  serviceAreas: ['KA'],

  // ---- Regular plans
  hourlyRate: 20, // £ per cleaner-hour
  visitsPerWeekOptions: [FORTNIGHTLY, 1, 2, 3],
  hoursPerVisitOptions: [2, 3, 4],
  // Percent off the monthly price, keyed by cleans per week. Negative = a surcharge.
  discounts: { 0.5: 0, 1: 0, 2: 5, 3: 10 },
  // Weekly start times customers can book a plan into. day: 1 = Monday ... 7 = Sunday.
  slots: [
    { day: 1, start: '09:00' }, { day: 1, start: '13:00' },
    { day: 2, start: '09:00' }, { day: 2, start: '13:00' },
    { day: 3, start: '09:00' }, { day: 3, start: '13:00' },
    { day: 4, start: '09:00' }, { day: 4, start: '13:00' },
    { day: 5, start: '09:00' }, { day: 5, start: '13:00' },
    { day: 6, start: '09:00' },
  ],
  // How many plan customers can share the same weekly slot (number of teams).
  slotCapacity: 2,
  // A skipped clean is credited off the next bill if the customer gives this much notice.
  skipNoticeHours: 48,
  skipCredit: true,

  // ---- One-off cleans
  closedDays: [7], // days the enquiry form will not offer (7 = Sunday)
  oneOff: {
    hourlyRate: 22,
    minimumPence: 5000,
    baseHours: 1.5,
    perBedroomHours: 0.75,
    perBathroomHours: 0.75,
    // How much longer each type of clean takes than a standard clean. 0 = always quote by hand.
    multipliers: { regular: 1, deep: 1.6, end_of_tenancy: 2, after_builders: 2.2, holiday_turnover: 1.1, commercial: 0 },
  },
  // Price of each extra, in pence. Used for one-off estimates and for extras added to a plan clean.
  extras: { oven: 4500, fridge: 2000, windows_in: 2000, carpets: 6000, upholstery: 5000, linen: 1000, ironing: 2000, cupboards: 2000 },
  // Percent of a one-off quote paid by card to secure the booking. 0 = no deposit.
  depositPercent: 25,
  // One-off bookings can be cancelled free with this much notice.
  cancelNoticeHours: 48,
  lateCancelPercent: 50,

  // ---- Referrals
  referralRewardPence: 1000, // credit for the existing customer, and money off for the new one

  // ---- What cleaners tick off on each type of job
  checklists: {
    regular: ['Dust all surfaces', 'Hoover all floors', 'Mop hard floors', 'Clean kitchen worktops, hob and sink', 'Clean bathrooms and toilets', 'Empty bins', 'Make beds / tidy'],
    deep: ['Everything in a standard clean', 'Skirting boards and doors', 'Light switches and handles', 'Inside microwave', 'Descale taps and shower', 'Behind and under furniture', 'Windowsills and frames'],
    end_of_tenancy: ['Everything in a deep clean', 'Inside all cupboards and drawers', 'Oven and hob degreased', 'Inside fridge and freezer', 'Walls spot-cleaned', 'Inside windows', 'Final photo of every room'],
    after_builders: ['Remove dust from all surfaces', 'Paint and plaster spots removed', 'Hoover and mop twice', 'Windows and frames', 'Debris removed'],
    holiday_turnover: ['Strip and remake beds', 'Fresh towels', 'Kitchen and bathrooms', 'Restock essentials', 'Check for damage', 'Photo of every room'],
    commercial: ['Desks and surfaces', 'Kitchen area', 'Toilets', 'Floors', 'Bins'],
  },
}

export function mergeSettings(stored) {
  const s = { ...DEFAULT_SETTINGS, ...stored }
  s.discounts = { ...DEFAULT_SETTINGS.discounts, ...stored?.discounts }
  s.oneOff = { ...DEFAULT_SETTINGS.oneOff, ...stored?.oneOff }
  s.oneOff.multipliers = { ...DEFAULT_SETTINGS.oneOff.multipliers, ...stored?.oneOff?.multipliers }
  s.extras = { ...DEFAULT_SETTINGS.extras, ...stored?.extras }
  s.checklists = { ...DEFAULT_SETTINGS.checklists, ...stored?.checklists }
  return s
}

export function frequencyLabel(visitsPerWeek, short = false) {
  const v = Number(visitsPerWeek)
  if (v === FORTNIGHTLY) return short ? 'Every 2 weeks' : 'every 2 weeks'
  return short ? `${v}× a week` : `${v} time${v === 1 ? '' : 's'} a week`
}

/** How many weekly start times a plan needs (fortnightly still needs one). */
export function slotsNeeded(visitsPerWeek) {
  return Math.max(1, Math.round(Number(visitsPerWeek)))
}

export function slotKey(slot) {
  return `${slot.day}-${slot.start}`
}

export function slotLabel(slot, long = false) {
  return `${(long ? DAY_NAMES_LONG : DAY_NAMES)[slot.day - 1]} ${slot.start}`
}

export function addHours(start, hours) {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Price of a plan, in pence. */
export function planPrice(settings, visitsPerWeek, hoursPerVisit) {
  const rate = Number(settings.hourlyRate) || 0
  const perVisitPence = Math.round(rate * hoursPerVisit * 100)
  const discountPct = Number((settings.discounts || {})[visitsPerWeek]) || 0
  const fullMonthly = perVisitPence * visitsPerWeek * WEEKS_PER_MONTH
  // Round the monthly charge to whole pounds so the bill looks tidy.
  const monthlyPence = Math.round((fullMonthly * (1 - discountPct / 100)) / 100) * 100
  const visitsPerMonth = visitsPerWeek * WEEKS_PER_MONTH
  return {
    perVisitPence,
    discountPct,
    monthlyPence,
    effectivePerVisitPence: Math.round(monthlyPence / visitsPerMonth),
    savingPence: Math.max(0, Math.round(fullMonthly) - monthlyPence),
  }
}

/** What one clean on an existing plan is worth (used for skip credits). */
export function planVisitValue(plan) {
  const visitsPerMonth = Number(plan.visits_per_week) * WEEKS_PER_MONTH
  return Math.round(Number(plan.monthly_pence) / visitsPerMonth)
}

/**
 * Combine the configured weekly slots with how many plans already use each one.
 * usage: array of { day, start, used }.
 */
export function slotAvailability(settings, usage) {
  const used = new Map((usage || []).map((u) => [slotKey(u), Number(u.used) || 0]))
  const capacity = Number(settings.slotCapacity) || 1
  return [...(settings.slots || [])]
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
    .map((s) => {
      const u = used.get(slotKey(s)) || 0
      return { day: s.day, start: s.start, used: u, remaining: Math.max(0, capacity - u) }
    })
}

/**
 * Check a customer's plan choice. Returns a list of problems (empty = valid).
 * availability is the output of slotAvailability().
 */
export function validatePlan(settings, availability, plan) {
  const errors = []
  const { visitsPerWeek, hoursPerVisit, slots } = plan || {}
  if (!(settings.visitsPerWeekOptions || []).includes(visitsPerWeek)) errors.push('Choose how often you would like a clean.')
  if (!(settings.hoursPerVisitOptions || []).includes(hoursPerVisit)) errors.push('Choose how long each clean lasts.')
  const need = slotsNeeded(visitsPerWeek)
  if (!Array.isArray(slots) || slots.length !== need) {
    errors.push(`Pick ${need} time${need === 1 ? '' : 's'} in the week.`)
    return errors
  }
  const days = new Set(slots.map((s) => s.day))
  if (days.size !== slots.length) errors.push('Pick a different day for each clean.')
  const byKey = new Map(availability.map((a) => [slotKey(a), a]))
  for (const s of slots) {
    const a = byKey.get(slotKey(s))
    if (!a) errors.push(`${slotLabel(s)} is not a bookable time.`)
    else if (a.remaining < 1) errors.push(`${slotLabel(s)} has just been taken. Please pick another time.`)
  }
  return errors
}

/** Outward part of a UK postcode: "KA7 2DG" → "KA7". */
export function postcodeOutward(postcode) {
  const p = String(postcode || '').toUpperCase().replace(/\s+/g, '')
  return p.length >= 5 ? p.slice(0, -3) : p
}

export function inServiceArea(settings, postcode) {
  const areas = (settings.serviceAreas || []).map((a) => String(a).toUpperCase().replace(/\s+/g, '')).filter(Boolean)
  if (!areas.length) return true
  const out = postcodeOutward(postcode)
  if (!/^[A-Z]{1,2}[0-9]/.test(out)) return false
  return areas.some((a) => (/[0-9]$/.test(a)
    ? out.startsWith(a) && !/[0-9]/.test(out.charAt(a.length))
    : out.startsWith(a) && /[0-9]/.test(out.charAt(a.length))))
}

const round5 = (pence) => Math.round(pence / 500) * 500

/**
 * Rough price range for a one-off clean, shown to the customer before they send the enquiry.
 * Returns null when the job is always quoted by hand (offices, unknown type).
 */
export function estimateOneOff(settings, e) {
  const o = settings.oneOff || {}
  const mult = Number((o.multipliers || {})[e.clean_type]) || 0
  if (!mult || e.property_type === 'office') return null
  const beds = Math.max(0, Number(e.bedrooms) || 0)
  const baths = Math.max(1, Number(e.bathrooms) || 1)
  const hours = (o.baseHours + beds * o.perBedroomHours + baths * o.perBathroomHours) * mult
  const labour = Math.max(Number(o.minimumPence) || 0, Math.round(hours * o.hourlyRate * 100))
  const extras = (e.extras || []).reduce((sum, id) => sum + (Number((settings.extras || {})[id]) || 0), 0)
  const mid = labour + extras
  return {
    hours: Math.round(hours * 2) / 2,
    lowPence: Math.max(Number(o.minimumPence) || 0, round5(mid * 0.9)),
    highPence: round5(mid * 1.15),
  }
}

export function depositFor(settings, quotePence) {
  const pct = Number(settings.depositPercent) || 0
  if (!pct || !quotePence) return 0
  return Math.min(quotePence, Math.round((quotePence * pct) / 100))
}

/** Apply a discount code row ({ percent_off } or { amount_off_pence }) to an amount in pence. */
export function applyDiscount(amountPence, code) {
  if (!code) return amountPence
  if (code.percent_off) return Math.max(0, Math.round(amountPence * (1 - code.percent_off / 100)))
  if (code.amount_off_pence) return Math.max(0, amountPence - code.amount_off_pence)
  return amountPence
}

export function formatPounds(pence) {
  const v = (Number(pence) || 0) / 100
  return '£' + v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })
}
