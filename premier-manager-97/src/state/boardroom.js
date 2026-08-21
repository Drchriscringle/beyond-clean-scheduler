const REASON_LABELS = {
  striker: 'a new striker',
  defender: 'defensive reinforcements',
  midfielder: 'a new midfielder',
  keeper: 'a new goalkeeper',
  wages: 'improving the wage budget',
  general: 'squad strengthening',
}

export function reasonLabel(reason) {
  return REASON_LABELS[reason] ?? REASON_LABELS.general
}

// A rough "expected league position" for a club given its reputation tier -
// used only to nudge chairman mood, never shown directly to the player.
function expectedPosition(reputation) {
  return { 5: 4, 4: 9, 3: 11, 2: 14, 1: 17 }[reputation] ?? 12
}

export function requestBudget({ club, boardConfidence, lastRequestWeek, currentWeek, leaguePosition, amount }) {
  if (lastRequestWeek != null && currentWeek - lastRequestWeek < 3) {
    return {
      outcome: 'too-soon',
      grantedAmount: 0,
      confidenceDelta: -1,
      message:
        "The chairman leans back. \"We've only just spoken about this. Come back when there's real news to discuss.\"",
    }
  }

  const positionFactor = leaguePosition <= expectedPosition(club.reputation) ? 1.15 : 0.82
  const confidenceFactor = 0.5 + boardConfidence / 100
  const affordable = club.bankBalance * 0.4 * confidenceFactor * positionFactor

  if (amount <= affordable * 0.55) {
    return {
      outcome: 'granted',
      grantedAmount: Math.round(amount),
      confidenceDelta: 2,
      message: `The chairman nods slowly. "Very well. We can stretch to ${reasonLabel(
        club.pendingReason,
      )}. Don't make me regret it."`,
    }
  }

  if (amount <= affordable * 1.4) {
    const counter = Math.max(250_000, Math.round(affordable * 0.55))
    return {
      outcome: 'partial',
      grantedAmount: counter,
      confidenceDelta: 0,
      message: `The chairman does not look impressed. "That's more than we can manage right now. I can offer you a smaller figure — take it or leave it."`,
    }
  }

  return {
    outcome: 'rejected',
    grantedAmount: 0,
    confidenceDelta: -3,
    message:
      'The chairman laughs, without much warmth. "You are dreaming. The books simply do not allow it."',
  }
}

export function driftConfidence({ boardConfidence, leaguePosition, reputation, resultPoints }) {
  const expected = expectedPosition(reputation)
  const positionDelta = (expected - leaguePosition) * 0.4
  const formDelta = resultPoints === 3 ? 1 : resultPoints === 1 ? 0 : -1.2
  const next = boardConfidence + positionDelta * 0.15 + formDelta
  return Math.max(0, Math.min(100, Math.round(next)))
}

export function confidenceLabel(confidence) {
  if (confidence >= 80) return 'Delighted with the board'
  if (confidence >= 60) return 'Board are satisfied'
  if (confidence >= 40) return 'Board are growing uneasy'
  if (confidence >= 20) return 'Under real pressure'
  return 'Job under serious threat'
}
