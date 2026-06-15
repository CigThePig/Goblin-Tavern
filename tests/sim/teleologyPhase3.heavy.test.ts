import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import {
  LIQUOR_LICENSE_TRANSFORMATION_ID,
  LIQUOR_LICENSE_VENTURE_ID,
} from '../../src/sim/modules/ventures'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { IssueSeed, ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'

// Phase 3 (teleology) — heavy playtest for generator-level family gating.
//
// Runs a 30-60 day simulation that:
// 1. Spawns the liquor-license venture and invests until the transformation fires.
// 2. After the transformation is active, asserts that:
//    a. 'liquor_compliance' never appears again across the remaining days.
//    b. 'licensed_service' appears at least once across the remaining days.

function seedsOf(state: TavernState): IssueSeed[] {
  return (
    state.modules.issueSeeds as { seedsToday: IssueSeed[] }
  ).seedsToday
}

function investIntent(seedId: string): ResponseIntent {
  return {
    id: `intent_${seedId}`,
    seedId,
    verb: 'upgrade',
    shape: 'long_term_investment',
    target: { kind: 'system', id: `venture:${LIQUOR_LICENSE_VENTURE_ID}` },
    tags: ['teleology', 'venture'],
    intensity: 1,
  }
}

/** Inject ale stock so gated generators can fire when the transformation gate allows. */
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

describe('teleology phase 3 heavy playtest — transformation gating over many days', () => {
  it(
    'liquor_compliance retires and licensed_service fires after venture completes',
    () => {
      const TOTAL_DAYS = 45
      const SEED_PREFIX = 'teleology-phase3-heavy'

      // Phase 1: run until the transformation fires via venture investment.
      // Spawn the venture on day 0 and invest for the first few days.
      let state = withAleStock(createInitialTavernState())
      let transformationActiveDay = -1

      // Days 0..TOTAL_DAYS-1
      const complianceAfterTransformation: boolean[] = []
      const licensedServiceAfterTransformation: boolean[] = []

      for (let day = 0; day < TOTAL_DAYS; day += 1) {
        // Decide response intents
        let responseIntents: ResponseIntent[] = []

        if (day === 0) {
          // Spawn the venture on day 0 via devOptions
          const result = simulateDay(
            state,
            {
              seed: `${SEED_PREFIX}-${day}`,
              devOptions: { spawnVenture: LIQUOR_LICENSE_VENTURE_ID },
            },
            FULL_PIPELINE,
          )
          state = withAleStock(result.state)
          continue
        }

        // While the venture is active and not yet licensed, invest
        if (
          state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.status === 'active' &&
          state.ventures[LIQUOR_LICENSE_VENTURE_ID]?.stage !== 'licensed' &&
          transformationActiveDay < 0
        ) {
          const ventureSeed = seedsOf(state).find((s) => s.family === 'venture')
          if (ventureSeed) {
            responseIntents = [investIntent(ventureSeed.id)]
          }
        }

        const result = simulateDay(
          state,
          { seed: `${SEED_PREFIX}-${day}`, responseIntents },
          FULL_PIPELINE,
        )
        state = withAleStock(result.state)

        // Detect when the transformation first activates
        const transformation = state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID]
        if (
          transformationActiveDay < 0 &&
          transformation?.active === true
        ) {
          transformationActiveDay = day
        }

        // Track family occurrences AFTER the transformation is active
        if (transformationActiveDay >= 0 && day > transformationActiveDay) {
          const seeds = seedsOf(state)
          complianceAfterTransformation.push(
            seeds.some((s) => s.family === 'liquor_compliance'),
          )
          licensedServiceAfterTransformation.push(
            seeds.some((s) => s.family === 'licensed_service'),
          )
        }
      }

      // The transformation must have activated before the end of the run.
      expect(transformationActiveDay).toBeGreaterThanOrEqual(0)
      expect(
        state.transformations[LIQUOR_LICENSE_TRANSFORMATION_ID]?.active,
      ).toBe(true)

      // After the transformation, liquor_compliance must NEVER appear.
      expect(
        complianceAfterTransformation.every((fired) => !fired),
      ).toBe(true)

      // After the transformation, licensed_service must appear at least once.
      expect(
        licensedServiceAfterTransformation.some((fired) => fired),
      ).toBe(true)
    },
  )
})
