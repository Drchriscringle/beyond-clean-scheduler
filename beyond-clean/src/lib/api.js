// One data layer, two back ends:
//  - Supabase (real): used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
//  - Demo: everything lives in this browser's localStorage, payments are simulated.
//    Lets you click through the whole app before any accounts are set up.

import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, mergeSettings, planPrice, slotAvailability, validatePlan } from '../../supabase/functions/_shared/pricing.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const DEMO = !supabase

function check({ data, error }) {
  if (error) throw new Error(error.message || 'Something went wrong')
  return data
}

// ---------------------------------------------------------------- Supabase

const real = {
  async getSettings() {
    const data = check(await supabase.rpc('public_settings'))
    return mergeSettings(data)
  },
  async submitEnquiry(enquiry) {
    return { token: check(await supabase.rpc('submit_enquiry', { payload: enquiry })) }
  },
  async getEnquiry(token) {
    return check(await supabase.rpc('get_enquiry', { p_token: token }))
  },
  async respondToQuote(token, accept) {
    return check(await supabase.rpc('respond_to_quote', { p_token: token, p_accept: accept }))
  },
  async getSlotAvailability(settings) {
    const usage = check(await supabase.rpc('slot_usage'))
    return slotAvailability(settings, usage)
  },
  async startPlan(plan) {
    const data = check(await supabase.functions.invoke('create-checkout', { body: { ...plan, origin: siteBase() } }))
    if (data && data.error) throw new Error(data.error)
    return data // { url }
  },
  async getPlan(token) {
    return check(await supabase.rpc('get_subscription', { p_token: token }))
  },
  async openBillingPortal(token) {
    const data = check(await supabase.functions.invoke('billing-portal', { body: { token, origin: siteBase() } }))
    if (data && data.error) throw new Error(data.error)
    window.location.href = data.url
  },

  // ---- owner
  async getSession() {
    return (await supabase.auth.getSession()).data.session
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    check(await supabase.auth.signInWithPassword({ email, password }))
    const ok = check(await supabase.rpc('is_admin'))
    if (!ok) {
      await supabase.auth.signOut()
      throw new Error('This account is not set up as the Beyond Clean owner.')
    }
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  async listEnquiries() {
    return check(await supabase.from('enquiries').select('*').order('created_at', { ascending: false }))
  },
  async updateEnquiry(id, patch) {
    return check(await supabase.from('enquiries').update(patch).eq('id', id).select().single())
  },
  async listPlans() {
    return check(await supabase.from('subscriptions').select('*').order('created_at', { ascending: false }))
  },
  async updatePlan(id, patch) {
    return check(await supabase.from('subscriptions').update(patch).eq('id', id).select().single())
  },
  async saveSettings(settings) {
    check(await supabase.from('settings').upsert({ id: 1, data: settings }))
  },
  /** Calls cb({ table, type, record }) when an enquiry or plan is created or changed. */
  watch(cb) {
    const channel = supabase
      .channel('owner-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, (p) =>
        cb({ table: 'enquiries', type: p.eventType, record: p.new }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, (p) =>
        cb({ table: 'subscriptions', type: p.eventType, record: p.new }))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}

// ---------------------------------------------------------------- Demo

const DB_KEY = 'beyondclean_demo_v1'
const listeners = new Set()

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage unavailable */ }
  return { settings: DEFAULT_SETTINGS, enquiries: [], subscriptions: [], admin: false }
}
function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* storage unavailable */ }
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function emit(evt) {
  listeners.forEach((cb) => cb(evt))
  // Also tell other tabs (e.g. the owner inbox open next to the customer form).
  try { localStorage.setItem(DB_KEY + '_ping', JSON.stringify({ ...evt, at: Date.now() })) } catch { /* ignore */ }
}
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

