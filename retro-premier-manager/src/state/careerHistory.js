import { clubCupStatus } from './cup.js'

// One entry per season the manager spent in charge of a club, appended
// whenever that season concludes for them - normally, or by being sacked
// (either at season's end or mid-season). Cup result is read from whatever
// state the relevant cup competition (FA Cup for an English club, Scottish
// Cup for a Scottish one) happens to be in at that moment.
export function recordSeason(history, { season, clubId, division, finalPosition, objectiveLabel, objectiveMet, cup, scottishCup, outcome }) {
  const faCupStatus = cup ? clubCupStatus(cup, clubId) : null
  const scottishCupStatus = scottishCup ? clubCupStatus(scottishCup, clubId) : null
  const [cupLabel, cupStatus] =
    faCupStatus?.roundLabel && faCupStatus.roundLabel !== 'Did not enter'
      ? ['FA Cup', faCupStatus]
      : scottishCupStatus?.roundLabel && scottishCupStatus.roundLabel !== 'Did not enter'
        ? ['Scottish Cup', scottishCupStatus]
        : [null, null]
  const cupResult = cupStatus?.won ? `${cupLabel} Winner` : cupStatus ? `${cupLabel} — ${cupStatus.roundLabel}` : null

  return [
    ...history,
    { season, clubId, division, finalPosition, objectiveLabel, objectiveMet, cupResult, outcome },
  ]
}
