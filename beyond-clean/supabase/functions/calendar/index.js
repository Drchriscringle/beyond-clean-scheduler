// Calendar feed (iCal) of upcoming cleans. Subscribe to it in Google Calendar or Apple Calendar.
//   ?key=<CALENDAR_KEY>                         all jobs (owner)
//   ?cleaner=<id>&key=<cleaner key>             one cleaner's jobs
//   ?links=1 with the owner's login             returns the feed addresses for the Settings page
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, db, env, json } from '../_shared/server.js'
import { addDays, allJobs, todayUK } from '../_shared/schedule.js'

async function cleanerKey(id) {
  const data = new TextEncoder().encode(`${env('CALENDAR_KEY')}:${id}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const ics = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c)
const stamp = (date, time) => `${date.replaceAll('-', '')}T${(time || '09:00').replace(':', '')}00`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const supa = db()

  if (url.searchParams.get('links')) {
    const user = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const { data: admin } = await user.rpc('is_admin')
    if (!admin) return json({ error: 'Owner only' }, 403)
    const base = `${env('SUPABASE_URL')}/functions/v1/calendar`
    const { data: cleaners } = await supa.from('cleaners').select('id, name').eq('active', true)
    return json({
      owner: `${base}?key=${env('CALENDAR_KEY')}`,
      cleaners: await Promise.all((cleaners || []).map(async (c) => ({ id: c.id, name: c.name, url: `${base}?cleaner=${c.id}&key=${await cleanerKey(c.id)}` }))),
    })
  }

  const cleaner = url.searchParams.get('cleaner')
  const key = url.searchParams.get('key')
  if (!env('CALENDAR_KEY') || !key || key !== (cleaner ? await cleanerKey(cleaner) : env('CALENDAR_KEY'))) {
    return new Response('forbidden', { status: 403 })
  }

  const from = addDays(todayUK(), -7)
  const to = addDays(todayUK(), 56)
  const [{ data: plans }, { data: changes }, { data: enquiries }, { data: team }] = await Promise.all([
    supa.from('subscriptions').select('*').in('status', ['active', 'past_due', 'paused']),
    supa.from('plan_changes').select('*'),
    supa.from('enquiries').select('*').in('status', ['booked', 'completed']).gte('booked_date', from),
    supa.from('cleaners').select('id, name'),
  ])
  const names = Object.fromEntries((team || []).map((c) => [c.id, c.name]))
  const jobs = allJobs({ plans, changes, enquiries }, from, to)
    .filter((j) => !j.skipped && !j.paused && (!cleaner || j.cleanerId === cleaner))

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beyond Clean//Jobs//EN', 'X-WR-CALNAME:Beyond Clean', 'CALSCALE:GREGORIAN']
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  for (const j of jobs) {
    const who = j.plan || j.enquiry
    const end = j.end || (j.start ? j.start : '12:00')
    const a = who.access || {}
    const desc = [
      j.type === 'plan' ? 'Regular plan clean' : `One-off: ${who.clean_type}`,
      `Phone: ${who.phone}`,
      a.method && `Access: ${a.method}${a.key_safe_code ? ` (code ${a.key_safe_code})` : ''}`,
      a.pets && `Pets: ${a.pets}`, a.parking && `Parking: ${a.parking}`, who.notes && `Notes: ${who.notes}`,
      !cleaner && `Cleaner: ${names[j.cleanerId] || 'not assigned'}`,
    ].filter(Boolean).join('\n')
    lines.push('BEGIN:VEVENT', `UID:${j.key.replace(/:/g, '-')}@beyondclean`, `DTSTAMP:${now}`,
      `DTSTART;TZID=Europe/London:${stamp(j.date, j.start)}`, `DTEND;TZID=Europe/London:${stamp(j.date, end > (j.start || '') ? end : '12:00')}`,
      `SUMMARY:${ics(`🧽 ${who.name.split(' ')[0]} ${who.name.split(' ')[1]?.[0] || ''} · ${who.postcode}`)}`,
      `LOCATION:${ics(`${who.address}, ${who.postcode}`)}`, `DESCRIPTION:${ics(desc)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return new Response(lines.join('\r\n'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', ...cors } })
})
