// The "ping". Supabase Database Webhooks call this when enquiries, plans, plan changes or
// reviews are inserted/updated. It emails (and optionally texts) the owner, and emails the
// customer when something they need to know happens. Deploy with --no-verify-jwt.
import { button, db, emailLayout, env, esc, sendEmail, sendOwnerSms, siteBase } from '../_shared/server.js'
import { addHours, formatPounds, frequencyLabel, slotLabel } from '../_shared/pricing.js'

const CLEAN = {
  regular: 'Standard clean', deep: 'Deep clean', end_of_tenancy: 'End of tenancy', after_builders: 'After builders',
  holiday_turnover: 'Holiday let turnover', commercial: 'Office / commercial',
}
const date = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const when = (r) => `${date(r.booked_date)}${r.booked_time ? ` at ${r.booked_time}` : ''}`
const first = (name) => String(name || '').split(' ')[0]

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== env('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 })
  const { type, table, record: r, old_record: old } = await req.json()
  const site = siteBase()
  const owner = env('OWNER_EMAIL')
  const admin = `${site}#/admin`
  const jobs = []
  const toOwner = (subject, title, inner, replyTo) => jobs.push(sendEmail({ to: owner, replyTo, subject, html: emailLayout(title, inner + button(admin, 'Open the app')) }))
  const changed = (k) => old?.[k] !== r[k]

  if (table === 'enquiries') {
    const link = `${site}#/enquiry/${r.token}`
    const toCustomer = (subject, title, inner) => jobs.push(sendEmail({ to: r.email, replyTo: owner, subject, html: emailLayout(title, inner) }))

    if (type === 'INSERT') {
      const what = CLEAN[r.clean_type] || r.clean_type
      const prefs = (r.preferred || []).map((p) => `${date(p.date)} (${p.window})`).join(', ') || 'Flexible'
      const est = r.estimate_low_pence ? `${formatPounds(r.estimate_low_pence)}–${formatPounds(r.estimate_high_pence)}` : 'quote by hand'
      jobs.push(sendOwnerSms(`New Beyond Clean enquiry: ${r.name}, ${what}, ${r.postcode}. Estimate ${est}. ${r.phone}. ${admin}`))
      toOwner(`🔔 New enquiry: ${r.name} – ${what} (${r.postcode})`, `New enquiry from ${r.name}`, `
        <p><b>${esc(what)}</b> · ${esc(r.property_type)} · ${esc(r.bedrooms)} bed · ${esc(r.bathrooms)} bath</p>
        <p><b>Estimate shown:</b> ${esc(est)}${r.discount_code ? ` · code <b>${esc(r.discount_code)}</b>` : ''}</p>
        <p><b>Areas:</b> ${esc((r.areas || []).join(', '))}<br><b>Extras:</b> ${esc((r.extras || []).join(', ') || 'none')}</p>
        <p><b>Would like:</b> ${esc(prefs)}${r.flexible ? ' · flexible' : ''}</p>
        <p><b>Contact:</b> ${esc(r.phone)} · ${esc(r.email)} (prefers ${esc(r.contact_pref)})<br>${esc(r.address)}, ${esc(r.postcode)}</p>
        ${r.photos?.length ? `<p>📷 ${r.photos.length} photo${r.photos.length > 1 ? 's' : ''} attached (see the app)</p>` : ''}
        ${r.notes ? `<p><b>Notes:</b> ${esc(r.notes)}</p>` : ''}`, r.email)
    }

    if (type === 'UPDATE') {
      if (r.status === 'replied' && (changed('status') || changed('reply_message') || changed('quote_pence') || changed('booked_date') || changed('booked_time'))) {
        toCustomer('Your Beyond Clean quote', `Hi ${first(r.name)}, here's your quote`, `
          <p style="white-space:pre-wrap">${esc(r.reply_message)}</p>
          ${r.quote_pence != null ? `<p><b>Price:</b> ${formatPounds(r.quote_pence)}</p>` : ''}
          ${r.booked_date ? `<p><b>Date:</b> ${esc(when(r))}</p>` : ''}
          ${r.deposit_pence ? `<p>To secure the date there's a ${formatPounds(r.deposit_pence)} card deposit, taken off the price.</p>` : ''}
          ${button(link, 'View and accept')}`)
      }
      if (changed('status') && old?.status === 'replied' && r.status === 'awaiting_deposit') {
        toOwner(`${r.name} accepted – waiting for deposit`, `${r.name} accepted your quote`, `<p>${esc(when(r))}. They're paying the ${formatPounds(r.deposit_pence)} deposit now.</p>`)
      }
      if (changed('status') && r.status === 'booked' && ['replied', 'awaiting_deposit'].includes(old?.status) && r.accepted_at) {
        jobs.push(sendOwnerSms(`Booked: ${r.name}, ${when(r)}${r.paid_pence ? `, deposit ${formatPounds(r.paid_pence)} paid` : ''}.`))
        toOwner(`✅ Booked: ${r.name} – ${date(r.booked_date)}`, `${r.name} is booked in`, `<p>${esc(when(r))} · ${formatPounds(r.quote_pence)}${r.paid_pence ? ` (${formatPounds(r.paid_pence)} paid)` : ''}<br>${esc(r.address)}, ${esc(r.postcode)}</p>`)
        toCustomer(`You're booked in: ${date(r.booked_date)}`, `Thanks ${first(r.name)}, you're booked in`, `
          <p><b>${esc(when(r))}</b><br>${esc(r.address)}, ${esc(r.postcode)}</p>
          <p>Please add your key safe code, pets and parking details so we can get straight to work.</p>${button(link, 'Your booking')}`)
      }
      if (changed('status') && r.status === 'declined' && r.customer_declined) {
        toOwner(`${r.name} declined your quote`, `${r.name} declined your quote`, '')
      }
      if (changed('status') && r.status === 'cancelled') {
        jobs.push(sendOwnerSms(`Cancelled: ${r.name}, ${when(r)}${r.late_cancel ? ' (late)' : ''}.`))
        toOwner(`❌ Cancelled: ${r.name} – ${date(r.booked_date)}`, `${r.name} cancelled`, `
          <p>${esc(when(r))}. ${r.late_cancel ? '<b>Less than the notice period</b>, so a late-cancellation charge can apply.' : 'Cancelled with enough notice.'}</p>
          ${r.paid_pence ? `<p>They have paid ${formatPounds(r.paid_pence)}. Refund it in Stripe if your policy says so.</p>` : ''}`)
      }
      if (changed('status') && r.status === 'completed') {
        const owed = (r.quote_pence || 0) - (r.paid_pence || 0)
        toCustomer('Thanks from Beyond Clean', `All done, ${first(r.name)}!`, `
          <p>Thanks for choosing Beyond Clean.</p>
          ${owed > 0 ? `<p>The balance of <b>${formatPounds(owed)}</b> can be paid by card here:</p>${button(link, `Pay ${formatPounds(owed)}`)}` : ''}
          <p>Not 100% happy? Tell us within 24 hours and we'll come back and put it right, free.</p>
          ${button(`${site}#/review/${r.token}`, 'Rate your clean')}`)
      }
      if (changed('paid_pence') && r.paid_pence > (old?.paid_pence || 0) && r.status !== 'booked') {
        toOwner(`💷 ${r.name} paid ${formatPounds(r.paid_pence - (old?.paid_pence || 0))}`, `Payment from ${r.name}`, `<p>Total paid ${formatPounds(r.paid_pence)} of ${formatPounds(r.quote_pence)}.</p>`)
      }
    }
  }

  if (table === 'subscriptions' && type === 'UPDATE' && changed('status')) {
    const times = (r.slots || []).map((s) => `${slotLabel(s, true)}–${addHours(s.start, r.hours_per_visit)}`).join('<br>')
    if (r.status === 'active' && old?.status === 'pending_payment') {
      jobs.push(sendOwnerSms(`New cleaning plan! ${r.name}, ${r.hours_per_visit}h ${frequencyLabel(r.visits_per_week)}, ${formatPounds(r.monthly_pence)}/month. ${r.phone}`))
      toOwner(`🎉 New plan: ${r.name} – ${formatPounds(r.monthly_pence)}/month`, `New cleaning plan: ${r.name}`, `
        <p><b>${r.hours_per_visit} hrs, ${frequencyLabel(r.visits_per_week)}</b> · ${formatPounds(r.monthly_pence)}/month · starts ${esc(date(r.start_date))}</p>
        <p>${times}</p><p>${esc(r.address)}, ${esc(r.postcode)}<br>${esc(r.phone)} · ${esc(r.email)}</p>
        ${r.referred_by_code ? `<p>Referred by code ${esc(r.referred_by_code)}</p>` : ''}${r.discount_code ? `<p>Used code ${esc(r.discount_code)}</p>` : ''}
        ${r.notes ? `<p><b>Notes:</b> ${esc(r.notes)}</p>` : ''}`, r.email)
      jobs.push(sendEmail({
        to: r.email, replyTo: owner, subject: 'Welcome to Beyond Clean',
        html: emailLayout(`Thanks ${first(r.name)}, your plan is active`, `
          <p>Your cleans, ${frequencyLabel(r.visits_per_week)} from ${esc(date(r.start_date))}:</p><p>${times}</p>
          <p>You pay ${formatPounds(r.monthly_pence)} a month. You can skip a clean, pause for holidays or add extras any time from your plan page.</p>
          <p>Know someone who'd like a cleaner? Give them your code <b>${esc(r.referral_code)}</b> and you'll both get money off.</p>
          ${button(`${site}#/plan/${r.token}`, 'Manage your plan')}`),
      }))
    }
    if (r.status === 'past_due') {
      toOwner(`⚠️ Payment failed: ${r.name}`, `${r.name}'s payment failed`, `<p>Stripe will retry automatically. You may want to give them a call: ${esc(r.phone)}</p>`)
    }
    if (r.status === 'cancelled' && old?.status !== 'pending_payment') {
      toOwner(`Plan cancelled: ${r.name}`, `${r.name} cancelled their plan`, '<p>Their weekly times are free again.</p>')
    }
  }

  if (table === 'plan_changes') {
    const supa = db()
    const { data: plan } = await supa.from('subscriptions').select('*').eq('id', r.subscription_id).single()
    if (plan && type === 'INSERT' && r.made_by === 'customer') {
      const visit = `${date(r.visit_date)} ${r.visit_start}`
      if (r.kind === 'skip' && r.note === 'Holiday pause') {
        // A holiday pause writes one row per clean; send one email for the first.
        const { data: earlier } = await supa.from('plan_changes').select('id').eq('subscription_id', r.subscription_id)
          .eq('note', 'Holiday pause').lt('visit_date', r.visit_date).gte('created_at', new Date(Date.now() - 6e4).toISOString())
        if (!earlier?.length) toOwner(`🏖️ ${plan.name} paused their cleans`, `${plan.name} is going away`, `<p>Cleans paused from ${esc(visit)}. See the Week view for which cleans are off.</p>`)
      } else if (r.kind === 'skip') {
        toOwner(`${plan.name} skipped ${date(r.visit_date)}`, `${plan.name} skipped a clean`, `<p>${esc(visit)}${r.credit_pence ? ` · ${formatPounds(r.credit_pence)} credited` : ' · no credit (short notice)'}</p>`)
      } else if (r.kind === 'move') {
        jobs.push(sendOwnerSms(`${plan.name} wants to move their ${visit} clean to ${date(r.new_date)}${r.new_time ? ' ' + r.new_time : ''}. Confirm in the app.`))
        toOwner(`↔️ ${plan.name} wants to move a clean`, `${plan.name} wants to move a clean`, `
          <p>From <b>${esc(visit)}</b> to <b>${esc(date(r.new_date))}${r.new_time ? ` ${esc(r.new_time)}` : ''}</b></p>${r.note ? `<p>"${esc(r.note)}"</p>` : ''}`)
      } else if (r.kind === 'extra') {
        toOwner(`➕ ${plan.name} added ${r.extra_id}`, `${plan.name} added an extra`, `<p>${esc(r.extra_id)} on ${esc(visit)} · ${formatPounds(r.amount_pence)} on their next bill</p>`)
      }
    }
    if (plan && type === 'UPDATE' && r.kind === 'move' && changed('status') && ['confirmed', 'declined'].includes(r.status)) {
      jobs.push(sendEmail({
        to: plan.email, replyTo: owner,
        subject: r.status === 'confirmed' ? 'Your clean has been moved' : 'About moving your clean',
        html: emailLayout(r.status === 'confirmed' ? 'All sorted' : "Sorry, we can't make that time", r.status === 'confirmed'
          ? `<p>Your clean has moved from ${esc(date(r.visit_date))} to <b>${esc(date(r.new_date))}${r.new_time ? ` at ${esc(r.new_time)}` : ''}</b>.</p>${button(`${site}#/plan/${plan.token}`, 'Your plan')}`
          : `<p>We can't move your ${esc(date(r.visit_date))} clean to that time, so it stays as it is. Give us a call and we'll find another time.</p>${button(`${site}#/plan/${plan.token}`, 'Your plan')}`),
      }))
    }
  }

  if (table === 'reviews' && (type === 'INSERT' || changed('rating') || changed('fix_requested'))) {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)
    if (r.fix_requested && (type === 'INSERT' || changed('fix_requested'))) {
      jobs.push(sendOwnerSms(`⚠️ ${r.name} isn't happy (${r.rating}★) and wants us back within 24h: "${String(r.comment || '').slice(0, 80)}"`))
    }
    toOwner(`${r.fix_requested ? '⚠️ Put-it-right request' : 'New review'}: ${stars} from ${r.name}`, `${stars} from ${r.name}`, `
      ${r.comment ? `<p>"${esc(r.comment)}"</p>` : ''}
      ${r.fix_requested ? '<p><b>They want us to come back and fix it (24-hour guarantee).</b></p>' : '<p>Publish it on your home page from the Reviews tab.</p>'}`)
  }

  await Promise.all(jobs)
  return new Response('ok')
})
