import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROUP_ORDER,
  REGIONS,
  findRegion,
  regionLifeExpectancy,
} from '../src/data/lifeExpectancy.js'

test('every region has a unique id and a group the UI knows how to show', () => {
  const ids = new Set()
  for (const region of REGIONS) {
    assert.ok(!ids.has(region.id), `duplicate id ${region.id}`)
    ids.add(region.id)
    assert.ok(GROUP_ORDER.includes(region.group), `unknown group ${region.group}`)
    assert.ok(region.name.length > 0)
    assert.ok(region.source.length > 0)
  }
  assert.ok(REGIONS.length > 200, 'the list should cover the world, not a sample of it')
})

test('every figure is a plausible life expectancy', () => {
  for (const region of REGIONS) {
    for (const key of ['both', 'male', 'female']) {
      const value = region[key]
      assert.ok(
        Number.isFinite(value) && value > 40 && value < 100,
        `${region.name} has an implausible ${key} figure: ${value}`,
      )
    }
    assert.ok(region.female > region.male, `${region.name} should have women living longer`)
    assert.ok(
      region.both >= region.male - 0.1 && region.both <= region.female + 0.1,
      `${region.name} has a combined figure outside its own sex split`,
    )
    assert.ok(region.hemisphere === 'n' || region.hemisphere === 's')
  }
})

test('places from all three groups are reachable by id', () => {
  assert.equal(findRegion('united-kingdom').both, 81.4)
  assert.equal(findRegion('uk-scotland').group, 'United Kingdom')
  assert.equal(findRegion('us-hawaii').group, 'United States')
  assert.equal(findRegion('nowhere'), null)
})

test('countries and their sub-national entries do not collide', () => {
  assert.notEqual(findRegion('georgia').both, findRegion('us-georgia').both)
  assert.equal(findRegion('georgia').group, 'Countries')
})

test('the sex lookup falls back to the combined figure', () => {
  const region = findRegion('japan')
  assert.equal(regionLifeExpectancy(region, 'male'), region.male)
  assert.equal(regionLifeExpectancy(region, 'female'), region.female)
  assert.equal(regionLifeExpectancy(region, 'both'), region.both)
  assert.equal(regionLifeExpectancy(region, undefined), region.both)
  assert.equal(regionLifeExpectancy(null, 'male'), null)
})

test('the southern hemisphere is actually represented', () => {
  const southern = REGIONS.filter((region) => region.hemisphere === 's')
  assert.ok(southern.length > 30)
  assert.equal(findRegion('australia').hemisphere, 's')
  assert.equal(findRegion('brazil').hemisphere, 's')
  assert.equal(findRegion('norway').hemisphere, 'n')
})
