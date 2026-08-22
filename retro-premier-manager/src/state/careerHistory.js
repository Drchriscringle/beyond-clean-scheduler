import { clubCupStatus } from './cup.js'

// One entry per season the manager spent in charge of a club, appended
// whenever that season concludes for them - normally, or by being sacked
// (either at season's end or mid-season). Cup result is read from whatever
// state the cup competition happens to be in at that moment.
export function recordSeason(history, { season, clubId, division, finalPosition, objectiveLabel, objectiveMet, cup, outcome }) {
  const cupStatus = cup ? clubCupStatus(cup, clubId) : null
  const cupResult = cupStatus?.won
    ? 'FA Cup Winner'
    : cupStatus?.roundLabel && cupStatus.roundLabel !== 'Did not enter'
      ? `FA Cup — ${cupStatus.roundLabel}`
      : null

  return [
    ...history,
    { season, clubId, division, finalPosition, objectiveLabel, objectiveMet, cupResult, outcome },
  ]
}
