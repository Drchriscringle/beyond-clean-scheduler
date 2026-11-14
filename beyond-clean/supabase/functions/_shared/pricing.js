// Pure business rules shared by the web app (imported by Vite) and the
// Supabase Edge Functions (imported by Deno). No imports, no I/O, so the
// browser and the server always agree on prices and slot availability.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Average weeks in a month. A plan bills the same amount every month,
// averaged across the year, rather than charging more in 5-week months.
export const WEEKS_PER_MONTH = 52 / 12

export const DEFAULT_SETTINGS = {
  businessName: 'Beyond Clean Ltd',
  area: 'Ayrshire',
  phone: '',
  email: '',
  // Pounds per cleaner-hour for subscription plans.
  hourlyRate: 20,
  visitsPerWeekOptions: [1, 2, 3],
  hoursPerVisitOptions: [2, 3, 4],
  // Percent off the monthly price, keyed by visits per week.
  discounts: { 1: 0, 2: 5, 3: 10 },
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
  // Days the enquiry form will not offer (7 = Sunday).
  closedDays: [7],
}

export function mergeSettings(stored) {
  const s = { ...DEFAULT_SETTINGS, ...stored }
  s.discounts = { ...DEFAULT_SETTINGS.discounts, ...stored?.discounts }
  return s
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
  if (!(settings.visitsPerWeekOptions || []).includes(visitsPerWeek)) errors.push('Choose how many cleans per week.')
  if (!(settings.hoursPerVisitOptions || []).includes(hoursPerVisit)) errors.push('Choose how long each clean lasts.')
  if (!Array.isArray(slots) || slots.length !== visitsPerWeek) {
    errors.push(`Pick ${visitsPerWeek} time${visitsPerWeek === 1 ? '' : 's'} in the week.`)
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

export function formatPounds(pence) {
  const v = (Number(pence) || 0) / 100
  return '£' + v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })
}
