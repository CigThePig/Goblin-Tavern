// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
//
// Locks the target-string → EffectTargetKind classification against every
// target shape we observe sim-side. Also pins the per-targetKind
// magnitude-band cutoff table and the direction sign rules. These three
// classifiers are the contract that the card-layer condition primitives
// `effectTargetKind` / `effectDirection` / `effectMagnitudeBand` read.

import { describe, expect, it } from 'vitest'

import {
  classifyDirection,
  classifyMagnitudeBand,
  classifyTargetKind,
  effect,
} from '../../src/sim/modules/issues/generatorHelpers'
import type {
  EffectMagnitudeBand,
  EffectTargetKind,
} from '../../src/sim/core/effect'

describe('classifyTargetKind — target string conventions', () => {
  // Each row mirrors a target pattern observed in
  // `src/sim/modules/issues/{issue,expanded}SeedGenerators.ts`.
  const cases: Array<[string, EffectTargetKind]> = [
    // currency + global
    ['coin', 'coin'],
    ['global', 'global'],
    ['tavern', 'global'],
    // stock
    ['stock.ale.quantity', 'stock'],
    ['stock.mushrooms.quality', 'stock'],
    ['stock.stew.salePrice', 'stock'],
    // areas
    ['areas.kitchen.cleanliness', 'area'],
    ['areas.cellar.condition', 'area'],
    ['areas.privy.damage', 'area'],
    ['areas.main_room.mess', 'area'],
    ['areas.privy.risk', 'area'],
    ['areas.kitchen.smell', 'area'],
    // customers (dotted)
    ['customers.miners.satisfaction', 'customer'],
    ['customers.miners.loyalty', 'customer'],
    ['customers.merchants.patronage', 'customer'],
    // staff (dotted)
    ['staff.cook.fatigue', 'staff'],
    ['staff.cook.morale', 'staff'],
    ['staff.bartender.loyalty', 'staff'],
    ['staff.runner.stress', 'staff'],
    // pressure
    ['pressure:food_safety', 'pressure'],
    ['pressure:landlord', 'pressure'],
    ['pressure:reputation_drift', 'pressure'],
    // memory + arc
    ['memory:staff_concern', 'memory'],
    ['arc:mushroom_blight', 'arc'],
    // reputation
    ['reputation.cozy', 'reputation'],
    ['reputation.dangerous', 'reputation'],
    // suppliers + factions + cultures (dotted)
    ['world.suppliers.gnoll_butcher.relationship', 'supplier'],
    ['world.suppliers.gnoll_butcher.reliability', 'supplier'],
    ['factions.guild.relationship', 'faction'],
    ['factions.guild.trust', 'faction'],
    ['factions.guild.fear', 'faction'],
    ['factions.guild.influence', 'faction'],
    ['cultures.dwarven.tension', 'culture'],
    ['cultures.elven.comfort', 'culture'],
    ['cultures.human.familiarity', 'culture'],
    // attribution
    ['attribution.global', 'attribution'],
    // entity-ref colon prefixes (cause effects)
    ['customer_group:miners', 'cohort'],
    ['staff:cook_1', 'staff'],
    ['regular:tomek', 'customer'],
    ['supplier:gnoll_butcher', 'supplier'],
    ['faction:guild', 'faction'],
    ['rumour:bad_ale', 'memory'],
  ]

  for (const [target, expected] of cases) {
    it(`classifies "${target}" as ${expected}`, () => {
      expect(classifyTargetKind(target)).toBe(expected)
    })
  }

  it('falls back to "other" for unknown target shapes', () => {
    expect(classifyTargetKind('something_unexpected')).toBe('other')
    expect(classifyTargetKind('mystery.thing')).toBe('other')
  })

  it('every real target observed sim-side falls outside the "other" bucket', () => {
    // The survey table above is the authoritative list of patterns
    // observed in generators. Re-state the assertion at the suite level
    // so a future contributor adding a new pattern without classifying
    // it sees this single explicit failure rather than ~20 individual
    // misses.
    for (const [target, expected] of cases) {
      expect(expected).not.toBe('other')
      expect(classifyTargetKind(target)).not.toBe('other')
    }
  })
})

