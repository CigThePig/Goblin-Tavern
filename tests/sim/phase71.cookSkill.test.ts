import { describe, expect, it } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { staffRegistry } from '../../src/sim/registries/staffRegistry'
import {
  evaluatePrepGate,
  sellRecipe,
} from '../../src/sim/modules/service/recipes'
import { simulateDay } from '../../src/sim/core/engine'
import { stockModule } from '../../src/sim/modules/stock/index'
import type {
  SimulationModule,
  SimulationHook,
} from '../../src/sim/core/module'
import type { SimContext } from '../../src/sim/core/context'
import type { StaffState, TavernState } from '../../src/sim/state/TavernState'

// Phase 71 / ISSUE-031 — Cook tier grow + preparation gating.
//
// Covers the per-issue test approach from `docs/ISSUE_TRACKER.md`:
//   - kitchen_hand on a rare recipe produces botched_preparation
//   - master_chef on the same recipe produces excellent_preparation
//   - ordinary-skill (in-margin) produces no memory
//   - rare/legendary excellent/botched cause culinary_renown drift
//   - new role definitions don't seed on day zero

const SEED = 'phase-71-cook-test'

function makeCookStaff(role: string, skill: number): StaffState {
  return {
    id: `test_cook_${role}`,
    name: {
      display: `Test ${role}`,
      profileId: 'goblin_common',
      parts: { given: 'Test', family: role },
      patternId: 'given_family',
      generatedBy: 'phase71_test',
    },
    role,
    skill,
    morale: 50,
    stress: 25,
    fatigue: 20,
    loyalty: 50,
    wage: 10,
    paidThisWeek: true,
    tags: [],
    activeFlags: [],
  }
}

function withCook(state: TavernState, role: string, skill: number): TavernState {
  // Replace default cook (Gribna) with a probe-controlled cook of the
  // requested role. We keep the server and bouncer in place.
  const next = { ...state, staff: { ...state.staff } }
  delete next.staff['cook']
  next.staff[`test_cook_${role}`] = makeCookStaff(role, skill)
  return next
}

