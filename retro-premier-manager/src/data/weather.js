// Random per-match weather, rolled once per fixture and held fixed across
// however many segments a live match is ticked through (see gameReducer.js -
// it's stored on liveMatch, exactly like homeTactics/awayTactics). Bad
// weather dents both sides' scoring a little and narrows the gap between a
// strong and weak side ("conditions levelling things up"), and a poor home
// pitch (see facilities.js) makes that levelling effect worse - giving
// pitch investment a payoff beyond just injury rate.
export const WEATHER_TYPES = {
  clear: { label: 'Clear', goalMult: 1.0, varianceBoost: 0 },
  overcast: { label: 'Overcast', goalMult: 1.0, varianceBoost: 0 },
  rain: { label: 'Rain', goalMult: 0.93, varianceBoost: 0.08 },
  windy: { label: 'Windy', goalMult: 0.95, varianceBoost: 0.05 },
  snow: { label: 'Snow', goalMult: 0.88, varianceBoost: 0.14 },
}

const WEATHER_WEIGHTS = { clear: 45, overcast: 25, rain: 20, windy: 8, snow: 2 }

export function rollWeather(rng = Math.random) {
  const total = Object.values(WEATHER_WEIGHTS).reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (const [key, weight] of Object.entries(WEATHER_WEIGHTS)) {
    roll -= weight
    if (roll <= 0) return key
  }
  return 'clear'
}
