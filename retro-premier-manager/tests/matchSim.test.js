import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLUBS } from '../src/data/clubs.js'
import { generateSquadForClub } from '../src/data/generateSquad.js'
import { pickBestXI } from '../src/state/lineup.js'
import { simulateMatch, simulateMatchSegment, finalizeRatings } from '../src/state/matchSim.js'

const homeClub = CLUBS.find((c) => c.id === 'arsenal')
const awayClub = CLUBS.find((c) => c.id === 'man-city')
const homeSquad = generateSquadForClub(homeClub)
const awaySquad = generateSquadForClub(awayClub)
const homeLineup = pickBestXI(homeSquad, '4-4-2')
const awayLineup = pickBestXI(awaySquad, '4-4-2')

function averageGoals(fn, n) {
  let total = 0
  for (let i = 0; i < n; i++) {
    const r = fn()
    total += r.homeGoals + r.awayGoals
  }
  return total / n
}

test('a segmented match (two 45-minute halves) is statistically consistent with a single 90-minute call', () => {
  const SAMPLE = 400
  const singleAvg = averageGoals(
    () => simulateMatch({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup }),
    SAMPLE,
  )
  const segmentedAvg = averageGoals(() => {
    const first = simulateMatchSegment({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup, startMinute: 1, endMinute: 45 })
    const second = simulateMatchSegment({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup, startMinute: 46, endMinute: 90 })
    return { homeGoals: first.homeGoals + second.homeGoals, awayGoals: first.awayGoals + second.awayGoals }
  }, SAMPLE)

  // Generous tolerance - this is a statistical comparison over a modest
  // sample kept small so the suite stays fast, not a bit-identical check.
  assert.ok(
    Math.abs(singleAvg - segmentedAvg) < 0.6,
    `expected average goals to be close: single=${singleAvg}, segmented=${segmentedAvg}`,
  )
})

test('finalizeRatings returns a rating for every starter after a segmented match', () => {
  const segment = simulateMatchSegment({ homeClub, awayClub, homeSquad, awaySquad, homeLineup, awayLineup, startMinute: 1, endMinute: 90 })
  const ratings = finalizeRatings({
    homeLineup,
    awayLineup,
    homeGoals: segment.homeGoals,
    awayGoals: segment.awayGoals,
    goals: segment.goals,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
  })
  assert.equal(Object.keys(ratings.homeRatings).length, homeLineup.length)
  assert.equal(Object.keys(ratings.awayRatings).length, awayLineup.length)
  assert.ok(ratings.motmId, 'a man of the match should be selected')
})
