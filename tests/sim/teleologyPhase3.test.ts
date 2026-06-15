import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { LIQUOR_LICENSE_TRANSFORMATION_ID } from '../../src/sim/modules/ventures'
import {
  getActiveTransformationTags,
} from '../../src/sim/modules/issues/transformationGatedGenerators'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { IssueSeed } from '../../src/sim/modules/issues/issueSeedTypes'

// Phase 3 (teleology) — generator-level family gating tests.
//
// These tests verify:
// 1. getActiveTransformationTags collects tags only from active transformations.
// 2. The liquor_compliance generator fires before the transformation is active
//    and retires after the transformation is activated.
// 3. The licensed_service generator is locked until the transformation is
//    active, then fires once it is.

function seedsOf(state: TavernState): IssueSeed[] {
  return (
    state.modules.issueSeeds as { seedsToday: IssueSeed[] }
  ).seedsToday
}

/** Add strong ale stock quantity to the state. */
function withAleStock(state: TavernState): TavernState {
  const existing = state.stock['ale']
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: {
        ...(existing ?? {
          id: 'ale',
          label: 'Ale',
          quality: 80,
          spoilage: 0,
          basePrice: 3,
          salePrice: 5,
          tags: ['drink', 'ale'],
          rarity: 'common',
        }),
        quantity: 100,
      },
    },
  } as TavernState
}

/**
 * Set state properties that drive inspection pressure above the liquor_compliance
 * threshold (15). Uses actual state props that the pressure calculator reads
 * (not snapshot injection, which gets overwritten each day).
 *
 * kitchen cleanliness <= 35 → +6
 * privy smell >= 65         → +6
 * reputation.filthy >= 55   → +6
 * Total: 18 > threshold of 15
 */
function withHighInspectionConditions(state: TavernState): TavernState {
  const kitchen = state.areas['kitchen']
  const privy = state.areas['privy']
  return {
    ...state,
    areas: {
      ...state.areas,
      ...(kitchen
        ? {
            kitchen: {
              ...kitchen,
              cleanliness: 10, // ≤ 35 → triggers KITCHEN_FILTHY +6
              smell: 20,
            },
          }
        : {}),
      ...(privy
        ? {
            privy: {
              ...privy,
              smell: 80, // ≥ 65 → triggers PRIVY_STINK +6
              cleanliness: 10,
            },
          }
        : {}),
    },
    reputation: {
      ...state.reputation,
      filthy: 70, // ≥ 55 → triggers FILTHY_REP +6 (total: 18 > threshold 15)
    },
  }
}

/** Activate the licensed_liquor_service transformation on a state. */
function withLicenseActive(state: TavernState, day = 0): TavernState {
  return {
    ...state,
    transformations: {
      ...state.transformations,
      [LIQUOR_LICENSE_TRANSFORMATION_ID]: {
        id: LIQUOR_LICENSE_TRANSFORMATION_ID,
        label: 'Licensed liquor service',
        active: true,
        tags: ['liquor_license', 'ratchet'],
        createdAtDay: 0,
        activatedAtDay: day,
      },
    },
  }
}

