import { describe, expect, it } from 'vitest'

import { createStateDiff } from '../../src/sim/core/diff'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type {
  Expedition,
  HireableAdventurer,
  RecipeState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 75 — ISSUE-035: `createStateDiff` extension for recipes,
// expeditions, and `world.hireableAdventurers`.
//
// The phase-42 cause-coverage audit reads `getDiff('day').changes[]`
// and asks "did anything significant move without a matching cause?"
// Three top-level state slices that are actively mutated by the
// production pipeline (recipes via `ctx.modifyRecipe`, expeditions
// via the resolution path, adventurers via `ctx.modifyHireableAdventurer`)
// were silently absent from the walk before this phase. The tests
// below construct minimal before/after states and assert the diff
// surfaces the right changes through the right paths.

function withRecipe(state: TavernState, recipe: RecipeState): TavernState {
  return { ...state, recipes: { ...state.recipes, [recipe.id]: recipe } }
}

function withAdventurer(
  state: TavernState,
  adv: HireableAdventurer,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      hireableAdventurers: {
        ...state.world.hireableAdventurers,
        [adv.id]: adv,
      },
    },
  }
}

function withActiveExpedition(
  state: TavernState,
  exp: Expedition,
): TavernState {
  return {
    ...state,
    expeditions: {
      ...state.expeditions,
      active: [...state.expeditions.active, exp],
    },
  }
}

function sampleRecipe(overrides: Partial<RecipeState> = {}): RecipeState {
  return {
    id: 'recipe_stew',
    label: 'Cabbage Stew',
    tags: ['food', 'common'],
    onMenu: false,
    timesServed: 0,
    daysSinceLastServed: 0,
    lastServedDay: null,
    ...overrides,
  }
}

function sampleAdventurer(
  overrides: Partial<HireableAdventurer> = {},
): HireableAdventurer {
  return {
    id: 'adv_zarka',
    name: {
      display: 'Zarka the Bold',
      profileId: 'adventuring_bands',
      parts: { given: 'Zarka', title: 'the Bold' },
      patternId: 'given_title',
      generatedBy: 'phase75-test',
    },
    cultureId: 'adventuring_bands',
    experience: 40,
    reliability: 50,
    relationship: 30,
    specialty: null,
    wageBase: 5,
    daysSinceLastJob: 0,
    currentExpeditionId: null,
    joinedDay: 1,
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

function sampleExpedition(overrides: Partial<Expedition> = {}): Expedition {
  return {
    id: 'exp_1',
    runnerId: 'adv_zarka',
    mode: 'open',
    targetTier: 'uncommon',
    targetIngredientId: null,
    daysTotal: 3,
    daysElapsed: 0,
    costPaid: 15,
    startedDay: 1,
    status: 'in_progress',
    seed: 'phase75-test',
    ...overrides,
  }
}

describe('Phase 75 / ISSUE-035 — createStateDiff covers recipes, expeditions, hireableAdventurers', () => {
  it('diffRecipes surfaces an onMenu flip', () => {
    const before = withRecipe(createInitialTavernState(), sampleRecipe())
    const after = withRecipe(
      createInitialTavernState(),
      sampleRecipe({ onMenu: true }),
    )
    const diff = createStateDiff(before, after)
    const change = diff.changes.find(
      (c) => c.path === 'recipes.recipe_stew.onMenu',
    )
    expect(change).toBeDefined()
    expect(change?.before).toBe(false)
    expect(change?.after).toBe(true)
    // onMenu is a boolean flip — significantChanges keeps non-numeric
    // changes by default (see filterSignificantChanges).
    expect(diff.significantChanges).toContainEqual(change)
  })

  it('diffRecipes does not flood the diff with per-day counter ticks', () => {
    const before = withRecipe(
      createInitialTavernState(),
      sampleRecipe({ timesServed: 5, daysSinceLastServed: 2 }),
    )
    const after = withRecipe(
      createInitialTavernState(),
      sampleRecipe({ timesServed: 6, daysSinceLastServed: 3 }),
    )
    const diff = createStateDiff(before, after)
    const recipeChanges = diff.changes.filter((c) =>
      c.path.startsWith('recipes.'),
    )
    expect(recipeChanges).toEqual([])
  })

  it('diffExpeditions surfaces commission and resolution as keyset flips', () => {
    const base = createInitialTavernState()
    const before = base
    const after = withActiveExpedition(base, sampleExpedition())
    const diff = createStateDiff(before, after)
    const commission = diff.changes.find(
      (c) => c.path === 'expeditions.active.exp_1',
    )
    expect(commission).toBeDefined()
    expect(commission?.before).toBe(null)
    expect(commission?.after).toBe('in_progress')
    expect(commission?.tags).toContain('commissioned')

    // Resolution is the reverse: present → absent.
    const resolveDiff = createStateDiff(after, before)
    const resolution = resolveDiff.changes.find(
      (c) => c.path === 'expeditions.active.exp_1',
    )
    expect(resolution?.tags).toContain('resolved')
    expect(resolution?.after).toBe(null)
  })

  it('diffExpeditions emits a count-delta on completed records', () => {
    const before = createInitialTavernState()
    const after = {
      ...before,
      expeditions: {
        ...before.expeditions,
        completed: [
          ...before.expeditions.completed,
          {
            id: 'exp_done',
            runnerId: 'adv_zarka',
            mode: 'open' as const,
            targetTier: 'uncommon' as const,
            targetIngredientId: null,
            daysTotal: 3,
            costPaid: 15,
            startedDay: 1,
            resolvedDay: 4,
            outcome: 'success' as const,
            returnedIngredients: [],
          },
        ],
      },
    }
    const diff = createStateDiff(before, after)
    const countChange = diff.changes.find(
      (c) => c.path === 'expeditions.completed.count',
    )
    expect(countChange?.delta).toBe(1)
  })

  it('diffHireableAdventurers surfaces meter and expedition assignment changes', () => {
    const before = withAdventurer(createInitialTavernState(), sampleAdventurer())
    const after = withAdventurer(
      createInitialTavernState(),
      sampleAdventurer({
        experience: 55,
        reliability: 52,
        currentExpeditionId: 'exp_1',
      }),
    )
    const diff = createStateDiff(before, after)
    const xpChange = diff.changes.find(
      (c) => c.path === 'hireableAdventurers.adv_zarka.experience',
    )
    expect(xpChange?.delta).toBe(15)
    const relChange = diff.changes.find(
      (c) => c.path === 'hireableAdventurers.adv_zarka.reliability',
    )
    expect(relChange?.delta).toBe(2)
    const expIdChange = diff.changes.find(
      (c) => c.path === 'hireableAdventurers.adv_zarka.currentExpeditionId',
    )
    expect(expIdChange?.before).toBe(null)
    expect(expIdChange?.after).toBe('exp_1')
  })

  it('hireableAdventurers meter changes are filtered by the meter threshold', () => {
    // +2 reliability is below the default threshold of 5 — should drop
    // out of significantChanges. +15 experience stays.
    const before = withAdventurer(createInitialTavernState(), sampleAdventurer())
    const after = withAdventurer(
      createInitialTavernState(),
      sampleAdventurer({ experience: 55, reliability: 52 }),
    )
    const diff = createStateDiff(before, after)
    const significantPaths = diff.significantChanges.map((c) => c.path)
    expect(significantPaths).toContain(
      'hireableAdventurers.adv_zarka.experience',
    )
    expect(significantPaths).not.toContain(
      'hireableAdventurers.adv_zarka.reliability',
    )
  })
})
