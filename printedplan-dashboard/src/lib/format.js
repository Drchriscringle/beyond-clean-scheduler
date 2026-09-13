const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const num = new Intl.NumberFormat('en-GB')

export function money(n) {
  return gbp.format(Number(n) || 0)
}

export function int(n) {
  return num.format(Math.round(Number(n) || 0))
}

export function pct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(digits)}%`
}

export function words(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length
}

export function clamp(text, max = 80) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(el)
    return ok
  }
}
