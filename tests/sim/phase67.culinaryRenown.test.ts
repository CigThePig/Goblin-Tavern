import { describe, expect, it } from 'vitest'

import { reputationRegistry } from '../../src/sim/registries/reputationRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState, safeValidateState } from '../../src/sim/state/validation'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { runOneDay } from '../../src/sim/testing/simRunner'
import { applyRenownDrift } from '../../src/sim/modules/service/renown'
import { sellRecipe } from '../../src/sim/modules/service/recipes'
import { simulateDay } from '../../src/sim/core/engine'
import { stockModule } from '../../src/sim/modules/stock/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import type { SimContext } from '../../src/sim/core/context'
import type {
  SimulationModule,
  SimulationHook,
} from '../../src/sim/core/module'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 67 / ISSUE-027 — Culinary renown reputation axis.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - reputation round-trips through Zod with culinary_renown
//   - serving an uncommon+ recipe writes a positive renown drift +
//     cause with non-empty relatedActors
//   - botched rare-tier+ prep wires in phase 71; phase 67 verifies
//     the producer surface exists via direct helper calls
//   - a 30-day common-only playtest shows culinary_renown drifting
//     slowly downward

const SEED = 'phase-67-renown-test'

function withStockQuantity(
  state: TavernState,
  id: string,
  quantity: number,
): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      [id]: { ...state.stock[id]!, quantity },
    },
  }
}

function withRecipeOnMenu(
  state: TavernState,
  id: string,
  onMenu = true,
): TavernState {
  return {
    ...state,
    recipes: {
      ...state.recipes,
      [id]: { ...state.recipes[id]!, onMenu },
    },
  }
}

function withRenown(state: TavernState, value: number): TavernState {
  return {
    ...state,
    reputation: { ...state.reputation, culinary_renown: value },
  }
}

