// No imports, so it can be unit-tested in Node as well as run in Deno.

/** Check the Stripe-Signature header (https://docs.stripe.com/webhooks#verify-manually). */
export async function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries((header || '').split(',').map((p) => p.split('=')))
  const t = parts.t
  const sigs = (header || '').split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  if (!t || !sigs.length) return false
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return sigs.some((s) => s.length === hex.length && timingSafeEqual(s, hex))
}

function timingSafeEqual(a, b) {
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
