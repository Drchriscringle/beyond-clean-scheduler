// Card payment for a one-off clean: the deposit after accepting, or the balance afterwards.
import { cors, db, json, siteUrl, stripe } from '../_shared/server.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { token, origin } = await req.json()
    const supa = db()
    const { data: e } = await supa.from('enquiries').select('*').eq('token', token).maybeSingle()
    if (!e) return json({ error: 'Booking not found.' }, 404)

    let amount = 0
    let kind = ''
    if (e.status === 'awaiting_deposit') { amount = e.deposit_pence - e.paid_pence; kind = 'deposit' }
    else if (['booked', 'completed'].includes(e.status) && e.quote_pence) { amount = e.quote_pence - e.paid_pence; kind = 'balance' }
    if (amount < 30) return json({ error: 'There is nothing to pay right now.' }, 400)

    const base = siteUrl(origin)
    const session = await stripe('checkout/sessions', {
      mode: 'payment',
      customer_email: e.email,
      client_reference_id: e.id,
      metadata: { enquiry_id: e.id, kind },
      payment_intent_data: { metadata: { enquiry_id: e.id, kind } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: amount,
          product_data: { name: kind === 'deposit' ? 'Deposit for your clean' : 'Balance for your clean', description: `${e.address}, ${e.postcode} · ${e.booked_date}` },
        },
      }],
      success_url: `${base}#/enquiry/${e.token}?paid=1`,
      cancel_url: `${base}#/enquiry/${e.token}`,
    })
    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 500)
  }
})