describe('classifyDirection — sign rules', () => {
  it('positive amount maps to "positive"', () => {
    expect(classifyDirection(5)).toBe('positive')
    expect(classifyDirection(1)).toBe('positive')
    expect(classifyDirection(0.1)).toBe('positive')
  })

  it('negative amount maps to "negative"', () => {
    expect(classifyDirection(-5)).toBe('negative')
    expect(classifyDirection(-1)).toBe('negative')
  })

  it('zero amount maps to "neutral"', () => {
    expect(classifyDirection(0)).toBe('neutral')
  })

  it('undefined amount maps to "neutral"', () => {
    expect(classifyDirection(undefined)).toBe('neutral')
  })
})

describe('classifyDirection — valence-aware (target form)', () => {
  // Phase 164 / ISSUE-132 — lower-is-better meters invert the sign so a
  // decrease reads "positive" (good for the player).
  it('inverts lower-is-better staff meters (stress / fatigue)', () => {
    expect(classifyDirection(-8, 'staff.mira.stress')).toBe('positive')
    expect(classifyDirection(8, 'staff.x.stress')).toBe('negative')
    expect(classifyDirection(-3, 'staff.cook.fatigue')).toBe('positive')
    expect(classifyDirection(4, 'staff.runner.fatigue')).toBe('negative')
  })

  it('inverts lower-is-better area hygiene/decay meters', () => {
    expect(classifyDirection(6, 'areas.kitchen.damage')).toBe('negative')
    expect(classifyDirection(-20, 'areas.privy.damage')).toBe('positive')
    expect(classifyDirection(-10, 'areas.kitchen.smell')).toBe('positive')
    expect(classifyDirection(8, 'areas.main_room.mess')).toBe('negative')
    expect(classifyDirection(5, 'areas.privy.risk')).toBe('negative')
  })

  it('inverts lower-is-better culture tension', () => {
    expect(classifyDirection(-10, 'cultures.dwarven.tension')).toBe('positive')
    expect(classifyDirection(12, 'cultures.dwarven.tension')).toBe('negative')
  })

  it('leaves higher-is-better meters un-inverted (morale / loyalty / condition / cleanliness / comfort)', () => {
    expect(classifyDirection(15, 'staff.cook.morale')).toBe('positive')
    expect(classifyDirection(-8, 'staff.x.loyalty')).toBe('negative')
    expect(classifyDirection(20, 'areas.cellar.condition')).toBe('positive')
    // cleanliness is HIGHER-is-better — a cleaner kitchen is good. It must
    // NOT invert (inverting it would re-introduce the Phase-2 bug class).
    expect(classifyDirection(25, 'areas.kitchen.cleanliness')).toBe('positive')
    expect(classifyDirection(-12, 'areas.kitchen.cleanliness')).toBe('negative')
    expect(classifyDirection(10, 'cultures.elven.comfort')).toBe('positive')
    expect(classifyDirection(15, 'cultures.human.familiarity')).toBe('positive')
  })

  it('excludes pressure.* from valence inversion (arithmetic sign retained)', () => {
    // Pressure is stored rising = positive; its preview pool encodes
    // threat-vs-relief in the verbs. It must stay on arithmetic sign.
    expect(classifyDirection(12, 'pressure:food_safety')).toBe('positive')
    expect(classifyDirection(-12, 'pressure:food_safety')).toBe('negative')
    expect(classifyDirection(8, 'pressure:supplier_distrust')).toBe('positive')
  })

  it('the no-target form keeps raw arithmetic-sign behavior', () => {
    expect(classifyDirection(-8)).toBe('negative')
    expect(classifyDirection(5)).toBe('positive')
  })
})

