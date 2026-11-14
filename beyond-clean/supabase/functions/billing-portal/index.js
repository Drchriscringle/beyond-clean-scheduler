// "Update card, invoices or cancel" → Stripe's hosted customer portal.
import { cors, db, json, siteUrl, stripe } from '../_shared/server.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { token, origin } = await req.json()
    const { data: row } = await db().from('subscriptions').select('stripe_customer_id, token').eq('token', token).maybeSingle()
    if (!row?.stripe_customer_id) return json({ error: 'No payment details found for this plan yet.' }, 404)
    const portal = await stripe('billing_portal/sessions', {
      customer: row.stripe_customer_id,
      return_url: `${siteUrl(origin)}#/plan/${row.token}`,
    })
    return json({ url: portal.url })
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
})