describe('teleology phase 3 transformations', () => {
  it('getActiveTransformationTags returns tags from active transformations only', () => {
    const state = createInitialTavernState()
    // Add one active and one inactive transformation
    const stateWithTransformations: TavernState = {
      ...state,
      transformations: {
        active_transform: {
          id: 'active_transform',
          label: 'Active one',
          active: true,
          tags: ['tag_a', 'tag_b'],
          createdAtDay: 0,
          activatedAtDay: 0,
        },
        inactive_transform: {
          id: 'inactive_transform',
          label: 'Inactive one',
          active: false,
          tags: ['tag_c', 'tag_d'],
          createdAtDay: 0,
        },
      },
    }

    const tags = getActiveTransformationTags(stateWithTransformations)
    expect(tags).toContain('tag_a')
    expect(tags).toContain('tag_b')
    expect(tags).not.toContain('tag_c')
    expect(tags).not.toContain('tag_d')
  })

  it('liquorCompliance generator fires before transformation and retires after', () => {
    // Build a state that should trigger liquor_compliance:
    // - ale stock present
    // - conditions that drive inspection pressure above threshold (15)
    // - NO liquor_license transformation
    const baseState = withAleStock(
      withHighInspectionConditions(createInitialTavernState()),
    )

    // Warm up one day so causes from pressure calculation accumulate
    // (the generator reads `recentCauseEntries` which requires previous-day causes)
    const warmResult = simulateDay(
      baseState,
      { seed: 'phase3-retire-warm' },
      FULL_PIPELINE,
    )
    // Keep the inspection-driving conditions alive for the real test run
    const readyState = withAleStock(
      withHighInspectionConditions(warmResult.state),
    )

    const result1 = simulateDay(
      readyState,
      { seed: 'phase3-retire-before' },
      FULL_PIPELINE,
    )
    const seeds1 = seedsOf(result1.state)
    // The generator should have fired (inspection pressure + ale stock, no transformation)
    expect(seeds1.some((s) => s.family === 'liquor_compliance')).toBe(true)

    // Now activate the transformation, keeping the same conditions
    // so the generator would fire IF it weren't retired
    const transformedState = withLicenseActive(
      withAleStock(withHighInspectionConditions(result1.state)),
      result1.state.calendar.totalDaysElapsed,
    )

    const result2 = simulateDay(
      transformedState,
      { seed: 'phase3-retire-after' },
      FULL_PIPELINE,
    )
    const seeds2 = seedsOf(result2.state)
    // With the transformation active, the generator must NOT fire
    expect(seeds2.some((s) => s.family === 'liquor_compliance')).toBe(false)
  })

  it('licensedService generator is locked until transformation and fires after', () => {
    // Without the transformation: generator must NOT fire
    const baseState = withAleStock(createInitialTavernState())

    const result1 = simulateDay(
      baseState,
      { seed: 'phase3-lock-before' },
      FULL_PIPELINE,
    )
    const seeds1 = seedsOf(result1.state)
    expect(seeds1.some((s) => s.family === 'licensed_service')).toBe(false)

    // Activate the transformation and keep ale stock present
    const transformedState = withAleStock(
      withLicenseActive(
        result1.state,
        result1.state.calendar.totalDaysElapsed,
      ),
    )

    const result2 = simulateDay(
      transformedState,
      { seed: 'phase3-lock-after' },
      FULL_PIPELINE,
    )
    const seeds2 = seedsOf(result2.state)
    // With the transformation active, the generator should fire
    expect(seeds2.some((s) => s.family === 'licensed_service')).toBe(true)
  })

  it('licensed_service seeds have at least one real consequence-profile effect (guardrail §9)', () => {
    // Guardrail §9: scan ACTUALLY generated seeds, not inline arrays.
    const baseState = withAleStock(
      withLicenseActive(createInitialTavernState(), 0),
    )
    const result = simulateDay(
      baseState,
      { seed: 'phase3-guardrail-licensed-service' },
      FULL_PIPELINE,
    )
    const seeds = seedsOf(result.state).filter(
      (s) => s.family === 'licensed_service',
    )
    // Only assert guardrail if the generator actually fired
    if (seeds.length === 0) return
    const effects = seeds.flatMap((s) =>
      s.consequenceProfiles.flatMap((p) => [
        ...p.immediateEffects,
        ...p.delayedEffects,
      ]),
    )
    expect(effects.length).toBeGreaterThanOrEqual(1)
  })

  it('liquor_compliance seeds have at least one real consequence-profile effect (guardrail §9)', () => {
    // Guardrail §9: scan ACTUALLY generated seeds.
    // Warm up first to accumulate causes, then test.
    const baseState = withAleStock(
      withHighInspectionConditions(createInitialTavernState()),
    )
    const warmResult = simulateDay(
      baseState,
      { seed: 'phase3-guardrail-compliance-warm' },
      FULL_PIPELINE,
    )
    const readyState = withAleStock(
      withHighInspectionConditions(warmResult.state),
    )
    const result = simulateDay(
      readyState,
      { seed: 'phase3-guardrail-compliance' },
      FULL_PIPELINE,
    )
    const seeds = seedsOf(result.state).filter(
      (s) => s.family === 'liquor_compliance',
    )
    // Only assert guardrail if the generator actually fired
    if (seeds.length === 0) return
    const effects = seeds.flatMap((s) =>
      s.consequenceProfiles.flatMap((p) => [
        ...p.immediateEffects,
        ...p.delayedEffects,
      ]),
    )
    expect(effects.length).toBeGreaterThanOrEqual(1)
  })
})
