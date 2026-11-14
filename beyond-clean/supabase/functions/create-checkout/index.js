// Customer picks a plan → validate it, hold the slots, and open a Stripe Checkout page.
import { cors, db, json, siteUrl, stripe } from '../_shared/server.js'
import { mergeSettings, planPrice, slotAvailability, slotLabel, validatePlan } from '../_shared/pricing.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    const supa = db()

    const { data: settingsRow } = await supa.from('settings').select('data').eq('id', 1).single()
    const settings = mergeSettings(settingsRow?.data)
    const { data: usage, error: usageErr } = await supa.rpc('slot_usage')
    if (usageErr) throw usageErr

    const plan = {
      visitsPerWeek: Number(b.visitsPerWeek),
      hoursPerVisit: Number(b.hoursPerVisit),
      slots: (b.slots || []).map((s) => ({ day: Number(s.day), start: String(s.start) })),
    }
    const errors = validatePlan(settings, slotAvailability(settings, usage), plan)
    for (const k of ['name', 'email', 'phone', 'address', 'postcode']) {
      if (!String(b[k] || '').trim()) errors.push(`Missing ${k}.`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ''))) errors.push('Choose a start date.')
    if (errors.length) return json({ error: errors.join(' ') }, 400)

    const price = planPrice(settings, plan.visitsPerWeek, plan.hoursPerVisit)
    const { data: row, error } = await supa.from('subscriptions').insert({
      name: String(b.name).slice(0, 120), email: String(b.email).slice(0, 200), phone: String(b.phone).slice(0, 40),
      address: String(b.address).slice(0, 300), postcode: String(b.postcode).toUpperCase().slice(0, 12),
      notes: String(b.notes || '').slice(0, 2000), start_date: b.startDate,
      visits_per_week: plan.visitsPerWeek, hours_per_visit: plan.hoursPerVisit, slots: plan.slots,
      monthly_pence: price.monthlyPence,
    }).select().single()
    if (error) throw error

    const base = siteUrl(b.origin)
    const times = plan.slots.map((s) => slotLabel(s)).join(', ')
    const session = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer_email: row.email,
      client_reference_id: row.id,
      metadata: { subscription_row: row.id },
      subscription_data: { metadata: { subscription_row: row.id } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: price.monthlyPence,
          recurring: { interval: 'month' },
          product_data: {
            name: `Cleaning plan: ${plan.visitsPerWeek}× ${plan.hoursPerVisit} hrs a week`,
            description: `Weekly cleans: ${times}. ${row.address}, ${row.postcode}`,
          },
        },
      }],
      success_url: `${base}#/plan/${row.token}?paid=1`,
      cancel_url: `${base}#/plans`,
    })
    await supa.from('subscriptions').update({ stripe_checkout_session_id: session.id }).eq('id', row.id)
    return json({ url: session.url })
  } catch (e) {
    console.error(e)
    return json({ error: e.message || 'Could not start payment' }, 500)
  }
})
