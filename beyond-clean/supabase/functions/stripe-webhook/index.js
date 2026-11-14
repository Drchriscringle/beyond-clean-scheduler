// Stripe tells us when a plan is paid for, renews, fails or is cancelled.
// Deploy with --no-verify-jwt. Point a Stripe webhook at this function's URL.
import { db, env, verifyStripeSignature } from '../_shared/server.js'

const STATUS = {
  active: 'active', trialing: 'active',
  past_due: 'past_due', unpaid: 'past_due',
  paused: 'paused',
  canceled: 'cancelled', incomplete_expired: 'cancelled',
  incomplete: 'pending_payment',
}

Deno.serve(async (req) => {
  const raw = await req.text()
  const ok = await verifyStripeSignature(raw, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'))
  if (!ok) return new Response('bad signature', { status: 400 })

  const event = JSON.parse(raw)
  const o = event.data.object
  const supa = db()
  const byStripeSub = (id, patch) => supa.from('subscriptions').update(patch).eq('stripe_subscription_id', id)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const rowId = o.metadata?.subscription_row || o.client_reference_id
        if (!rowId || o.mode !== 'subscription') break
        await supa.from('subscriptions').update({
          status: o.payment_status === 'paid' ? 'active' : 'pending_payment',
          stripe_customer_id: o.customer,
          stripe_subscription_id: o.subscription,
        }).eq('id', rowId)
        break
      }
      case 'checkout.session.expired': {
        // Customer left the payment page: release the times they were holding.
        const rowId = o.metadata?.subscription_row || o.client_reference_id
        if (rowId) await supa.from('subscriptions').update({ status: 'cancelled' }).eq('id', rowId).eq('status', 'pending_payment')
        break
      }
      case 'invoice.paid': {
        const subId = o.subscription || o.parent?.subscription_details?.subscription
        const periodEnd = o.lines?.data?.[0]?.period?.end
        if (subId) {
          await byStripeSub(subId, {
            status: 'active',
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
          })
        }
        break
      }
      case 'invoice.payment_failed': {
        const subId = o.subscription || o.parent?.subscription_details?.subscription
        if (subId) await byStripeSub(subId, { status: 'past_due' })
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        let status = event.type.endsWith('deleted') ? 'cancelled' : (STATUS[o.status] || 'active')
        if (status === 'active' && o.pause_collection) status = 'paused'
        const patch = { status }
        const end = o.current_period_end || o.items?.data?.[0]?.current_period_end
        if (end) patch.current_period_end = new Date(end * 1000).toISOString()
        const { data } = await byStripeSub(o.id, patch).select('id')
        // First event can arrive before checkout.session.completed has stored the id.
        if (!data?.length && o.metadata?.subscription_row) {
          await supa.from('subscriptions').update({ ...patch, stripe_subscription_id: o.id, stripe_customer_id: o.customer })
            .eq('id', o.metadata.subscription_row)
        }
        break
      }
    }
  } catch (e) {
    console.error(event.type, e)
    return new Response('error', { status: 500 }) // Stripe retries
  }
  return new Response('ok')
})

