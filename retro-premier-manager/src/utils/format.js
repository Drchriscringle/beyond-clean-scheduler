export function formatMoney(n) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs}`
}

export function formatMoneyFull(n) {
  const sign = n < 0 ? '-' : ''
  return `${sign}£${Math.abs(Math.round(n)).toLocaleString('en-GB')}`
}

export function formatWage(n) {
  return `${formatMoney(n)}/wk`
}