describe('Phase 67 — culinary renown reputation axis', () => {
  it('culinary_renown axis is part of ReputationState and seeded at 10', () => {
    const state = createInitialTavernState()
    expect(state.reputation.culinary_renown).toBe(10)
    const validated = validateState(state)
    expect(validated.reputation.culinary_renown).toBe(10)
  })

  it('reputation registry now has culinary_renown', () => {
    expect(reputationRegistry.has('culinary_renown')).toBe(true)
    const def = reputationRegistry.get('culinary_renown')
    expect(def.tags).toContain('fame')
  })

  it('rejects state missing culinary_renown field', () => {
    const state = createInitialTavernState() as unknown as Record<
      string,
      unknown
    >
    const reputation = { ...(state['reputation'] as Record<string, unknown>) }
    delete reputation['culinary_renown']
    state['reputation'] = reputation
    const result = safeValidateState(state)
    expect(result.success).toBe(false)
  })

  it('applyRenownDrift moves the meter and writes a cause with relatedActors', () => {
    const state = createInitialTavernState()
    const probe: SimulationModule = {
      id: 'phase67.test.applyDrift',
      version: '0.0.0',
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            applyRenownDrift(ctx, 5, {
              source: 'phase67.test',
              readable: 'test drift',
              tags: ['test'],
              relatedActors: [{ kind: 'recipe', id: 'dish_ale' }],
            })
          }) as SimulationHook,
        ],
      },
    }
    const out = simulateDay(state, { seed: SEED }, [probe])
    expect(out.state.reputation.culinary_renown).toBe(15)
    const renownCauses = out.state.causes.filter(
      (c) => c.target === 'reputation.culinary_renown',
    )
    expect(renownCauses.length).toBeGreaterThan(0)
    expect(renownCauses[0]!.relatedActors.length).toBeGreaterThan(0)
  })

  it('serving an uncommon recipe nudges culinary_renown upward via cause', () => {
    let state = createInitialTavernState()
    // Give the player some bog truffle and put dish_bog_truffle onMenu.
    state = withStockQuantity(state, 'bog_truffle', 5)
    state = withRecipeOnMenu(state, 'dish_bog_truffle', true)
    const startRenown = state.reputation.culinary_renown
    let capturedRenown: number | null = null
    const probe: SimulationModule = {
      id: 'phase67.test.sellUncommon',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_bog_truffle', 3, {
              buyerGroupId: 'merchants',
            })
            capturedRenown = ctx.state.reputation.culinary_renown
          }) as SimulationHook,
        ],
      },
    }
    simulateDay(state, { seed: SEED }, [stockModule, probe])
    expect(capturedRenown).not.toBeNull()
    // Uncommon recipe served 3× → drift +3 per the per-serving table.
    expect(capturedRenown! - startRenown).toBe(3)
  })

  it('serving a rare recipe drives a larger drift than uncommon', () => {
    let state = createInitialTavernState()
    state = withStockQuantity(state, 'moonpetal_mushroom', 5)
    state = withRecipeOnMenu(state, 'dish_moonpetal_mushroom', true)
    let capturedRenown: number | null = null
    const probe: SimulationModule = {
      id: 'phase67.test.sellRare',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_moonpetal_mushroom', 2, {
              buyerGroupId: 'adventurers',
            })
            capturedRenown = ctx.state.reputation.culinary_renown
          }) as SimulationHook,
        ],
      },
    }
    simulateDay(state, { seed: SEED }, [stockModule, probe])
    // Rare = +2 per serving × 2 servings = +4.
    expect(capturedRenown! - state.reputation.culinary_renown).toBe(4)
  })

  it('rare-tier ingredient spoiling drives a negative renown drift + memory', () => {
    let state = createInitialTavernState()
    state = withStockQuantity(state, 'moonpetal_mushroom', 5)
    // Push spoilage right up to the threshold so the next daily
    // pass crosses it.
    state = {
      ...state,
      stock: {
        ...state.stock,
        moonpetal_mushroom: {
          ...state.stock['moonpetal_mushroom']!,
          spoilage: 79,
        },
      },
    }
    state = withRenown(state, 50)
    let observed: TavernState | null = null
    const probe: SimulationModule = {
      id: 'phase67.test.spoilProbe',
      version: '0.0.0',
      hooks: {
        endDay: [
          ((ctx: SimContext): void => {
            observed = ctx.state
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    expect(observed).not.toBeNull()
    const finalRenown = result.state.reputation.culinary_renown
    expect(finalRenown).toBeLessThan(50)
    const spoiledMemory = result.state.memories.find(
      (m) => m.id === 'rare_ingredient_spoiled',
    )
    expect(spoiledMemory).toBeDefined()
    // Cause attribution: relatedActors non-empty per ISSUE-003 rule.
    const decayCauses = result.state.causes.filter(
      (c) =>
        c.target === 'reputation.culinary_renown' && c.amount < 0,
    )
    expect(decayCauses.length).toBeGreaterThan(0)
    expect(decayCauses[0]!.relatedActors.length).toBeGreaterThan(0)
  })

  it('a common-only run for ~30 days drifts culinary_renown downward', () => {
    // Initial value 10 — the common-only decay (kicks in after 7 days)
    // will pull it toward 0 over a 30-day stretch. Default service
    // serves dish_ale/dish_stew/dish_mushrooms (all common) so the
    // decay applies naturally.
    let state = withRenown(createInitialTavernState(), 50)
    for (let i = 0; i < 30; i += 1) {
      state = runOneDay(state, { seed: `${SEED}-${i}` }).state
    }
    expect(state.reputation.culinary_renown).toBeLessThan(50)
  })

  it('common-only decay does not fire when an uncommon+ recipe is served regularly', () => {
    let state = createInitialTavernState()
    state = withStockQuantity(state, 'bog_truffle', 200)
    state = withRecipeOnMenu(state, 'dish_bog_truffle', true)
    state = withRenown(state, 50)
    // Drive an uncommon-recipe sale each day via a probe; the recipes
    // endDay hook keeps daysSinceLastServed below the 7-day threshold
    // so the decay never fires. Use the full pipeline so all module
    // dependencies are satisfied.
    const probe: SimulationModule = {
      id: 'phase67.test.serveUncommonDaily',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_bog_truffle', 1, {
              buyerGroupId: 'merchants',
            })
          }) as SimulationHook,
        ],
      },
    }
    const pipeline: ReadonlyArray<SimulationModule> = [
      ...FULL_PIPELINE,
      probe,
    ]
    let current = state
    for (let i = 0; i < 14; i += 1) {
      current = runOneDay(current, { seed: `${SEED}-${i}` }, pipeline).state
    }
    // Renown should be at or above the starting value (no common-only
    // decay fires because uncommon recipe served daily).
    expect(current.reputation.culinary_renown).toBeGreaterThanOrEqual(50)
  })
})
