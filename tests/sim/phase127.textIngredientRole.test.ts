// Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1.
//
// Exhaustiveness + role-assignment contract for `TEXT_INGREDIENT_ROLE`.
// Backs the cards-contract §3.3 signal-backed / flavor-seed split: any
// new field added to `TextIngredients` must declare a role here or
// this test fails by design.

import { describe, expect, it } from 'vitest'

import {
  TEXT_INGREDIENT_LIMITS,
  TEXT_INGREDIENT_ROLE,
  type TextIngredients,
} from '../../src/sim/modules/issues/issueSeedTypes'

describe('TEXT_INGREDIENT_ROLE', () => {
  it('keys match TEXT_INGREDIENT_LIMITS exactly', () => {
    const limitsKeys = Object.keys(TEXT_INGREDIENT_LIMITS).sort()
    const roleKeys = Object.keys(TEXT_INGREDIENT_ROLE).sort()
    expect(roleKeys).toEqual(limitsKeys)
  })

  it('every entry is either signal-backed or flavor-seed', () => {
    for (const [key, role] of Object.entries(TEXT_INGREDIENT_ROLE)) {
      expect(role).toMatch(/^(signal-backed|flavor-seed)$/)
      // satisfies the (unused) keyof check at compile-time
      void (key as keyof TextIngredients)
    }
  })

  it('numeric/relational fields are signal-backed', () => {
    const expected: Array<keyof TextIngredients> = [
      'recentContext',
      'pressureContext',
      'marketContext',
      'perceivedBlame',
    ]
    for (const key of expected) {
      expect(TEXT_INGREDIENT_ROLE[key]).toBe('signal-backed')
    }
  })

  it('sensory + narrative fields are flavor-seed', () => {
    const expected: Array<keyof TextIngredients> = [
      'sensoryDetails',
      'actorOpinions',
      'socialContext',
      'relevantMemories',
      'calendarContext',
      'arcContext',
    ]
    for (const key of expected) {
      expect(TEXT_INGREDIENT_ROLE[key]).toBe('flavor-seed')
    }
  })

  it('structural / referential fields are flavor-seed (not truth claims)', () => {
    const expected: Array<keyof TextIngredients> = [
      'subject',
      'problemNoun',
      'stakesReadable',
      'namedEntities',
    ]
    for (const key of expected) {
      expect(TEXT_INGREDIENT_ROLE[key]).toBe('flavor-seed')
    }
  })
})
