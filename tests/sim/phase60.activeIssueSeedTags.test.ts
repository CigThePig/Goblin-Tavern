import { describe, expect, it } from 'vitest'

import {
  computeCardWorthiness,
  buildTextIngredients,
} from '../../src/sim/modules/issues/index'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'

// Phase 60 / ISSUE-020 — `activeIssueSeedTags` consumer wiring.
//
// Active local arcs publish a set of issue-seed tags via
// `state.modules.localArcs.activeIssueSeedTags`. The seed ranker now
// awards a small worthiness bonus when a candidate seed's `domain` or
// its causes' tags intersect that set so the arc's signal influences
// ranking.

function makeSeed(overrides: Partial<IssueSeed> = {}): IssueSeed {
  const base: IssueSeed = {
    id: 'seed-1',
    family: 'food_safety',
    type: 'crisis',
    timing: 'morning_prep',
    domain: ['food'],
    severity: 50,
    urgency: 40,
    novelty: 80,
    cardWorthiness: 0,
    affectedActors: [],
    causes: [
      {
        id: 'c1',
        timestamp: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
        source: 'test',
        sourceType: 'system',
        target: 'pressure:food_safety',
        targetType: 'pressure',
        amount: 10,
        direction: 'increase',
        weight: 10,
        readable: 'mushroom spoilage spreading',
        tags: ['food_quality', 'kitchen'],
        relatedActors: [],
        relatedLocations: [],
        relatedSystems: [],
        ageDays: 0,
      },
    ],
    pressures: [],
    stakes: [
      {
        id: 's1',
        target: 'food_safety',
        readable: 'customers may get sick',
        direction: 'loss',
        tags: [],
      },
    ],
    responseSlots: [],
    consequenceProfiles: [
      {
        id: 'p1',
        responseSlotId: 'a',
        immediateEffects: [],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 20,
      },
    ],
    memoriesCreated: [],
    futureHooks: [],
    toneHints: [],
    location: { kind: 'area', id: 'kitchen' },
    textIngredients: buildTextIngredients({ subject: 'test' }),
    validation: { valid: true, errors: [], warnings: [], contractChecks: {} },
    generatedAt: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 0 },
  }
  return { ...base, ...overrides }
}

describe('Phase 60 / ISSUE-020 — activeIssueSeedTags ranking bonus', () => {
  it('awards a bonus when a seed cause tag intersects activeIssueSeedTags', () => {
    const seed = makeSeed()
    const baseInput = {
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    }
    const without = computeCardWorthiness(baseInput)
    const withMatch = computeCardWorthiness({
      ...baseInput,
      activeIssueSeedTags: ['food_quality'],
    })
    // Bonus is +6 (single award), clamped to [0, 100]. With mid-range
    // severity/urgency the base score sits well below 100 so the bonus
    // is observable.
    expect(withMatch).toBe(without + 6)
  })

  it('awards a bonus when a seed domain intersects activeIssueSeedTags', () => {
    const seed = makeSeed({ domain: ['stock', 'customers'] })
    const baseInput = {
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    }
    const without = computeCardWorthiness(baseInput)
    const withMatch = computeCardWorthiness({
      ...baseInput,
      activeIssueSeedTags: ['stock'],
    })
    expect(withMatch).toBe(without + 6)
  })

  it('does not bonus when no tag intersects', () => {
    const seed = makeSeed()
    const baseInput = {
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    }
    const without = computeCardWorthiness(baseInput)
    const withMismatch = computeCardWorthiness({
      ...baseInput,
      activeIssueSeedTags: ['unrelated_tag'],
    })
    expect(withMismatch).toBe(without)
  })

  it('awards bonus once per seed regardless of match count', () => {
    const seed = makeSeed({ domain: ['food', 'kitchen'] })
    const baseInput = {
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    }
    const without = computeCardWorthiness(baseInput)
    // Three matching tags (one in domain, two in cause tags) — still +6.
    const withMatch = computeCardWorthiness({
      ...baseInput,
      activeIssueSeedTags: ['food', 'food_quality', 'kitchen'],
    })
    expect(withMatch).toBe(without + 6)
  })

  it('empty activeIssueSeedTags is a no-op', () => {
    const seed = makeSeed()
    const baseInput = {
      seed,
      templateId: 't',
      cooldowns: {},
      absoluteDay: 10,
    }
    const without = computeCardWorthiness(baseInput)
    const withEmpty = computeCardWorthiness({
      ...baseInput,
      activeIssueSeedTags: [],
    })
    expect(withEmpty).toBe(without)
  })
})