describe('classifyMagnitudeBand — per-targetKind cutoff table', () => {
  // Each row exercises the boundary of one band per targetKind. The
  // table here mirrors the cutoffs in MAGNITUDE_BAND_CUTOFFS — a
  // contributor changing the cutoffs must update both.
  const cases: Array<[EffectTargetKind, number, EffectMagnitudeBand]> = [
    // coin: 5/20/50
    ['coin', 4, 'tiny'],
    ['coin', 5, 'small'],
    ['coin', 19, 'small'],
    ['coin', 20, 'medium'],
    ['coin', 49, 'medium'],
    ['coin', 50, 'large'],
    ['coin', 250, 'large'],
    // pressure: 5/10/20
    ['pressure', 4, 'tiny'],
    ['pressure', 5, 'small'],
    ['pressure', 9, 'small'],
    ['pressure', 10, 'medium'],
    ['pressure', 19, 'medium'],
    ['pressure', 20, 'large'],
    // staff: 3/8/15
    ['staff', 2, 'tiny'],
    ['staff', 3, 'small'],
    ['staff', 7, 'small'],
    ['staff', 8, 'medium'],
    ['staff', 15, 'large'],
    // area: 10/25/50
    ['area', 9, 'tiny'],
    ['area', 10, 'small'],
    ['area', 24, 'small'],
    ['area', 25, 'medium'],
    ['area', 50, 'large'],
    // stock: 10/30/60
    ['stock', 9, 'tiny'],
    ['stock', 10, 'small'],
    ['stock', 30, 'medium'],
    ['stock', 60, 'large'],
  ]

  for (const [kind, amount, expected] of cases) {
    it(`bands ${kind} amount=${amount} as ${expected} (and -amount the same)`, () => {
      expect(classifyMagnitudeBand(kind, amount)).toBe(expected)
      expect(classifyMagnitudeBand(kind, -amount)).toBe(expected)
    })
  }

  it('returns undefined for zero or missing amount', () => {
    expect(classifyMagnitudeBand('coin', 0)).toBeUndefined()
    expect(classifyMagnitudeBand('coin', undefined)).toBeUndefined()
    expect(classifyMagnitudeBand('pressure', 0)).toBeUndefined()
  })
})

describe('effect() — emits classified metadata onto every preview', () => {
  it('populates targetKind, direction, and magnitudeBand on a normal preview', () => {
    const e = effect('state_change', 'coin', -25, 'Pay landlord', ['coin'])
    expect(e.targetKind).toBe('coin')
    expect(e.direction).toBe('negative')
    expect(e.magnitudeBand).toBe('medium')
  })

  it('classifies a pressure preview (pressure excluded from valence — arithmetic sign)', () => {
    const e = effect(
      'pressure',
      'pressure:food_safety',
      -12,
      'Lower food safety risk',
      ['pressure'],
    )
    expect(e.targetKind).toBe('pressure')
    expect(e.direction).toBe('negative')
    expect(e.magnitudeBand).toBe('medium')
  })

  it('applies valence on a lower-is-better meter (staff.stress reduction reads positive)', () => {
    const e = effect(
      'state_change',
      'staff.mira.stress',
      -8,
      'Comfort Mira',
      ['staff'],
    )
    expect(e.targetKind).toBe('staff')
    expect(e.direction).toBe('positive')
    expect(e.magnitudeBand).toBe('medium')
  })

  it('applies valence on area.damage (accrual reads negative)', () => {
    const e = effect(
      'state_change',
      'areas.kitchen.damage',
      6,
      'Wear accrues',
      ['area'],
    )
    expect(e.targetKind).toBe('area')
    expect(e.direction).toBe('negative')
  })

  it('omits magnitudeBand for a zero-amount cause preview but keeps direction', () => {
    const e = effect('cause', 'staff:cook_1', 0, 'Mark gratitude', ['staff'])
    expect(e.targetKind).toBe('staff')
    expect(e.direction).toBe('neutral')
    expect(e.magnitudeBand).toBeUndefined()
  })

  it('preserves existing readable / kind / tags fields', () => {
    const e = effect(
      'state_change',
      'areas.kitchen.cleanliness',
      25,
      'Kitchen cleaner',
      ['area'],
    )
    expect(e.kind).toBe('state_change')
    expect(e.target).toBe('areas.kitchen.cleanliness')
    expect(e.amount).toBe(25)
    expect(e.readable).toBe('Kitchen cleaner')
    expect(e.tags).toEqual(['area'])
  })
})
