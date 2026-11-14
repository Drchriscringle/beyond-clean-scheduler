// Run once a day (about 5pm) by a Supabase cron job:
//  - reminds customers about tomorrow's clean (email, and text if Twilio is set up)
//  - asks yesterday's customers how it went (one-offs always; plans after the first clean, then monthly)
// Deploy with --no-verify-jwt; the cron job sends the x-webhook-secret header.
import { button, db, emailLayout, env, esc, json, sendEmail, sendSms, siteBase } from '../_shared/server.js'
import { addDays, allJobs, todayUK } from '../_shared/schedule.js'

const nice = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== env('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 })
  const supa = db()
  const site = siteBase()
  const today = todayUK()
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)

  const monthAgo = new Date(Date.now() - 28 * 864e5).toISOString()
  const [{ data: plans }, { data: changes }, { data: enquiries }, { data: reviews }, { data: asked }] = await Promise.all([
    supa.from('subscriptions').select('*').in('status', ['active', 'past_due']),
    supa.from('plan_changes').select('*'),
    supa.from('enquiries').select('*').in('status', ['booked', 'completed']).gte('booked_date', yesterday).lte('booked_date', tomorrow),
    supa.from('reviews').select('ref_token').gte('created_at', monthAgo),
    supa.from('message_log').select('ref').eq('kind', 'review').gte('sent_at', monthAgo),
  ])
  const jobs = allJobs({ plans, changes, enquiries }, yesterday, tomorrow).filter((j) => !j.skipped && !j.paused)

  // Returns true the first time only, so nobody is messaged twice.
  const once = async (kind, ref) => {
    const { data } = await supa.from('message_log').upsert({ kind, ref }, { onConflict: 'kind,ref', ignoreDuplicates: true }).select()
    return !!data?.length
  }
  let reminders = 0, asks = 0

  for (const j of jobs) {
    const who = j.plan || j.enquiry
    const token = who.token
    const page = j.type === 'plan' ? `${site}#/plan/${token}` : `${site}#/enquiry/${token}`
    const first = who.name.split(' ')[0]

    if (j.date === tomorrow && await once('reminder', j.key)) {
      reminders++
      await sendEmail({
        to: who.email, replyTo: env('OWNER_EMAIL'),
        subject: `Reminder: your clean tomorrow${j.start ? ` at ${j.start}` : ''}`,
        html: emailLayout(`See you tomorrow, ${first}`, `
          <p>Your clean is on <b>${esc(nice(j.date))}${j.start ? ` at ${esc(j.start)}` : ''}</b> at ${esc(who.address)}.</p>
          <p>Please check your access details (key safe, pets, parking) are up to date.</p>
          ${button(page, 'Check details')}`),
      })
      if (env('REMIND_BY_SMS') === 'true') {
        await sendSms(who.phone, `Beyond Clean: reminder of your clean tomorrow${j.start ? ` at ${j.start}` : ''}. Need to change it? ${page}`)
      }
    }

    if (j.date === yesterday) {
      // Plans: ask after the first clean, then at most once every 4 weeks.
      const recent = (reviews || []).some((r) => r.ref_token === token)
        || (asked || []).some((m) => m.ref.startsWith(token))
      const ask = j.type === 'oneoff' || !recent
      if (ask && await once('review', j.type === 'plan' ? `${token}:${j.date}` : `${token}`)) {
        asks++
        await sendEmail({
          to: who.email, replyTo: env('OWNER_EMAIL'),
          subject: 'How did we do?',
          html: emailLayout(`How was your clean, ${first}?`, `
            <p>It takes 10 seconds and really helps a small local business.</p>
            <p>Not perfect? Tell us and we'll come back and put it right within 24 hours, free.</p>
            ${button(`${site}#/review/${token}?date=${j.date}`, 'Rate your clean')}`),
        })
      }
    }
  }
  return json({ reminders, reviewRequests: asks })
})
