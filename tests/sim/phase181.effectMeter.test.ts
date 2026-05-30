// Phase 181 / ISSUE-149 — Choice-Preview Legibility arc, Phase 1.
//
// Locks the meter contract `effect()` now writes onto every preview: the
// distinguishing leaf (`meterId`) and a player-facing name (`meterLabel`).
// `targetKind` collapses every staff meter to `staff` and every pressure id to
// `pressure`; these two fields recover the leaf so the card layer can name the
// meter and tell two distinct meters apart.

import { describe, expect, it } from 'vitest'

import {
  classifyMeterId,
  effect,
  resolveMeterLabel,
} from '../../src/sim/modules/issues/generatorHelpers'

describe('classifyMeterId — leaf extraction', () => {
  const cases: Array<[string, string]> = [
    ['coin', 'coin'],
    ['staff.server.loyalty', 'loyalty'],
    ['staff.cook.stress', 'stress'],
    ['areas.kitchen.cleanliness', 'cleanliness'],
    ['reputation.respectable', 'respectable'],
    ['pressure:staff_loyalty_risk', 'staff_loyalty_risk'],
    ['pressure:food_safety', 'food_safety'],
    ['customers.miners.satisfaction', 'satisfaction'],
    ['staff:cook_1', 'cook_1'],
    ['global', 'global'],
  ]
  for (const [target, meterId] of cases) {
    it(`peels "${target}" → "${meterId}"`, () => {
      expect(classifyMeterId(target)).toBe(meterId)
    })
  }
})

describe('resolveMeterLabel — player-facing names', () => {
  it('reuses the pressure registry label for pressure meters', () => {
    expect(resolveMeterLabel('pressure', 'pressure:staff_loyalty_risk', 'staff_loyalty_risk')).toBe(
      'Staff Loyalty Risk',
    )
    expect(resolveMeterLabel('pressure', 'pressure:food_safety', 'food_safety')).toBe('Food Safety')
  })

  it('names the known staff meter leaves', () => {
    expect(resolveMeterLabel('staff', 'staff.mira.loyalty', 'loyalty')).toBe('loyalty')
    expect(resolveMeterLabel('staff', 'staff.mira.morale', 'morale')).toBe('morale')
    expect(resolveMeterLabel('staff', 'staff.mira.stress', 'stress')).toBe('stress')
    expect(resolveMeterLabel('staff', 'staff.mira.fatigue', 'fatigue')).toBe('fatigue')
  })

  it('names reputation axes', () => {
    expect(resolveMeterLabel('reputation', 'reputation.respectable', 'respectable')).toBe(
      'respectable',
    )
    expect(resolveMeterLabel('reputation', 'reputation.goblinAuthentic', 'goblinAuthentic')).toBe(
      'goblin-authentic',
    )
  })

  it('humanises an otherwise-unlisted dotted meter leaf', () => {
    expect(resolveMeterLabel('customer', 'customers.miners.satisfaction', 'satisfaction')).toBe(
      'satisfaction',
    )
    expect(resolveMeterLabel('area', 'areas.kitchen.cleanliness', 'cleanliness')).toBe('cleanliness')
    expect(resolveMeterLabel('culture', 'cultures.dwarven.tension', 'tension')).toBe('tension')
  })

  it('leaves entity-id leaves on colon-prefixed cause effects unlabelled', () => {
    expect(resolveMeterLabel('staff', 'staff:cook_1', 'cook_1')).toBeUndefined()
    expect(resolveMeterLabel('global', 'global', 'global')).toBeUndefined()
  })
})

describe('effect() — emits meterId + meterLabel onto every preview', () => {
  it('populates a staff loyalty state_change', () => {
    const e = effect('state_change', 'staff.mira.loyalty', 10, 'Loyalty rises', ['staff'])
    expect(e.meterId).toBe('loyalty')
    expect(e.meterLabel).toBe('loyalty')
  })

  it('distinguishes staff stress from staff loyalty (the collapse the arc fixes)', () => {
    const loyalty = effect('state_change', 'staff.mira.loyalty', 10, 'Loyalty rises', ['staff'])
    const stress = effect('state_change', 'staff.mira.stress', -8, 'Stress drops', ['staff'])
    // Both are staff / positive / medium — only the meterId tells them apart.
    expect(loyalty.targetKind).toBe(stress.targetKind)
    expect(loyalty.direction).toBe(stress.direction)
    expect(loyalty.magnitudeBand).toBe(stress.magnitudeBand)
    expect(loyalty.meterId).not.toBe(stress.meterId)
  })

  it('populates a pressure meter from the registry', () => {
    const e = effect('pressure', 'pressure:staff_loyalty_risk', -10, 'Loyalty risk eases', [
      'pressure',
    ])
    expect(e.meterId).toBe('staff_loyalty_risk')
    expect(e.meterLabel).toBe('Staff Loyalty Risk')
  })

  it('sets meterId but omits meterLabel for a zero-amount cause effect on an entity id', () => {
    const e = effect('cause', 'staff:cook_1', 0, 'Mark gratitude', ['staff'])
    expect(e.meterId).toBe('cook_1')
    expect(e.meterLabel).toBeUndefined()
  })

  it('preserves the existing classified fields unchanged', () => {
    const e = effect('state_change', 'coin', -25, 'Pay landlord', ['coin'])
    expect(e.targetKind).toBe('coin')
    expect(e.direction).toBe('negative')
    expect(e.magnitudeBand).toBe('medium')
    expect(e.meterId).toBe('coin')
    expect(e.meterLabel).toBe('coin')
  })
})
