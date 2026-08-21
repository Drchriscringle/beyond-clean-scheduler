// Rolling recent-match form (CM/FM-style "form guide"). Every started
// player league-wide picks up a rating (2-10) each matchweek; the last few
// are kept and averaged. Transfer valuations lean on this so an in-form
// player costs more to buy and an out-of-form one is worth less to sell.

export const FORM_HISTORY_LIMIT = 5
const BASELINE_FORM = 6.0

export function currentForm(player) {
  const history = player.formHistory
  if (!history || history.length === 0) return BASELINE_FORM
  return history.reduce((sum, r) => sum + r, 0) / history.length
}

export function formTrend(player) {
  const history = player.formHistory
  if (!history || history.length < 2) return 'level'
  const latest = history[history.length - 1]
  const prevAvg = history.slice(0, -1).reduce((s, r) => s + r, 0) / (history.length - 1)
  if (latest - prevAvg > 0.5) return 'up'
  if (prevAvg - latest > 0.5) return 'down'
  return 'level'
}

export function pushFormRating(player, rating) {
  const history = [...(player.formHistory ?? []), rating].slice(-FORM_HISTORY_LIMIT)
  return { ...player, formHistory: history }
}

export function formLabel(form) {
  if (form >= 8) return 'Excellent'
  if (form >= 6.8) return 'Good'
  if (form >= 5.3) return 'Average'
  if (form >= 4) return 'Poor'
  return 'Terrible'
}

export function ratePerformance(resultPoints, rng = Math.random) {
  const resultBonus = resultPoints === 3 ? 0.6 : resultPoints === 1 ? 0.15 : -0.35
  const raw = BASELINE_FORM + resultBonus + (rng() - 0.5) * 2.6
  return Math.round(Math.max(2, Math.min(10, raw)) * 10) / 10
}
