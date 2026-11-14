// One data layer, two back ends:
//  - Supabase (real): used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
//  - Demo: everything lives in this browser's localStorage, payments are simulated.
//    Lets you click through the whole app before any accounts are set up.

import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_SETTINGS, depositFor, inServiceArea, mergeSettings, planPrice, slotAvailability, slotsNeeded, validatePlan,
} from '../../supabase/functions/_shared/pricing.js'
import { decidePlanAction } from '../../supabase/functions/_shared/actions.js'
import { hoursUntil } from '../../supabase/functions/_shared/schedule.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const DEMO = !supabase

function check({ data, error }) {
  if (error) throw new Error(error.message || 'Something went wrong')
  return data
}
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // Edge functions return { error } with a 4xx; surface that message.
    try { const j = await error.context.json(); if (j?.error) throw new Error(j.error) } catch (e) { if (e.message) throw e }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** The address of this app (without the #/route part), used for links back from Stripe. */
export function siteBase() {
  return window.location.href.split('#')[0].split('?')[0]
}

// ======================================================================== Supabase

const real = {
  // ---------------- public
  async getSettings() { return mergeSettings(check(await supabase.rpc('public_settings'))) },
  async getPublicReviews() { return check(await supabase.rpc('public_reviews')) },
  async checkDiscount(code, kind) { return check(await supabase.rpc('check_discount', { p_code: code, p_for: kind })) },

  async uploadEnquiryPhoto(blob, folder, i) {
    const path = `new/${folder}/${i}.jpg`
    check(await supabase.storage.from('enquiry-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
    return path
  },
  async submitEnquiry(enquiry) { return { token: check(await supabase.rpc('submit_enquiry', { payload: enquiry })) } },
  async getEnquiry(token) { return check(await supabase.rpc('get_enquiry', { p_token: token })) },
  async respondToQuote(token, accept) { return check(await supabase.rpc('respond_to_quote', { p_token: token, p_accept: accept })) },
  async cancelBooking(token) { return check(await supabase.rpc('cancel_booking', { p_token: token })) },
  async payQuote(token) {
    const { url } = await invoke('pay-quote', { token, origin: siteBase() })
    window.location.href = url
  },
  async updateAccess(token, access) { check(await supabase.rpc('update_access', { p_token: token, p_access: access })) },

  async getSlotAvailability(settings) { return slotAvailability(settings, check(await supabase.rpc('slot_usage'))) },
  async startPlan(plan) { return invoke('create-checkout', { ...plan, origin: siteBase() }) },
  async getPlan(token) { return check(await supabase.rpc('get_subscription', { p_token: token })) },
  async planAction(token, req) { return invoke('plan-action', { token, ...req }) },
  async openBillingPortal(token) {
    const { url } = await invoke('billing-portal', { token, origin: siteBase() })
    window.location.href = url
  },
  async submitReview(token, rating, comment, date, fix) {
    check(await supabase.rpc('submit_review', { p_token: token, p_rating: rating, p_comment: comment, p_visit_date: date || null, p_fix: fix }))
  },

  // ---------------- sign in (owner, cleaners and customers share Supabase Auth)
  async getSession() { return (await supabase.auth.getSession()).data.session },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) { check(await supabase.auth.signInWithPassword({ email, password })) },
  async signOut() { await supabase.auth.signOut() },
  async isAdmin() { return !!check(await supabase.rpc('is_admin')) },
  async sendCode(email) {
    check(await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: siteBase() + '#/account' } }))
  },
  async verifyCode(email, token) { check(await supabase.auth.verifyOtp({ email, token, type: 'email' })) },

  // ---------------- customer account
  async getAccount() { return check(await supabase.rpc('my_account')) },
  async saveProperty(p) { return check(await supabase.rpc('save_property', { p })) },
  async deleteProperty(id) { check(await supabase.rpc('delete_property', { p_id: id })) },

  // ---------------- owner
  async listEnquiries() { return check(await supabase.from('enquiries').select('*').order('created_at', { ascending: false })) },
  async updateEnquiry(id, patch) { return check(await supabase.from('enquiries').update(patch).eq('id', id).select().single()) },
  async listPlans() { return check(await supabase.from('subscriptions').select('*').order('created_at', { ascending: false })) },
  async updatePlan(id, patch) { return check(await supabase.from('subscriptions').update(patch).eq('id', id).select().single()) },
  async listChanges() { return check(await supabase.from('plan_changes').select('*').order('created_at')) },
  async addChange(row) { return check(await supabase.from('plan_changes').insert({ ...row, made_by: 'owner' }).select().single()) },
  async updateChange(id, patch) { return check(await supabase.from('plan_changes').update(patch).eq('id', id).select().single()) },
  async deleteChange(id) { check(await supabase.from('plan_changes').delete().eq('id', id)) },
  async listCleaners() { return check(await supabase.from('cleaners').select('*').order('name')) },
  async saveCleaner(c) {
    const { id, ...rest } = c
    return id
      ? check(await supabase.from('cleaners').update(rest).eq('id', id).select().single())
      : check(await supabase.from('cleaners').insert(rest).select().single())
  },
  async listLogs(from, to) { return check(await supabase.from('job_logs').select('*').gte('job_date', from).lte('job_date', to)) },
  async listReviews() { return check(await supabase.from('reviews').select('*').order('created_at', { ascending: false })) },
  async updateReview(id, patch) { return check(await supabase.from('reviews').update(patch).eq('id', id).select().single()) },
  async listCodes() { return check(await supabase.from('discount_codes').select('*').order('created_at', { ascending: false })) },
  async saveCode(c) { return check(await supabase.from('discount_codes').upsert(c).select().single()) },
  async deleteCode(code) { check(await supabase.from('discount_codes').delete().eq('code', code)) },
  async saveSettings(settings) { check(await supabase.from('settings').upsert({ id: 1, data: settings })) },
  async photoUrl(bucket, path) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
    return data?.signedUrl
  },
  async calendarLinks() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${url}/functions/v1/calendar?links=1`, { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: key } })
    return res.json()
  },
  watch(cb) {
    const channel = supabase.channel('owner-feed')
    for (const table of ['enquiries', 'subscriptions', 'plan_changes', 'reviews']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => cb({ table, type: p.eventType, record: p.new }))
    }
    channel.subscribe()
    return () => supabase.removeChannel(channel)
  },

  // ---------------- cleaner
  async cleanerSchedule() { return check(await supabase.rpc('cleaner_schedule')) },
  async myLogs() { return check(await supabase.from('job_logs').select('*').gte('job_date', new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10))) },
  async saveLog(log) { return check(await supabase.from('job_logs').upsert(log, { onConflict: 'job_key' }).select().single()) },
  async uploadJobPhoto(blob, jobKey, name) {
    const path = `${jobKey.replace(/:/g, '_')}/${name}-${Date.now()}.jpg`
    check(await supabase.storage.from('job-photos').upload(path, blob, { contentType: 'image/jpeg' }))
    return path
  },
}

// ======================================================================== Demo

const DB_KEY = 'beyondclean_demo_v2'
const listeners = new Set()

function blank() {
  return {
    settings: DEFAULT_SETTINGS, enquiries: [], subscriptions: [], changes: [], cleaners: [
      { id: 'demo-zara', name: 'Zara', phone: '07700 900111', hourly_wage_pence: 1250, colour: '#2a7fc4', active: true },
      { id: 'demo-chris', name: 'Chris', phone: '07700 900222', hourly_wage_pence: 1250, colour: '#6fa52a', active: true },
    ],
    logs: [], reviews: [], codes: [
      { code: 'WELCOME10', description: '10% off your first clean', percent_off: 10, applies_to: 'any', first_payment_only: true, active: true, uses: 0, created_at: new Date().toISOString() },
    ], properties: [], session: null,
  }
}
function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return { ...blank(), ...JSON.parse(raw) }
  } catch { /* storage unavailable */ }
  return blank()
}
function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { throw new Error('This device is out of demo storage. Try fewer photos.') }
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function emit(evt) {
  listeners.forEach((cb) => cb(evt))
  try { localStorage.setItem(DB_KEY + '_ping', JSON.stringify({ ...evt, at: Date.now() })) } catch { /* ignore */ }
}
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()
const strip = (e) => { const { owner_notes: _a, cleaner_id: _b, ...rest } = e; return rest }
function planPublic(db, s) {
  const { owner_notes: _a, stripe_customer_id: _b, stripe_subscription_id: _c, ...rest } = s
  return { ...rest, changes: db.changes.filter((c) => c.subscription_id === s.id && c.kind !== 'cover') }
}
function update(table, id, patch, idKey = 'id') {
  const db = loadDb()
  const row = db[table].find((r) => r[idKey] === id)
  if (!row) throw new Error('Not found')
  Object.assign(row, patch)
  saveDb(db)
  return row
}
function referralCode(name) {
  return (String(name).split(' ')[0].replace(/[^A-Za-z]/g, '').slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6)).toUpperCase()
}

const demo = {
  async getSettings() { return mergeSettings(loadDb().settings) },
  async getPublicReviews() {
    const pub = loadDb().reviews.filter((r) => r.published)
    return {
      average: pub.length ? Math.round((pub.reduce((s, r) => s + r.rating, 0) / pub.length) * 10) / 10 : null,
      count: pub.length,
      items: pub.slice(0, 6).map((r) => ({ ...r, name: r.name.split(' ')[0] + (r.name.split(' ')[1] ? ` ${r.name.split(' ')[1][0]}.` : '') })),
    }
  },
  async checkDiscount(code, kind) {
    const db = loadDb()
    const c = db.codes.find((x) => x.code === code.trim().toUpperCase())
    if (c) {
      if (!c.active || (c.max_uses && c.uses >= c.max_uses) || (c.applies_to !== 'any' && c.applies_to !== kind)) return { valid: false, message: 'That code has expired or does not apply here.' }
      return { valid: true, kind: 'code', ...c, description: c.description || (c.percent_off ? `${c.percent_off}% off` : `£${c.amount_off_pence / 100} off`) }
    }
    const friend = db.subscriptions.find((s) => s.referral_code === code.trim().toUpperCase() && s.status === 'active')
    if (friend) {
      const reward = mergeSettings(db.settings).referralRewardPence
      return { valid: true, kind: 'referral', code: friend.referral_code, amount_off_pence: reward, first_payment_only: true, description: `£${reward / 100} off from a friend` }
    }
    return { valid: false, message: "We don't recognise that code." }
  },
  async uploadEnquiryPhoto(blob) {
    // Demo: keep a small copy inside the enquiry itself.
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
  },
  async submitEnquiry(enquiry) {
    await wait()
    const db = loadDb()
    const row = { ...enquiry, id: uuid(), token: uuid(), status: 'new', created_at: now(), deposit_pence: 0, paid_pence: 0, discount_code: enquiry.discount_code?.toUpperCase() || null }
    db.enquiries.unshift(row)
    saveDb(db)
    emit({ table: 'enquiries', type: 'INSERT', record: row })
    return { token: row.token }
  },
  async getEnquiry(token) { await wait(80); const e = loadDb().enquiries.find((x) => x.token === token); return e ? strip(e) : null },
  async respondToQuote(token, accept) {
    const db = loadDb()
    const row = db.enquiries.find((e) => e.token === token)
    if (!row || row.status !== 'replied') throw new Error('This quote can no longer be changed.')
    row.status = !accept ? 'declined' : row.deposit_pence > row.paid_pence ? 'awaiting_deposit' : 'booked'
    row.accepted_at = accept ? now() : null
    row.customer_declined = !accept
    const code = row.discount_code && db.codes.find((c) => c.code === row.discount_code)
    if (accept && code) code.uses += 1
    saveDb(db)
    emit({ table: 'enquiries', type: 'UPDATE', record: row })
    return strip(row)
  },
  async cancelBooking(token) {
    const db = loadDb()
    const row = db.enquiries.find((e) => e.token === token)
    if (!row || !['booked', 'awaiting_deposit'].includes(row.status)) throw new Error('This booking can no longer be cancelled online. Please call us.')
    row.status = 'cancelled'
    row.cancelled_at = now()
    row.late_cancel = hoursUntil(row.booked_date, row.booked_time || '09:00') < mergeSettings(db.settings).cancelNoticeHours
    saveDb(db)
    emit({ table: 'enquiries', type: 'UPDATE', record: row })
    return strip(row)
  },
  async payQuote(token) {
    await wait(400)
    const db = loadDb()
    const e = db.enquiries.find((x) => x.token === token)
    const due = e.status === 'awaiting_deposit' ? e.deposit_pence - e.paid_pence : e.quote_pence - e.paid_pence
    e.paid_pence += due
    if (e.status === 'awaiting_deposit') e.status = 'booked'
    saveDb(db)
    emit({ table: 'enquiries', type: 'UPDATE', record: e })
    window.location.hash = `#/enquiry/${token}?paid=1`
  },
  async updateAccess(token, access) {
    const db = loadDb()
    for (const r of [...db.subscriptions, ...db.enquiries]) if (r.token === token) r.access = access
    saveDb(db)
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
    const errors = validatePlan(settings, await demo.getSlotAvailability(settings), plan)
    if (!inServiceArea(settings, plan.postcode)) errors.push("Sorry, we don't cover that postcode yet.")
    if (errors.length) throw new Error(errors.join(' '))
    let code = null
    if (plan.discountCode) {
      code = await demo.checkDiscount(plan.discountCode, 'plan')
      if (!code.valid) throw new Error(code.message)
    }
    const db = loadDb()
    const price = planPrice(settings, plan.visitsPerWeek, plan.hoursPerVisit)
    const row = {
      id: uuid(), token: uuid(), created_at: now(), status: 'active',
      name: plan.name, email: plan.email, phone: plan.phone, address: plan.address, postcode: plan.postcode,
      notes: plan.notes, start_date: plan.startDate, access: plan.access || {},
      visits_per_week: plan.visitsPerWeek, hours_per_visit: plan.hoursPerVisit, slots: plan.slots.slice(0, slotsNeeded(plan.visitsPerWeek)),
      monthly_pence: price.monthlyPence, referral_code: referralCode(plan.name),
      discount_code: code?.kind === 'code' ? code.code : null, referred_by_code: code?.kind === 'referral' ? code.code : null,
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(), stripe_customer_id: 'demo',
    }
    db.subscriptions.unshift(row)
    if (code?.kind === 'code') db.codes.find((c) => c.code === code.code).uses += 1
    saveDb(db)
    emit({ table: 'subscriptions', type: 'INSERT', record: row })
    return { url: `#/plan/${row.token}?paid=1` }
  },
  async getPlan(token) {
    await wait(80)
    const db = loadDb()
    const s = db.subscriptions.find((x) => x.token === token)
    return s ? planPublic(db, s) : null
  },
  async planAction(token, req) {
    await wait(250)
    const db = loadDb()
    const plan = db.subscriptions.find((s) => s.token === token)
    const settings = mergeSettings(db.settings)
    const result = decidePlanAction(settings, plan, db.changes.filter((c) => c.subscription_id === plan.id), req)
    if (result.error) throw new Error(result.error)
    for (const ins of result.inserts) {
      const row = { id: uuid(), created_at: now(), status: 'done', ...ins }
      db.changes.push(row)
      emit({ table: 'plan_changes', type: 'INSERT', record: row })
    }
    db.changes = db.changes.filter((c) => !result.deletes.includes(c.id))
    saveDb(db)
    return { message: result.message, plan: planPublic(db, plan) }
  },
  async openBillingPortal() {
    alert('Demo mode: in the live app this opens Stripe, where the customer can update their card, download invoices or cancel.')
  },
  async submitReview(token, rating, comment, date, fix) {
    await wait()
    const db = loadDb()
    const who = db.enquiries.find((e) => e.token === token) || db.subscriptions.find((s) => s.token === token)
    if (!who) throw new Error('We could not find that clean.')
    let r = db.reviews.find((x) => x.ref_token === token && (x.visit_date || '') === (date || ''))
    if (!r) {
      r = { id: uuid(), created_at: now(), ref_token: token, kind: who.monthly_pence ? 'plan' : 'oneoff', visit_date: date || null, name: who.name, published: false }
      db.reviews.unshift(r)
    }
    Object.assign(r, { rating, comment, fix_requested: fix || r.fix_requested, fix_status: fix ? r.fix_status || 'open' : r.fix_status || null })
    saveDb(db)
    emit({ table: 'reviews', type: 'INSERT', record: r })
  },

  // ---------------- sign in
  async getSession() {
    const s = loadDb().session
    return s ? { user: { email: s.email }, role: s.role, cleanerId: s.cleanerId } : null
  },
  onAuthChange() { return () => {} },
  async signIn(email) {
    const db = loadDb()
    const cleaner = db.cleaners.find((c) => c.name.toLowerCase() === String(email).toLowerCase() || c.id === email)
    db.session = cleaner ? { role: 'cleaner', email: cleaner.name, cleanerId: cleaner.id } : { role: 'owner', email: 'owner@demo' }
    saveDb(db)
  },
  async signOut() { const db = loadDb(); db.session = null; saveDb(db) },
  async isAdmin() { return loadDb().session?.role === 'owner' },
  async sendCode() { await wait() },
  async verifyCode(email, code) {
    if (code !== '123456') throw new Error('Demo mode: the code is 123456.')
    const db = loadDb(); db.session = { role: 'customer', email: email.toLowerCase() }; saveDb(db)
  },

  // ---------------- customer account
  async getAccount() {
    const db = loadDb()
    const email = db.session?.role === 'customer' ? db.session.email : null
    if (!email) return null
    return {
      email,
      enquiries: db.enquiries.filter((e) => e.email.toLowerCase() === email).map(strip),
      plans: db.subscriptions.filter((s) => s.email.toLowerCase() === email && s.status !== 'pending_payment').map((s) => planPublic(db, s)),
      properties: db.properties.filter((p) => p.email === email),
    }
  },
  async saveProperty(p) {
    const db = loadDb()
    const email = db.session?.email
    if (!p.label?.trim() || !p.address?.trim() || !p.postcode?.trim()) throw new Error('Please add a name, address and postcode.')
    if (p.id) Object.assign(db.properties.find((x) => x.id === p.id), p)
    else db.properties.push({ ...p, id: uuid(), email, created_at: now(), postcode: p.postcode.toUpperCase() })
    saveDb(db)
  },
  async deleteProperty(id) { const db = loadDb(); db.properties = db.properties.filter((p) => p.id !== id); saveDb(db) },

  // ---------------- owner
  async listEnquiries() { return loadDb().enquiries },
  async updateEnquiry(id, patch) { const r = update('enquiries', id, patch); emit({ table: 'enquiries', type: 'UPDATE', record: r, byOwner: true }); return r },
  async listPlans() { return loadDb().subscriptions },
  async updatePlan(id, patch) { return update('subscriptions', id, patch) },
  async listChanges() { return loadDb().changes },
  async addChange(row) {
    const db = loadDb()
    const dupe = ['skip', 'cover'].includes(row.kind) && db.changes.find((c) => c.kind === row.kind && c.subscription_id === row.subscription_id && c.visit_date === row.visit_date && c.visit_start === row.visit_start)
    if (dupe) db.changes = db.changes.filter((c) => c !== dupe)
    const r = { id: uuid(), created_at: now(), status: 'done', made_by: 'owner', credit_pence: 0, amount_pence: 0, ...row }
    db.changes.push(r)
    saveDb(db)
    return r
  },
  async updateChange(id, patch) { return update('changes', id, patch) },
  async deleteChange(id) { const db = loadDb(); db.changes = db.changes.filter((c) => c.id !== id); saveDb(db) },
  async listCleaners() { return loadDb().cleaners },
  async saveCleaner(c) {
    const db = loadDb()
    if (c.id) Object.assign(db.cleaners.find((x) => x.id === c.id), c)
    else db.cleaners.push({ active: true, colour: '#2a7fc4', hourly_wage_pence: 1200, ...c, id: uuid() })
    saveDb(db)
  },
  async listLogs(from, to) { return loadDb().logs.filter((l) => l.job_date >= from && l.job_date <= to) },
  async listReviews() { return loadDb().reviews },
  async updateReview(id, patch) { return update('reviews', id, patch) },
  async listCodes() { return loadDb().codes },
  async saveCode(c) {
    const db = loadDb()
    const ex = db.codes.find((x) => x.code === c.code)
    if (ex) Object.assign(ex, c)
    else db.codes.unshift({ uses: 0, created_at: now(), ...c })
    saveDb(db)
  },
  async deleteCode(code) { const db = loadDb(); db.codes = db.codes.filter((c) => c.code !== code); saveDb(db) },
  async saveSettings(settings) { const db = loadDb(); db.settings = settings; saveDb(db) },
  async photoUrl(_bucket, path) { return path },
  async calendarLinks() {
    return { owner: 'https://YOUR-PROJECT.supabase.co/functions/v1/calendar?key=…', cleaners: loadDb().cleaners.map((c) => ({ id: c.id, name: c.name, url: `https://YOUR-PROJECT.supabase.co/functions/v1/calendar?cleaner=${c.id}&key=…` })), demo: true }
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

  // ---------------- cleaner
  async cleanerSchedule() {
    const db = loadDb()
    const me = db.cleaners.find((c) => c.id === db.session?.cleanerId)
    if (!me) return null
    const plans = db.subscriptions.filter((s) => ['active', 'past_due', 'paused'].includes(s.status)
      && (s.cleaner_id === me.id || db.changes.some((c) => c.subscription_id === s.id && c.kind === 'cover' && c.cleaner_id === me.id)))
    return {
      me: { id: me.id, name: me.name },
      plans,
      changes: db.changes.filter((c) => plans.some((p) => p.id === c.subscription_id)),
      enquiries: db.enquiries.filter((e) => e.cleaner_id === me.id && ['booked', 'completed'].includes(e.status)),
    }
  },
  async myLogs() { const db = loadDb(); return db.logs.filter((l) => l.cleaner_id === db.session?.cleanerId) },
  async saveLog(log) {
    const db = loadDb()
    const ex = db.logs.find((l) => l.job_key === log.job_key)
    if (ex) Object.assign(ex, log)
    else db.logs.push({ id: uuid(), created_at: now(), checklist: {}, photos_before: [], photos_after: [], ...log })
    saveDb(db)
    return db.logs.find((l) => l.job_key === log.job_key)
  },
  async uploadJobPhoto(blob) { return demo.uploadEnquiryPhoto(blob) },
}

export const api = DEMO ? demo : real
export { depositFor }