const demo = {
  async getSettings() {
    return mergeSettings(loadDb().settings)
  },
  async submitEnquiry(enquiry) {
    await wait()
    const db = loadDb()
    const row = { ...enquiry, id: uuid(), token: uuid(), status: 'new', created_at: new Date().toISOString() }
    db.enquiries.unshift(row)
    saveDb(db)
    emit({ table: 'enquiries', type: 'INSERT', record: row })
    return { token: row.token }
  },
  async getEnquiry(token) {
    await wait(100)
    return loadDb().enquiries.find((e) => e.token === token) || null
  },
  async respondToQuote(token, accept) {
    const db = loadDb()
    const row = db.enquiries.find((e) => e.token === token)
    if (!row || row.status !== 'replied') throw new Error('This quote can no longer be changed.')
    row.status = accept ? 'booked' : 'declined'
    row.accepted_at = accept ? new Date().toISOString() : null
    row.customer_declined = !accept
    saveDb(db)
    emit({ table: 'enquiries', type: 'UPDATE', record: row })
    return row
  },
  async getSlotAvailability(settings) {
    const usage = {}
    for (const s of loadDb().subscriptions) {
      if (!['active', 'past_due', 'paused'].includes(s.status)) continue
      for (const slot of s.slots) {
        const k = `${slot.day}-${slot.start}`
        usage[k] = usage[k] || { day: slot.day, start: slot.start, used: 0 }
        usage[k].used += 1
      }
    }
    return slotAvailability(settings, Object.values(usage))
  },
  async startPlan(plan) {
    await wait(400)
    const settings = await demo.getSettings()
    const availability = await demo.getSlotAvailability(settings)
    const errors = validatePlan(settings, availability, plan)
    if (errors.length) throw new Error(errors.join(' '))
    const db = loadDb()
    const price = planPrice(settings, plan.visitsPerWeek, plan.hoursPerVisit)
    const row = {
      id: uuid(), token: uuid(), created_at: new Date().toISOString(), status: 'active',
      name: plan.name, email: plan.email, phone: plan.phone, address: plan.address, postcode: plan.postcode,
      notes: plan.notes, start_date: plan.startDate,
      visits_per_week: plan.visitsPerWeek, hours_per_visit: plan.hoursPerVisit, slots: plan.slots,
      monthly_pence: price.monthlyPence,
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
    }
    db.subscriptions.unshift(row)
    saveDb(db)
    emit({ table: 'subscriptions', type: 'INSERT', record: row })
    // A real deployment sends the customer to Stripe here.
    return { url: `#/plan/${row.token}?paid=1` }
  },
  async getPlan(token) {
    await wait(100)
    return loadDb().subscriptions.find((s) => s.token === token) || null
  },
  async openBillingPortal() {
    alert('Demo mode: in the live app this opens Stripe, where the customer can update their card, download invoices or cancel.')
  },

  async getSession() {
    return loadDb().admin ? { user: { email: 'owner@demo' } } : null
  },
  onAuthChange() { return () => {} },
  async signIn() {
    const db = loadDb(); db.admin = true; saveDb(db)
  },
  async signOut() {
    const db = loadDb(); db.admin = false; saveDb(db)
  },
  async listEnquiries() {
    return loadDb().enquiries
  },
  async updateEnquiry(id, patch) {
    const db = loadDb()
    const row = db.enquiries.find((e) => e.id === id)
    Object.assign(row, patch)
    saveDb(db)
    return row
  },
  async listPlans() {
    return loadDb().subscriptions
  },
  async updatePlan(id, patch) {
    const db = loadDb()
    const row = db.subscriptions.find((s) => s.id === id)
    Object.assign(row, patch)
    saveDb(db)
    return row
  },
  async saveSettings(settings) {
    const db = loadDb(); db.settings = settings; saveDb(db)
  },
  watch(cb) {
    listeners.add(cb)
    const onStorage = (e) => {
      if (e.key === DB_KEY + '_ping' && e.newValue) {
        try { cb(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage) }
  },
}

/** The address of this app (without the #/route part), used for links back from Stripe. */
export function siteBase() {
  return window.location.href.split('#')[0]
}

export const api = DEMO ? demo : real