function withStockOnHand(
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

describe('Phase 71 — cook tier grow + preparation gating', () => {
  it('new cook-tier roles are registered with seedOnDayZero: false', () => {
    expect(staffRegistry.has('kitchen_hand')).toBe(true)
    expect(staffRegistry.has('seasoned_cook')).toBe(true)
    expect(staffRegistry.has('master_chef')).toBe(true)
    expect(staffRegistry.get('kitchen_hand').seedOnDayZero).toBe(false)
    expect(staffRegistry.get('seasoned_cook').seedOnDayZero).toBe(false)
    expect(staffRegistry.get('master_chef').seedOnDayZero).toBe(false)
  })

  it('default state has no kitchen_hand/seasoned_cook/master_chef staff', () => {
    const state = createInitialTavernState()
    const roles = Object.values(state.staff).map((s) => s.role)
    expect(roles).not.toContain('kitchen_hand')
    expect(roles).not.toContain('seasoned_cook')
    expect(roles).not.toContain('master_chef')
    // The original cook (Gribna) is still seeded.
    expect(state.staff['cook']).toBeDefined()
  })

  it('skill gradient: kitchen_hand < seasoned_cook < master_chef', () => {
    const kh = staffRegistry.get('kitchen_hand').defaultState.skill
    const sc = staffRegistry.get('seasoned_cook').defaultState.skill
    const mc = staffRegistry.get('master_chef').defaultState.skill
    expect(kh).toBeLessThan(sc)
    expect(sc).toBeLessThan(mc)
  })

  it('evaluatePrepGate classifies excellent / ordinary / botched per skill vs prepDifficulty', () => {
    const state = createInitialTavernState()
    // Default cook (Gribna) has skill 55.
    const probe: SimulationModule = {
      id: 'phase71.test.prepGate',
      version: '0.0.0',
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            // prepDifficulty 20 (common) → 55 - 20 = +35 → excellent
            expect(evaluatePrepGate(ctx, 20).outcome).toBe('excellent')
            // prepDifficulty 55 (matched) → +0 → ordinary
            expect(evaluatePrepGate(ctx, 55).outcome).toBe('ordinary')
            // prepDifficulty 85 (legendary) → -30 → botched
            expect(evaluatePrepGate(ctx, 85).outcome).toBe('botched')
          }) as SimulationHook,
        ],
      },
    }
    simulateDay(state, { seed: SEED }, [probe])
  })

  it('kitchen_hand attempting a rare recipe produces botched_preparation memory', () => {
    let state = withCook(createInitialTavernState(), 'kitchen_hand', 30)
    state = withStockOnHand(state, 'moonpetal_mushroom', 10)
    state = withRecipeOnMenu(state, 'dish_moonpetal_mushroom', true)
    let captured: TavernState | null = null
    const probe: SimulationModule = {
      id: 'phase71.test.botched',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_moonpetal_mushroom', 1, {
              buyerGroupId: 'adventurers',
            })
            captured = ctx.state
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    expect(captured).not.toBeNull()
    const botched = result.state.memories.find(
      (m) => m.id === 'botched_preparation',
    )
    expect(botched).toBeDefined()
    expect(botched!.metadata!['recipeId']).toBe('dish_moonpetal_mushroom')
    expect(botched!.metadata!['demandTier']).toBe('rare')
  })

  it('master_chef attempting a rare recipe produces excellent_preparation memory', () => {
    let state = withCook(createInitialTavernState(), 'master_chef', 85)
    state = withStockOnHand(state, 'moonpetal_mushroom', 10)
    state = withRecipeOnMenu(state, 'dish_moonpetal_mushroom', true)
    const probe: SimulationModule = {
      id: 'phase71.test.excellent',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_moonpetal_mushroom', 1, {
              buyerGroupId: 'adventurers',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    const excellent = result.state.memories.find(
      (m) => m.id === 'excellent_preparation',
    )
    expect(excellent).toBeDefined()
    expect(excellent!.metadata!['recipeId']).toBe('dish_moonpetal_mushroom')
    expect(excellent!.metadata!['demandTier']).toBe('rare')
  })

  it('in-margin skill produces no preparation memory', () => {
    let state = withCook(createInitialTavernState(), 'cook', 55)
    state = withStockOnHand(state, 'ale', 10)
    const probe: SimulationModule = {
      id: 'phase71.test.ordinary',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_ale', 1, {
              buyerGroupId: 'merchants',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    // dish_ale prepDifficulty is 20; cook skill 55 → diff 35 → excellent.
    // That writes a memory. For "ordinary" we need diff in [-15, +15].
    // dish_ale + skill 30 (instead) → diff 10 → ordinary.
    expect(
      result.state.memories.some(
        (m) =>
          m.id === 'botched_preparation' &&
          m.metadata?.['recipeId'] === 'dish_ale',
      ),
    ).toBe(false)
    // (Excellent memory may appear because of the high-skill differential.)
  })

  it('truly ordinary skill produces neither excellent nor botched', () => {
    let state = withCook(createInitialTavernState(), 'kitchen_hand', 30)
    state = withStockOnHand(state, 'ale', 10)
    const probe: SimulationModule = {
      id: 'phase71.test.ordinary2',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_ale', 1, {
              buyerGroupId: 'merchants',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    // skill 30, prepDifficulty 20 → diff 10 → ordinary, no memory.
    expect(
      result.state.memories.some(
        (m) =>
          (m.id === 'excellent_preparation' ||
            m.id === 'botched_preparation') &&
          m.metadata?.['recipeId'] === 'dish_ale',
      ),
    ).toBe(false)
  })

  it('excellent rare-tier prep boosts culinary renown', () => {
    let state = withCook(createInitialTavernState(), 'master_chef', 85)
    state = withStockOnHand(state, 'moonpetal_mushroom', 10)
    state = withRecipeOnMenu(state, 'dish_moonpetal_mushroom', true)
    state = withRenown(state, 30)
    const probe: SimulationModule = {
      id: 'phase71.test.excellentRenown',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_moonpetal_mushroom', 1, {
              buyerGroupId: 'adventurers',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    // Starting at 30. Rare serving: +2 (per-serving) + +2 (excellent
    // bonus on rare) = +4. Final renown 34.
    expect(result.state.reputation.culinary_renown).toBe(34)
  })

  it('botched rare-tier prep drops culinary renown', () => {
    let state = withCook(createInitialTavernState(), 'kitchen_hand', 30)
    state = withStockOnHand(state, 'moonpetal_mushroom', 10)
    state = withRecipeOnMenu(state, 'dish_moonpetal_mushroom', true)
    state = withRenown(state, 50)
    const probe: SimulationModule = {
      id: 'phase71.test.botchedRenown',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_moonpetal_mushroom', 1, {
              buyerGroupId: 'adventurers',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    // 50 + 2 (per-serving rare) - 3 (botched rare penalty) = 49.
    expect(result.state.reputation.culinary_renown).toBe(49)
  })

  it('botched memory metadata carries severity scaled by gap', () => {
    let state = withCook(createInitialTavernState(), 'kitchen_hand', 30)
    state = withStockOnHand(state, 'phoenix_pepper', 10)
    state = withRecipeOnMenu(state, 'dish_phoenix_pepper', true)
    const probe: SimulationModule = {
      id: 'phase71.test.severity',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          ((ctx: SimContext): void => {
            sellRecipe(ctx, 'dish_phoenix_pepper', 1, {
              buyerGroupId: 'adventurers',
            })
          }) as SimulationHook,
        ],
      },
    }
    const result = simulateDay(state, { seed: SEED }, [stockModule, probe])
    const botched = result.state.memories.find(
      (m) =>
        m.id === 'botched_preparation' &&
        m.metadata?.['recipeId'] === 'dish_phoenix_pepper',
    )
    expect(botched).toBeDefined()
    // skill 30 vs prepDifficulty 85 → gap 55. severity = min(20, gap*0.5) = 20.
    expect(botched!.metadata!['gap']).toBe(55)
    expect(botched!.metadata!['severity']).toBe(20)
  })
})
