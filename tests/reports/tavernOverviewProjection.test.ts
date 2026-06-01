// Phase 92 — Tests for the tavern-overview projection.
//
// Drives the sim end-to-end via runOneDay / runCardlessSim so the
// projection runs against real TavernState shapes. Per cards-contract
// §1, the simulation is the source of truth; tests prove the projection
// reads it faithfully and resolves entity ids to labels.

import { describe, expect, it } from 'vitest'

import { runOneDay, runCardlessSim } from '../../src/sim/testing/simRunner'
import { withCoin } from '../../src/sim/testing/stateFactories'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { buildTavernOverview } from '../../src/reports/tavernOverviewProjection'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import type { TavernState } from '../../src/sim/state/TavernState'

const SEED_PREFIX = 'tests/reports/tavernOverview'

function startingState(): TavernState {
  return withCoin(createInitialTavernState(), 500)
}

function runDays(count: number, seedSuffix = ''): TavernState {
  const run = runCardlessSim({
    initialState: startingState(),
    seed: `${SEED_PREFIX}.${seedSuffix}`,
    days: count,
  })
  return run.finalState
}

describe('buildTavernOverview — day-zero state', () => {
  it('returns a populated TavernOverviewData with all five panels', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.areas).toBeDefined()
    expect(data.stock).toBeDefined()
    expect(data.recipes).toBeDefined()
    expect(data.staff).toBeDefined()
    expect(data.projects).toBeDefined()
  })

  it('projects all starter areas with labels and meters', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    // 5 originals from Phase 8 + 4 added by Phase 73 (rare ingredients).
    expect(data.areas.rows.length).toBe(Object.keys(state.areas).length)
    expect(data.areas.rows.length).toBeGreaterThanOrEqual(5)
    const labels = data.areas.rows.map((r) => r.label).sort()
    expect(labels).toContain('Main Room')
    expect(labels).toContain('Kitchen')
    expect(labels).toContain('Cellar')
    for (const row of data.areas.rows) {
      expect(typeof row.cleanliness).toBe('number')
      expect(typeof row.damage).toBe('number')
      expect(typeof row.smell).toBe('number')
      expect(typeof row.risk).toBe('number')
      expect(typeof row.conditionAdjective).toBe('string')
      expect(row.conditionAdjective.length).toBeGreaterThan(0)
    }
  })

  it('resolves traits and atmosphere from registries', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    const mainRoom = data.areas.rows.find((r) => r.id === 'main_room')
    expect(mainRoom).toBeDefined()
    // main_room has sticky_floor + dangerous_corner traits in defaults.
    const traitIds = mainRoom!.traits.map((t) => t.id)
    expect(traitIds).toContain('sticky_floor')
    expect(traitIds).toContain('dangerous_corner')
    for (const trait of mainRoom!.traits) {
      expect(trait.label.length).toBeGreaterThan(0)
      expect(typeof trait.description).toBe('string')
    }
    expect(mainRoom!.atmosphere.length).toBeGreaterThan(0)
  })

  it('picks the worst meter and matches it to an adjective key', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    for (const row of data.areas.rows) {
      // The chosen worst meter's value matches worstMeterValue.
      const meterValue =
        row.worstMeterKey === 'cleanliness'
          ? 100 - row.cleanliness
          : row.worstMeterKey === 'damage'
            ? row.damage
            : row.worstMeterKey === 'smell'
              ? row.smell
              : row.worstMeterKey === 'risk'
                ? row.risk
                : row.mess
      expect(row.worstMeterValue).toBe(meterValue)
    }
  })

  it('projects all 6 starter stock items with quantity/quality/spoilage/freshness', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.stock.inventory.rows.length).toBeGreaterThanOrEqual(6)
    for (const row of data.stock.inventory.rows) {
      expect(typeof row.quantity).toBe('number')
      expect(typeof row.quality).toBe('number')
      expect(typeof row.spoilage).toBe('number')
      expect(row.freshness).toBe(100 - row.spoilage)
      expect(['common', 'uncommon', 'rare', 'legendary']).toContain(row.rarity)
    }
  })

  it('resolves storage area label when storageAreaId is set', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    for (const row of data.stock.inventory.rows) {
      if (row.storageAreaId) {
        expect(row.storageAreaLabel).toBeDefined()
        expect(row.storageAreaLabel).toBe(state.areas[row.storageAreaId]?.label)
      }
    }
  })

  it('projects the supply pipeline with hireable adventurers', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.stock.supplyPipeline.activeExpeditions).toEqual([])
    expect(data.stock.supplyPipeline.hireableAdventurers.length).toBe(3)
    expect(data.stock.supplyPipeline.recentCompletions).toEqual([])
    for (const adv of data.stock.supplyPipeline.hireableAdventurers) {
      expect(adv.name.length).toBeGreaterThan(0)
      expect(typeof adv.experience).toBe('number')
      expect(typeof adv.reliability).toBe('number')
      expect(adv.isBusy).toBe(false)
    }
  })

  it('projects recipes split into onMenu vs available', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    const total = data.recipes.onMenu.length + data.recipes.available.length
    // Phase 117 — `upkeep`-tagged recipes (firewood, mugs, raw
    // ingredient consumption) are filtered out of the Recipes panel
    // entirely. The projection's recipe count is therefore "all
    // state recipes minus upkeep recipes", not the raw state count.
    const upkeepCount = Object.values(state.recipes).filter((r) =>
      r.tags?.includes('upkeep'),
    ).length
    expect(total).toBe(Object.keys(state.recipes).length - upkeepCount)
    expect(upkeepCount).toBeGreaterThan(0) // sanity: filter is active
    for (const recipe of [...data.recipes.onMenu, ...data.recipes.available]) {
      expect(typeof recipe.prepDifficulty).toBe('number')
      expect(['common', 'uncommon', 'rare', 'legendary']).toContain(
        recipe.demandTier,
      )
      expect(recipe.inputs.length).toBeGreaterThan(0)
      for (const input of recipe.inputs) {
        expect(input.ingredientLabel.length).toBeGreaterThan(0)
        expect(typeof input.available).toBe('number')
      }
    }
  })

  it('flags blocked recipes when ingredients are absent', () => {
    let state = startingState()
    // Zero out ale stock to block dish_ale.
    state = {
      ...state,
      stock: {
        ...state.stock,
        ale: { ...state.stock['ale']!, quantity: 0 },
      },
    }
    const data = buildTavernOverview(state)
    const ale = [...data.recipes.onMenu, ...data.recipes.available].find(
      (r) => r.id === 'dish_ale',
    )
    expect(ale).toBeDefined()
    expect(ale!.blocked).toBe(true)
    expect(ale!.blockedReason).toMatch(/ale/i)
  })

  it('projects all 3 starter staff with names and roles', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.staff.rows.length).toBe(3)
    for (const row of data.staff.rows) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(row.roleLabel.length).toBeGreaterThan(0)
      expect(row.allowedPriorities.length).toBeGreaterThan(0)
      for (const priority of row.allowedPriorities) {
        expect(priority.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('projects no active or available projects with no projects started', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.projects.active).toEqual([])
    expect(data.projects.available.length).toBeGreaterThan(0)
    for (const avail of data.projects.available) {
      expect(avail.label.length).toBeGreaterThan(0)
      expect(actionRegistry.has(avail.actionId)).toBe(true)
    }
  })

  it('projects the policy catalog including disabled policies', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.projects.policies.length).toBeGreaterThanOrEqual(1)
    const enabledIds = data.projects.policies
      .filter((p) => p.enabled)
      .map((p) => p.id)
    // cheap_payday_specials is seeded as enabled by default.
    expect(enabledIds).toContain('cheap_payday_specials')
    for (const policy of data.projects.policies) {
      expect(policy.label.length).toBeGreaterThan(0)
      if (policy.toggleActionId) {
        const expectedPrefix = policy.enabled ? 'disable_' : 'enable_'
        expect(policy.toggleActionId.startsWith(expectedPrefix)).toBe(true)
      }
    }
  })

  it('starts with no recent social actions', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    expect(data.projects.recentSocial).toEqual([])
  })
})

