// Stripe tells us when a plan is paid for, renews, fails or is cancelled, and when
// a one-off deposit or balance is paid. Deploy with --no-verify-jwt.
import { db, env, loadSettings, stripeBalance, verifyStripeSignature } from '../_shared/server.js'

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
        // One-off deposit or balance
        if (o.mode === 'payment' && o.metadata?.enquiry_id) {
          const { data: e } = await supa.from('enquiries').select('*').eq('id', o.metadata.enquiry_id).single()
          const paid = (e.paid_pence || 0) + (o.amount_total || 0)
          await supa.from('enquiries').update({
            paid_pence: paid,
            status: e.status === 'awaiting_deposit' && paid >= e.deposit_pence ? 'booked' : e.status,
          }).eq('id', e.id)
          break
        }
        const rowId = o.metadata?.subscription_row || o.client_reference_id
        if (!rowId || o.mode !== 'subscription') break
        const { data: row } = await supa.from('subscriptions').update({
          status: o.payment_status === 'paid' ? 'active' : 'pending_payment',
          stripe_customer_id: o.customer,
          stripe_subscription_id: o.subscription,
        }).eq('id', rowId).select().single()
        if (row?.discount_code) {
          const { data: code } = await supa.from('discount_codes').select('uses').eq('code', row.discount_code).single()
          if (code) await supa.from('discount_codes').update({ uses: code.uses + 1 }).eq('code', row.discount_code)
        }
        // Thank the friend who referred them with credit off their next bill.
        if (row?.referred_by_code && !row.referral_rewarded) {
          const settings = await loadSettings(supa)
          const { data: friend } = await supa.from('subscriptions').select('*').eq('referral_code', row.referred_by_code).maybeSingle()
          if (friend?.stripe_customer_id && settings.referralRewardPence > 0) {
            await stripeBalance(friend.stripe_customer_id, -settings.referralRewardPence, `Thank you for referring ${row.name.split(' ')[0]}`)
          }
          await supa.from('subscriptions').update({ referral_rewarded: true }).eq('id', row.id)
        }
        break
      }
      case 'checkout.session.expired': {
        // Customer left the payment page: release the times they were holding.
        const rowId = o.metadata?.subscription_row
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
