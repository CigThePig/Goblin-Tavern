import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import { areasModule } from '../../src/sim/modules/areas/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import {
  PROJECT_STARTERS,
  POLICY_STARTERS,
  actionRegistry,
  getOwnerActionsModuleState,
  ownerActionsModule,
  OWNER_ACTIONS_MODULE_ID,
} from '../../src/sim/modules/ownerActions/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import {
  getServiceModuleState,
  serviceModule,
} from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { worldModule } from '../../src/sim/modules/world/index'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withCoin,
  withCustomerGroup,
  withStaff,
} from '../../src/sim/testing/stateFactories'
import type { DayType } from '../../src/sim/modules/calendar/types'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'
import type {
  SimInputOwnerAction,
} from '../../src/sim/core/context'

// Phase 33 — Owner Projects, Policies, and Social Actions.
//
// The plan §33.10 lists ten required tests. The suite below covers:
//   - persistent project state across the daily reset (§33.3),
//   - start / progress / completion of projects (§33.4 / §33.5),
//   - policy enable / disable / conflict resolution (§33.6),
//   - `refuse_tabs` reducing computed unpaid tabs (§33.8),
//   - social-action effects on staff, regulars, suppliers, and groups
//     (§33.7) and the audit ring (§33.3),
//   - graceful rejection of social actions whose target type is missing
//     from the current world,
//   - existing Phase 13 owner-action paths still applying cleanly.

const SEED = 'phase-33-owner-projects-policies-social'

const DAY_OF_WEEK_BY_TYPE: Record<DayType, number> = {
  supplier_day: 1,
  quiet_day: 2,
  market_day: 3,
  local_night: 4,
  payday: 5,
  brawl_night: 6,
  maintenance_day: 7,
}

function withDayType(state: TavernState, dayType: DayType): TavernState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      dayType,
      dayOfWeek: DAY_OF_WEEK_BY_TYPE[dayType],
    },
  }
}

function input(actions?: ReadonlyArray<SimInputOwnerAction>) {
  if (actions) return { seed: SEED, ownerActions: actions }
  return { seed: SEED }
}

// Modules sufficient to exercise project/policy/social hooks. The
// causes/memories/history modules are included so the day's
// `addCause`/`addMemory`/`addHistory` calls land somewhere observable.
const CORE_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  ownerActionsModule,
  serviceModule,
  memoriesModule,
  historyModule,
  causesModule,
]

function runDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
) {
  return simulateDay(state, input(actions), CORE_PIPELINE)
}

function injectRegular(state: TavernState, regular: RegularWorldState): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { ...state.world.regulars, [regular.id]: regular },
    },
  }
}

