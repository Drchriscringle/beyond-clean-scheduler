import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aiAbilityMultiplier, sackConfidenceThreshold, objectiveFailStreakLimit, difficultyLabel } from '../src/state/difficulty.js'
import { generateSquadForClub } from '../src/data/generateSquad.js'

test('difficulty multipliers are ordered easy < normal < hard for AI ability, and the reverse for board patience', () => {
  assert.ok(aiAbilityMultiplier('easy') < aiAbilityMultiplier('normal'))
  assert.ok(aiAbilityMultiplier('normal') < aiAbilityMultiplier('hard'))

  // A higher confidence threshold means the board panics sooner (less patient).
  assert.ok(sackConfidenceThreshold('easy') < sackConfidenceThreshold('normal'))
  assert.ok(sackConfidenceThreshold('normal') < sackConfidenceThreshold('hard'))

  // More missed objectives tolerated before a sack, on easy.
  assert.ok(objectiveFailStreakLimit('easy') > objectiveFailStreakLimit('normal'))
  assert.ok(objectiveFailStreakLimit('normal') > objectiveFailStreakLimit('hard'))
})

test('unknown difficulty values fall back to normal', () => {
  assert.equal(aiAbilityMultiplier('bogus'), aiAbilityMultiplier('normal'))
  assert.equal(difficultyLabel('bogus'), difficultyLabel('normal'))
})

test('generateSquadForClub scales generated ability by abilityMultiplier', () => {
  const club = { id: 'arsenal', reputation: 5 }
  const baseline = generateSquadForClub(club)
  const weaker = generateSquadForClub(club, { abilityMultiplier: 0.8 })
  const stronger = generateSquadForClub(club, { abilityMultiplier: 1.2 })

  const totalAbility = (squad) => squad.reduce((sum, p) => sum + p.ability, 0)
  assert.ok(totalAbility(weaker) < totalAbility(baseline))
  assert.ok(totalAbility(stronger) > totalAbility(baseline))
})