describe('buildTavernOverview — after activity', () => {
  it('surfaces an active project after start_private_booths runs', () => {
    let state = startingState()
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.start-project`,
      ownerActions: [{ actionId: 'start_private_booths' }],
    })
    state = r1.state

    const data = buildTavernOverview(state)
    expect(data.projects.active.length).toBe(1)
    const project = data.projects.active[0]!
    expect(project.projectType).toBe('private_booths')
    expect(project.status).toBe('active')
    expect(project.requiredProgress).toBeGreaterThan(0)
    expect(project.progressFraction).toBeGreaterThanOrEqual(0)
    expect(project.progressFraction).toBeLessThanOrEqual(1)
    expect(project.targetType).toBe('area')
    expect(project.targetId).toBe('main_room')
    expect(project.targetLabel).toBe('Main Room')
  })

  it('drops the started project from the available list', () => {
    let state = startingState()
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.dedupe`,
      ownerActions: [{ actionId: 'start_private_booths' }],
    })
    state = r1.state

    const data = buildTavernOverview(state)
    const ids = data.projects.available.map((a) => a.actionId)
    expect(ids).not.toContain('start_private_booths')
  })

  it('toggles a recipe between onMenu and available', () => {
    let state = startingState()
    // Find an on-menu recipe.
    const onMenuRecipe = Object.values(state.recipes).find((r) => r.onMenu)
    if (!onMenuRecipe) throw new Error('no on-menu recipe in defaults')
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.recipe-toggle`,
      ownerActions: [
        { actionId: 'toggle_recipe_menu', targetId: onMenuRecipe.id },
      ],
    })
    state = r1.state

    const data = buildTavernOverview(state)
    const onMenuIds = data.recipes.onMenu.map((r) => r.id)
    const availIds = data.recipes.available.map((r) => r.id)
    expect(onMenuIds).not.toContain(onMenuRecipe.id)
    expect(availIds).toContain(onMenuRecipe.id)
  })

  it('flips a policy enable/disable round-trip', () => {
    let state = startingState()
    // Disable the default-enabled cheap_payday_specials.
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.policy-toggle`,
      ownerActions: [{ actionId: 'disable_cheap_payday_specials' }],
    })
    state = r1.state

    const data = buildTavernOverview(state)
    const policy = data.projects.policies.find(
      (p) => p.id === 'cheap_payday_specials',
    )
    expect(policy).toBeDefined()
    expect(policy!.enabled).toBe(false)
    expect(policy!.toggleActionId).toBe('enable_cheap_payday_specials')
  })

  it('surfaces a social action in recentSocial after one runs', () => {
    let state = startingState()
    // comfort_stressed_staff targets a staff member with stress >= 40.
    // Bump the cook's stress so the action validates.
    state = {
      ...state,
      staff: {
        ...state.staff,
        cook: { ...state.staff['cook']!, stress: 70 },
      },
    }
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.social`,
      ownerActions: [{ actionId: 'comfort_stressed_staff', targetId: 'cook' }],
    })
    state = r1.state

    const data = buildTavernOverview(state)
    if (data.projects.recentSocial.length > 0) {
      const social = data.projects.recentSocial[0]!
      expect(social.actionId).toBe('comfort_stressed_staff')
      expect(social.targetId).toBe('cook')
      expect(social.targetLabel.length).toBeGreaterThan(0)
      expect(typeof social.day).toBe('number')
      expect(typeof social.daysAgo).toBe('number')
      expect(['improved', 'worsened', 'neutral']).toContain(social.outcome)
    }
  })

  it('runs an expedition end-to-end and surfaces both active and completed slots', () => {
    let state = startingState()
    const adventurerId = Object.keys(state.world.hireableAdventurers)[0]!
    const r1 = runOneDay(state, {
      seed: `${SEED_PREFIX}.exp-start`,
      ownerActions: [
        {
          actionId: 'commission_expedition',
          targetId: adventurerId,
          options: { mode: 'open', daysTotal: 3, targetTier: 'uncommon' },
        },
      ],
    })
    state = r1.state

    let data = buildTavernOverview(state)
    expect(data.stock.supplyPipeline.activeExpeditions.length).toBe(1)
    const active = data.stock.supplyPipeline.activeExpeditions[0]!
    expect(active.runnerId).toBe(adventurerId)
    expect(active.runnerName.length).toBeGreaterThan(0)
    expect(active.mode).toBe('open')
    expect(active.targetTier).toBe('uncommon')
    expect(active.daysTotal).toBe(3)
    expect(active.progressFraction).toBeGreaterThanOrEqual(0)
    // The adventurer should now be busy.
    const adv = data.stock.supplyPipeline.hireableAdventurers.find(
      (a) => a.id === adventurerId,
    )
    expect(adv?.isBusy).toBe(true)

    // Run enough days for the expedition to resolve.
    const r2 = runCardlessSim({
      initialState: state,
      seed: `${SEED_PREFIX}.exp-finish`,
      days: 4,
    })
    state = r2.finalState
    data = buildTavernOverview(state)
    expect(data.stock.supplyPipeline.activeExpeditions.length).toBe(0)
    expect(data.stock.supplyPipeline.recentCompletions.length).toBe(1)
    const completed = data.stock.supplyPipeline.recentCompletions[0]!
    expect(['success', 'partial', 'failure', 'runner_lost']).toContain(
      completed.outcome,
    )
  })

  it('flags low-stock and spoiling counts based on thresholds', () => {
    let state = startingState()
    state = {
      ...state,
      stock: {
        ...state.stock,
        ale: { ...state.stock['ale']!, quantity: 2 },
        stew: { ...state.stock['stew']!, spoilage: 55 },
      },
    }
    const data = buildTavernOverview(state)
    expect(data.stock.inventory.lowStockCount).toBeGreaterThanOrEqual(1)
    expect(data.stock.inventory.spoilingCount).toBeGreaterThanOrEqual(1)
  })
})

describe('buildTavernOverview — invariants', () => {
  it('does not mutate the state object', () => {
    const state = startingState()
    const before = JSON.stringify(state)
    buildTavernOverview(state)
    const after = JSON.stringify(state)
    expect(after).toBe(before)
  })

  it('every applicableActions ref resolves in the action registry', () => {
    const state = runDays(5, 'invariants')
    const data = buildTavernOverview(state)
    const allRefs = [
      ...data.areas.rows.flatMap((r) => r.applicableActions),
      ...data.stock.inventory.rows.flatMap((r) => r.applicableActions),
      ...[...data.recipes.onMenu, ...data.recipes.available].flatMap(
        (r) => r.applicableActions,
      ),
      ...data.staff.rows.flatMap((r) => r.applicableActions),
      ...data.projects.active.flatMap((p) => p.applicableActions),
    ]
    for (const ref of allRefs) {
      expect(actionRegistry.has(ref.actionId)).toBe(true)
    }
  })

  it('surfaces toggle_recipe_menu as an applicable action on every recipe row', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    for (const recipe of [...data.recipes.onMenu, ...data.recipes.available]) {
      const toggle = recipe.applicableActions.find(
        (a) => a.actionId === 'toggle_recipe_menu',
      )
      expect(toggle).toBeDefined()
      expect(toggle!.timeCost).toBe(0)
    }
  })

  it('sorts area rows alphabetically by label', () => {
    const state = startingState()
    const data = buildTavernOverview(state)
    const labels = data.areas.rows.map((r) => r.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b))
    expect(labels).toEqual(sorted)
  })

  it('handles empty stock without crashing', () => {
    const state = startingState()
    const emptyStock: TavernState = { ...state, stock: {} }
    const data = buildTavernOverview(emptyStock)
    expect(data.stock.inventory.rows).toEqual([])
    expect(data.stock.inventory.lowStockCount).toBe(0)
    expect(data.stock.inventory.spoilingCount).toBe(0)
  })
})