function makeRegular(overrides: Partial<RegularWorldState>): RegularWorldState {
  return {
    id: 'test_regular',
    name: {
      display: 'Brik Tallowmug',
      profileId: 'goblin_common',
      parts: { given: 'Brik', family: 'Tallowmug' },
      patternId: 'given_family',
      generatedBy: 'phase33_test',
    },
    customerGroupId: 'miners',
    loyalty: 80,
    irritation: 60,
    visits: 8,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 2,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

describe('Phase 33 — Owner action types', () => {
  it('registers project, policy, and social actions alongside Phase 13 actions', () => {
    const all = actionRegistry.all()
    const ids = new Set(all.map((a) => a.id))

    expect(ids.has('clean_area')).toBe(true)
    expect(ids.has('start_private_booths')).toBe(true)
    expect(ids.has('enable_refuse_tabs')).toBe(true)
    expect(ids.has('comfort_stressed_staff')).toBe(true)
  })

  it('every action carries a category', () => {
    for (const def of actionRegistry.all()) {
      expect(['immediate', 'project', 'policy', 'social']).toContain(def.category)
    }
  })

  it('Phase 13 actions retain category "immediate"', () => {
    const def = actionRegistry.get('clean_area')
    expect(def.category).toBe('immediate')
  })
})

describe('Phase 33 — Module slice defaults', () => {
  it('createInitialTavernState seeds empty projects/recentSocialActions and one starter policy', () => {
    const state = createInitialTavernState()
    const slice = getOwnerActionsModuleState(state)
    expect(slice.projects).toEqual({})
    // Audit fixes pass 1 §1.4 — one starter policy is now enabled at
    // day 0 so the policy backlash pressure / seed pipeline has
    // something to bite during cardless gate runs.
    expect(slice.policies['cheap_payday_specials']?.enabled).toBe(true)
    expect(slice.recentSocialActions).toEqual([])
  })
})

describe('Phase 33 — Projects (§33.4 / §33.5)', () => {
  it('start_private_booths creates an active project record', () => {
    const base = withCoin(createInitialTavernState(), 50)
    const result = runDay(base, [{ actionId: 'start_private_booths' }])

    const slice = getOwnerActionsModuleState(result.state)
    const project = Object.values(slice.projects).find(
      (p) => p.projectType === 'private_booths',
    )
    expect(project).toBeDefined()
    expect(project!.status).toBe('active')
    expect(project!.progress).toBeGreaterThanOrEqual(1)
    expect(project!.requiredProgress).toBeGreaterThan(0)
    expect(project!.targetId).toBe('main_room')
  })

  it('preserves active projects across daily reset', () => {
    const base = withCoin(createInitialTavernState(), 50)
    const day1 = runDay(base, [{ actionId: 'start_private_booths' }])

    const day1Slice = getOwnerActionsModuleState(day1.state)
    expect(Object.keys(day1Slice.projects)).toHaveLength(1)
    expect(day1Slice.applied).toHaveLength(1)

    const day2 = runDay(day1.state)
    const day2Slice = getOwnerActionsModuleState(day2.state)

    // Daily fields reset but the project record survives.
    expect(day2Slice.applied).toHaveLength(0)
    expect(Object.keys(day2Slice.projects)).toHaveLength(1)
    const project = Object.values(day2Slice.projects)[0]!
    expect(project.status).toBe('active')
  })

  it('project progress advances deterministically over multiple days', () => {
    const base = withCoin(createInitialTavernState(), 50)
    const day1 = runDay(base, [{ actionId: 'start_hearth_repair' }])
    const projectId = Object.keys(getOwnerActionsModuleState(day1.state).projects)[0]!
    const day2 = runDay(day1.state)
    const day3 = runDay(day2.state)

    const p1 = getOwnerActionsModuleState(day1.state).projects[projectId]!
    const p2 = getOwnerActionsModuleState(day2.state).projects[projectId]!
    const p3 = getOwnerActionsModuleState(day3.state).projects[projectId]!
    expect(p2.progress).toBeGreaterThan(p1.progress)
    expect(p3.progress).toBeGreaterThan(p2.progress)
  })

  it('completing a project applies a structural area trait change', () => {
    const base = withCoin(createInitialTavernState(), 50)
    let state = runDay(base, [{ actionId: 'start_hearth_repair' }]).state
    // Hearth repair requires 4 progress, gains 1/day from the tick. Run
    // enough days for it to complete.
    for (let i = 0; i < 6; i++) {
      state = runDay(state).state
    }
    const slice = getOwnerActionsModuleState(state)
    const project = Object.values(slice.projects).find(
      (p) => p.projectType === 'repair_hearth',
    )!
    expect(project.status).toBe('completed')
    expect(state.areas.main_room!.traits).toContain('cozy')
  })

  it('rejects starting the same project twice', () => {
    const base = withCoin(createInitialTavernState(), 100)
    const day1 = runDay(base, [{ actionId: 'start_private_booths' }])
    const day2 = runDay(day1.state, [{ actionId: 'start_private_booths' }])
    const slice = getOwnerActionsModuleState(day2.state)
    expect(slice.rejected[0]?.code).toBe('project_already_active')
  })

  it('fund_active_project advances progress and spends coin', () => {
    const base = withCoin(createInitialTavernState(), 60)
    const day1 = runDay(base, [{ actionId: 'start_hearth_repair' }])
    const projectId = Object.keys(getOwnerActionsModuleState(day1.state).projects)[0]!
    const progressBeforeFund = getOwnerActionsModuleState(day1.state)
      .projects[projectId]!.progress

    const day2 = runDay(day1.state, [
      { actionId: 'fund_active_project', targetId: projectId },
    ])
    const slice = getOwnerActionsModuleState(day2.state)
    // Funding adds progress on the same day the tick ALSO runs at endDay,
    // so the difference is at least one above the passive baseline.
    expect(slice.projects[projectId]!.progress).toBeGreaterThan(
      progressBeforeFund + 1,
    )
    expect(slice.projects[projectId]!.coinInvested).toBeGreaterThan(0)
  })
})

describe('Phase 33 — Policies (§33.6)', () => {
  it('enabling a policy creates a persistent policy record', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [{ actionId: 'enable_refuse_tabs' }])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.policies['refuse_tabs']).toBeDefined()
    expect(slice.policies['refuse_tabs']!.enabled).toBe(true)
  })

  it('disable_<policy> turns an active policy off', () => {
    const base = createInitialTavernState()
    const day1 = runDay(base, [{ actionId: 'enable_refuse_tabs' }])
    const day2 = runDay(day1.state, [{ actionId: 'disable_refuse_tabs' }])
    const slice = getOwnerActionsModuleState(day2.state)
    expect(slice.policies['refuse_tabs']!.enabled).toBe(false)
  })

  it('enabling a conflicting policy disables the other', () => {
    const base = createInitialTavernState()
    const day1 = runDay(base, [{ actionId: 'enable_allow_tabs_for_regulars' }])
    const day2 = runDay(day1.state, [{ actionId: 'enable_refuse_tabs' }])
    const slice = getOwnerActionsModuleState(day2.state)
    expect(slice.policies['refuse_tabs']!.enabled).toBe(true)
    expect(slice.policies['allow_tabs_for_regulars']!.enabled).toBe(false)
  })

  it('rejects enabling an already-enabled policy', () => {
    const base = createInitialTavernState()
    const day1 = runDay(base, [{ actionId: 'enable_refuse_tabs' }])
    const day2 = runDay(day1.state, [{ actionId: 'enable_refuse_tabs' }])
    const slice = getOwnerActionsModuleState(day2.state)
    expect(slice.rejected[0]?.code).toBe('policy_already_enabled')
  })

  it('refuse_tabs reduces unpaid tabs compared with no policy', () => {
    // Push a rowdy, high-tab-risk group onto a payday so tabs land.
    const seed = withCoin(
      withCustomerGroup(
        withDayType(createInitialTavernState(), 'payday'),
        'miners',
        {
          rowdiness: 90,
          tabRisk: 80,
          patronage: 95,
          satisfaction: 70,
        },
      ),
      120,
    )

    const baseline = runDay(seed)
    const baselineTabs = getServiceModuleState(baseline.state).result.unpaidTabs

    const withPolicy = runDay(seed, [{ actionId: 'enable_refuse_tabs' }])
    const withPolicyTabs = getServiceModuleState(withPolicy.state).result
      .unpaidTabs

    expect(withPolicyTabs).toBeLessThan(baselineTabs)
  })
})

