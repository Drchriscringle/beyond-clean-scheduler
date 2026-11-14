// Helpers for the Edge Functions (Deno). Secrets come from `supabase secrets set`.
import { createClient } from 'npm:@supabase/supabase-js@2'

export const env = (k, fallback) => Deno.env.get(k) ?? fallback

export const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/** Where links back to the app point. SITE_URL (e.g. https://book.beyondclean.co.uk/) wins. */
export function siteUrl(origin) {
  const fromEnv = env('SITE_URL')
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : fromEnv + '/'
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin
  throw new Error('SITE_URL is not set')
}

// ---------------------------------------------------------------- Stripe (plain REST, no SDK)

function encode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') encode(v, key, out)
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  return out.join('&')
}

export async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? encode(params) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`)
  return data
}

export { verifyStripeSignature } from './stripe-signature.js'

// ---------------------------------------------------------------- Alerts

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Send an email through Resend (https://resend.com). Skips quietly if not configured. */
export async function sendEmail({ to, subject, html, replyTo }) {
  const key = env('RESEND_API_KEY')
  if (!key || !to) return console.log('email skipped (no RESEND_API_KEY or recipient):', subject)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('FROM_EMAIL', 'Beyond Clean <onboarding@resend.dev>'),
      to: [to], subject, html, reply_to: replyTo,
    }),
  })
  if (!res.ok) console.error('email failed', res.status, await res.text())
}

/** Optional text message to the owner's mobile through Twilio. Skips quietly if not configured. */
export async function sendOwnerSms(body) {
  const sid = env('TWILIO_ACCOUNT_SID'), token = env('TWILIO_AUTH_TOKEN'), from = env('TWILIO_FROM'), to = env('OWNER_MOBILE')
  if (!sid || !token || !from || !to) return
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  })
  if (!res.ok) console.error('sms failed', res.status, await res.text())
}

export function emailLayout(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#0f2a40">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#1f6fb2;color:#fff;border-radius:14px 14px 0 0;padding:16px 20px;font-weight:bold;font-size:18px">Beyond Clean</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:20px">
      <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${inner}
    </div>
  </div></body></html>`
}

export function button(href, label) {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#1f6fb2;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px;display:inline-block">${esc(label)}</a></p>`
}
