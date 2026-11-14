// The "ping". Supabase Database Webhooks call this when an enquiry or plan is
// inserted/updated. It emails (and optionally texts) the owner, and emails the customer
// when the owner replies. Deploy with --no-verify-jwt and set NOTIFY_SECRET.
import { button, emailLayout, env, esc, sendEmail, sendOwnerSms } from '../_shared/server.js'
import { addHours, formatPounds, slotLabel } from '../_shared/pricing.js'

const CLEAN = {
  regular: 'Standard clean', deep: 'Deep clean', end_of_tenancy: 'End of tenancy', after_builders: 'After builders',
  holiday_turnover: 'Holiday let turnover', commercial: 'Office / commercial',
}
const date = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== env('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 })
  const { type, table, record: r, old_record: old } = await req.json()
  const site = (env('SITE_URL') || '').replace(/\/?$/, '/')
  const owner = env('OWNER_EMAIL')
  const admin = `${site}#/admin`
  const jobs = []

  if (table === 'enquiries') {
    const link = `${site}#/enquiry/${r.token}`
    if (type === 'INSERT') {
      const what = CLEAN[r.clean_type] || r.clean_type
      const prefs = (r.preferred || []).map((p) => `${date(p.date)} (${p.window})`).join(', ') || 'Flexible'
      jobs.push(sendOwnerSms(`New Beyond Clean enquiry: ${r.name}, ${what}, ${r.postcode}. ${r.phone}. Reply: ${admin}`))
      jobs.push(sendEmail({
        to: owner, replyTo: r.email,
        subject: `🔔 New enquiry: ${r.name} – ${what} (${r.postcode})`,
        html: emailLayout(`New enquiry from ${r.name}`, `
          <p><b>${esc(what)}</b> · ${esc(r.property_type)} · ${esc(r.bedrooms)} bed · ${esc(r.bathrooms)} bath</p>
          <p><b>Areas:</b> ${esc((r.areas || []).join(', '))}<br><b>Extras:</b> ${esc((r.extras || []).join(', ') || 'none')}</p>
          <p><b>Would like:</b> ${esc(prefs)}${r.flexible ? ' · flexible' : ''}</p>
          <p><b>Contact:</b> ${esc(r.phone)} · ${esc(r.email)} (prefers ${esc(r.contact_pref)})<br>${esc(r.address)}, ${esc(r.postcode)}</p>
          ${r.notes ? `<p><b>Notes:</b> ${esc(r.notes)}</p>` : ''}
          ${button(admin, 'Reply in the app')}`),
      }))
    }
    if (type === 'UPDATE' && r.status === 'replied' && (old?.status !== 'replied' || old?.reply_message !== r.reply_message
        || old?.quote_pence !== r.quote_pence || old?.booked_date !== r.booked_date || old?.booked_time !== r.booked_time)) {
      jobs.push(sendEmail({
        to: r.email, replyTo: owner,
        subject: 'Your Beyond Clean quote',
        html: emailLayout(`Hi ${r.name.split(' ')[0]}, here's your quote`, `
          <p style="white-space:pre-wrap">${esc(r.reply_message)}</p>
          ${r.quote_pence != null ? `<p><b>Price:</b> ${formatPounds(r.quote_pence)}</p>` : ''}
          ${r.booked_date ? `<p><b>Date:</b> ${esc(date(r.booked_date))}${r.booked_time ? ` at ${esc(r.booked_time)}` : ''}</p>` : ''}
          ${button(link, 'View and accept')}`),
      }))
    }
    if (type === 'UPDATE' && old?.status === 'replied' && r.status === 'booked' && r.accepted_at) {
      jobs.push(sendOwnerSms(`${r.name} accepted your quote for ${date(r.booked_date)}${r.booked_time ? ' ' + r.booked_time : ''}.`))
      jobs.push(sendEmail({
        to: owner, subject: `✅ ${r.name} accepted – ${date(r.booked_date)}`,
        html: emailLayout(`${r.name} accepted your quote`, `<p>${esc(date(r.booked_date))}${r.booked_time ? ` at ${esc(r.booked_time)}` : ''} · ${formatPounds(r.quote_pence)}<br>${esc(r.address)}, ${esc(r.postcode)}</p>${button(admin, 'Open the app')}`),
      }))
    }
    if (type === 'UPDATE' && old?.status === 'replied' && r.status === 'declined' && r.customer_declined) {
      jobs.push(sendEmail({ to: owner, subject: `${r.name} declined your quote`, html: emailLayout(`${r.name} declined your quote`, button(admin, 'Open the app')) }))
    }
  }

  if (table === 'subscriptions' && type === 'UPDATE' && old?.status !== r.status) {
    const times = (r.slots || []).map((s) => `${slotLabel(s, true)}–${addHours(s.start, r.hours_per_visit)}`).join('<br>')
    if (r.status === 'active' && old?.status === 'pending_payment') {
      jobs.push(sendOwnerSms(`New cleaning plan! ${r.name}, ${r.visits_per_week}x${r.hours_per_visit}h/week, ${formatPounds(r.monthly_pence)}/month. ${r.phone}`))
      jobs.push(sendEmail({
        to: owner, replyTo: r.email,
        subject: `🎉 New plan: ${r.name} – ${formatPounds(r.monthly_pence)}/month`,
        html: emailLayout(`New cleaning plan: ${r.name}`, `
          <p><b>${r.visits_per_week}× ${r.hours_per_visit} hrs a week</b> · ${formatPounds(r.monthly_pence)}/month · starts ${esc(date(r.start_date))}</p>
          <p>${times}</p><p>${esc(r.address)}, ${esc(r.postcode)}<br>${esc(r.phone)} · ${esc(r.email)}</p>
          ${r.notes ? `<p><b>Notes:</b> ${esc(r.notes)}</p>` : ''}${button(`${admin}/plans`, 'Open the app')}`),
      }))
      jobs.push(sendEmail({
        to: r.email, replyTo: owner, subject: 'Welcome to Beyond Clean',
        html: emailLayout(`Thanks ${r.name.split(' ')[0]}, your plan is active`, `
          <p>Your cleans, every week from ${esc(date(r.start_date))}:</p><p>${times}</p>
          <p>You pay ${formatPounds(r.monthly_pence)} a month. We'll be in touch before your first clean to arrange access.</p>
          ${button(`${site}#/plan/${r.token}`, 'Manage your plan')}`),
      }))
    }
    if (r.status === 'past_due') {
      jobs.push(sendEmail({ to: owner, subject: `⚠️ Payment failed: ${r.name}`, html: emailLayout(`${r.name}'s payment failed`, `<p>Stripe will retry automatically. You may want to give them a call: ${esc(r.phone)}</p>`) }))
    }
    if (r.status === 'cancelled' && old?.status !== 'pending_payment') {
      jobs.push(sendEmail({ to: owner, subject: `Plan cancelled: ${r.name}`, html: emailLayout(`${r.name} cancelled their plan`, `<p>Their weekly times are free again.</p>`) }))
    }
  }

  await Promise.all(jobs)
  return new Response('ok')
})