describe('Phase 33 — Social actions (§33.7)', () => {
  it('comfort_stressed_staff lowers stress, lifts morale, records history/memory', () => {
    const base = withStaff(createInitialTavernState(), 'cook', {
      stress: 70,
      morale: 30,
    })
    const result = runDay(base, [
      { actionId: 'comfort_stressed_staff', targetId: 'cook' },
    ])
    expect(result.state.staff.cook!.stress).toBeLessThan(70)
    expect(result.state.staff.cook!.morale).toBeGreaterThan(30)

    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.recentSocialActions[0]?.actionId).toBe('comfort_stressed_staff')
    expect(slice.recentSocialActions[0]?.targetId).toBe('cook')

    expect(result.state.history.some((h) => h.tags.includes('comfort_stressed_staff'))).toBe(true)
    expect(result.state.memories.some((m) => m.id.startsWith('staff_comforted_recently'))).toBe(true)
  })

  it('apologize_to_regular reduces regular irritation and lifts loyalty', () => {
    const seed = injectRegular(
      createInitialTavernState(),
      makeRegular({ irritation: 60, loyalty: 50 }),
    )
    const result = runDay(seed, [
      { actionId: 'apologize_to_regular', targetId: 'test_regular' },
    ])
    const updated = result.state.world.regulars['test_regular']!
    expect(updated.irritation).toBeLessThan(60)
    expect(updated.loyalty).toBeGreaterThan(50)

    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.recentSocialActions[0]?.targetId).toBe('test_regular')
  })

  it('negotiate_with_supplier improves the supplier relationship', () => {
    const base = createInitialTavernState()
    const supplierId = Object.keys(base.world.suppliers)[0]!
    const beforeRelationship = base.world.suppliers[supplierId]!.relationship

    const result = runDay(base, [
      { actionId: 'negotiate_with_supplier', targetId: supplierId },
    ])
    expect(
      result.state.world.suppliers[supplierId]!.relationship,
    ).toBeGreaterThan(beforeRelationship)
  })

  it('host_faction_night lifts the faction relationship', () => {
    const base = createInitialTavernState()
    const factionId = 'miners_union'
    const beforeRelationship = base.world.factions[factionId]!.relationship

    const result = runDay(base, [
      { actionId: 'host_faction_night', targetId: factionId },
    ])
    expect(
      result.state.world.factions[factionId]!.relationship,
    ).toBeGreaterThan(beforeRelationship)
  })

  it('rejects social actions whose target does not exist', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'apologize_to_regular', targetId: 'no_such_regular' },
      { actionId: 'comfort_stressed_staff', targetId: 'no_such_staff' },
      { actionId: 'negotiate_with_supplier', targetId: 'no_such_supplier' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.applied).toHaveLength(0)
    expect(slice.rejected).toHaveLength(3)
    for (const r of slice.rejected) {
      expect(r.code).toBe('unknown_target')
    }
  })

  it('bounded social-action ring keeps newest entries first', () => {
    const base = createInitialTavernState()
    const day1 = runDay(base, [
      { actionId: 'comfort_stressed_staff', targetId: 'cook' },
    ])
    const day2 = runDay(day1.state, [
      { actionId: 'comfort_stressed_staff', targetId: 'server' },
    ])
    const slice = getOwnerActionsModuleState(day2.state)
    expect(slice.recentSocialActions[0]?.targetId).toBe('server')
    expect(slice.recentSocialActions[1]?.targetId).toBe('cook')
  })
})

