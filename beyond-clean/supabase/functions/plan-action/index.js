// Customer skips, moves, pauses or adds an extra to a plan clean.
// Credits and extras go straight onto their next Stripe bill.
import { cors, db, json, loadSettings, stripeBalance, stripeInvoiceItem } from '../_shared/server.js'
import { decidePlanAction } from '../_shared/actions.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const supa = db()
    const settings = await loadSettings(supa)
    const { data: plan } = await supa.from('subscriptions').select('*').eq('token', body.token).maybeSingle()
    if (!plan) return json({ error: 'Plan not found.' }, 404)
    const { data: changes } = await supa.from('plan_changes').select('*').eq('subscription_id', plan.id)

    const result = decidePlanAction(settings, plan, changes || [], body)
    if (result.error) return json({ error: result.error }, 400)

    if (result.inserts.length) {
      const { error } = await supa.from('plan_changes').insert(result.inserts)
      if (error) return json({ error: error.code === '23505' ? 'That clean has already been changed.' : error.message }, 400)
    }
    if (result.deletes.length) await supa.from('plan_changes').delete().in('id', result.deletes)
    if (plan.stripe_customer_id) {
      for (const b of result.balance) await stripeBalance(plan.stripe_customer_id, b.amount, b.description)
      for (const i of result.invoiceItems) await stripeInvoiceItem(plan.stripe_customer_id, i.amount, i.description)
    }
    const { data: fresh } = await supa.rpc('get_subscription', { p_token: body.token })
    return json({ message: result.message, plan: fresh })
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
})
