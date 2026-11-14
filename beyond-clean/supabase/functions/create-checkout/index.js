// Customer picks a plan → validate it, hold the slots, and open a Stripe Checkout page.
import { cors, db, json, loadSettings, siteUrl, stripe } from '../_shared/server.js'
import { frequencyLabel, inServiceArea, planPrice, slotAvailability, slotLabel, slotsNeeded, validatePlan } from '../_shared/pricing.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    const supa = db()
    const settings = await loadSettings(supa)
    const { data: usage, error: usageErr } = await supa.rpc('slot_usage')
    if (usageErr) throw usageErr

    const plan = {
      visitsPerWeek: Number(b.visitsPerWeek),
      hoursPerVisit: Number(b.hoursPerVisit),
      slots: (b.slots || []).slice(0, 7).map((s) => ({ day: Number(s.day), start: String(s.start) })),
    }
    const errors = validatePlan(settings, slotAvailability(settings, usage), plan)
    for (const k of ['name', 'email', 'phone', 'address', 'postcode']) {
      if (!String(b[k] || '').trim()) errors.push(`Missing ${k}.`)
    }
    if (!inServiceArea(settings, b.postcode)) errors.push("Sorry, we don't cover that postcode yet.")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ''))) errors.push('Choose a start date.')
    if (errors.length) return json({ error: errors.join(' ') }, 400)

    // Discount or friend's referral code.
    let code = null
    if (b.discountCode) {
      const { data } = await supa.rpc('check_discount', { p_code: b.discountCode, p_for: 'plan' })
      if (!data?.valid) return json({ error: data?.message || 'That code is not valid.' }, 400)
      code = data
    }

    const price = planPrice(settings, plan.visitsPerWeek, plan.hoursPerVisit)
    const access = typeof b.access === 'object' && b.access ? b.access : {}
    const { data: row, error } = await supa.from('subscriptions').insert({
      name: String(b.name).slice(0, 120), email: String(b.email).slice(0, 200), phone: String(b.phone).slice(0, 40),
      address: String(b.address).slice(0, 300), postcode: String(b.postcode).toUpperCase().slice(0, 12),
      notes: String(b.notes || '').slice(0, 2000), start_date: b.startDate, access,
      visits_per_week: plan.visitsPerWeek, hours_per_visit: plan.hoursPerVisit, slots: plan.slots.slice(0, slotsNeeded(plan.visitsPerWeek)),
      monthly_pence: price.monthlyPence,
      discount_code: code?.kind === 'code' ? code.code : null,
      referred_by_code: code?.kind === 'referral' ? code.code : null,
    }).select().single()
    if (error) throw error

    let discounts
    if (code) {
      const coupon = await stripe('coupons', {
        duration: code.first_payment_only ? 'once' : 'forever',
        ...(code.percent_off ? { percent_off: code.percent_off } : { amount_off: code.amount_off_pence, currency: 'gbp' }),
        name: code.description?.slice(0, 40) || code.code,
      })
      discounts = [{ coupon: coupon.id }]
    }

    const base = siteUrl(b.origin)
    const times = plan.slots.map((s) => slotLabel(s)).join(', ')
    const session = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer_email: row.email,
      client_reference_id: row.id,
      metadata: { subscription_row: row.id },
      subscription_data: { metadata: { subscription_row: row.id } },
      discounts,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: price.monthlyPence,
          recurring: { interval: 'month' },
          product_data: {
            name: `Cleaning plan: ${plan.hoursPerVisit} hrs, ${frequencyLabel(plan.visitsPerWeek)}`,
            description: `Cleans: ${times}. ${row.address}, ${row.postcode}`,
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