describe('Phase 33 — Owner action report (§33.9)', () => {
  it('report exposes active projects, enabled policies, and recent social actions', () => {
    const base = withCoin(createInitialTavernState(), 100)
    const day1 = runDay(base, [
      { actionId: 'start_private_booths' },
      { actionId: 'enable_refuse_tabs' },
      { actionId: 'comfort_stressed_staff', targetId: 'cook' },
    ])

    const report = day1.reports.find((r) => r.id === 'ownerActions')!
    const text = report.lines.join('\n')
    expect(text).toMatch(/Active Projects/)
    expect(text).toMatch(/Private Booths/)
    expect(text).toMatch(/Enabled Policies/)
    expect(text).toMatch(/Refuse Tabs/)
    expect(text).toMatch(/Recent Social Actions/)
    expect(text).toMatch(/comfort_stressed_staff/)

    const data = report.data as {
      projects: Record<string, unknown>
      policies: Record<string, unknown>
      recentSocialActions: ReadonlyArray<unknown>
    }
    expect(Object.keys(data.projects).length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(data.policies).length).toBeGreaterThanOrEqual(1)
    expect(data.recentSocialActions.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase 33 — Existing Phase 13 actions still apply', () => {
  it('clean_area continues to work alongside Phase 33 actions', () => {
    const base = createInitialTavernState()
    const result = runDay(base, [
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'enable_refuse_tabs' },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.applied).toHaveLength(2)
    expect(slice.applied.map((a) => a.actionId)).toContain('clean_area')
    expect(slice.applied.map((a) => a.actionId)).toContain('enable_refuse_tabs')
    expect(result.validation.errors).toEqual([])
  })

  it('state validates with active projects, enabled policies, and a social-action ring', () => {
    const base = withCoin(createInitialTavernState(), 100)
    let state = runDay(base, [
      { actionId: 'start_hearth_repair' },
      { actionId: 'enable_refuse_tabs' },
      { actionId: 'comfort_stressed_staff', targetId: 'cook' },
    ]).state
    state = runDay(state).state
    const result = runDay(state)
    expect(result.validation.errors).toEqual([])
  })
})

describe('Phase 33 — Coverage sanity (registries)', () => {
  it('every project starter is registered', () => {
    for (const starter of PROJECT_STARTERS) {
      expect(actionRegistry.has(starter.id)).toBe(true)
    }
  })

  it('every policy starter has a registered enable + disable definition', () => {
    for (const starter of POLICY_STARTERS) {
      expect(actionRegistry.has(`enable_${starter.policyType}`)).toBe(true)
      expect(actionRegistry.has(`disable_${starter.policyType}`)).toBe(true)
    }
  })

  it('module schema validates the new persistent fields', () => {
    expect(ownerActionsModule.stateSchema).toBeDefined()
    const schema = ownerActionsModule.stateSchema!
    const base = createInitialTavernState()
    const slice = getOwnerActionsModuleState(base)
    // Round-trip through the schema: a freshly-seeded slice must parse
    // cleanly. Phase 26 cross-ref validation also checks the live
    // engine result; here we only need the per-module shape.
    expect(() => schema.parse(slice)).not.toThrow()
  })

  it(OWNER_ACTIONS_MODULE_ID + ' module declares the endDay hook', () => {
    expect(ownerActionsModule.hooks?.endDay).toBeDefined()
  })
})
