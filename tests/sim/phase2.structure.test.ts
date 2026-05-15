import { describe, it, expect, beforeEach } from 'vitest'

import { Registry } from '../../src/sim/registries/Registry'
import { areaRegistry } from '../../src/sim/registries/areaRegistry'
import { stockRegistry } from '../../src/sim/registries/stockRegistry'
import { customerRegistry } from '../../src/sim/registries/customerRegistry'
import { staffRegistry } from '../../src/sim/registries/staffRegistry'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { reputationRegistry } from '../../src/sim/registries/reputationRegistry'
import { pressureRegistry } from '../../src/sim/registries/pressureRegistry'
import { issueSeedRegistry } from '../../src/sim/registries/issueSeedRegistry'
import { moduleRegistry } from '../../src/sim/registries/moduleRegistry'

import {
  SIMULATION_PHASES,
  type SimulationPhase,
} from '../../src/sim/core/phases'
import type {
  SimulationModule,
  SimulationHook,
  RegistrationContext,
} from '../../src/sim/core/module'
import type { SimulationResult } from '../../src/sim/core/result'
import { createInitialTavernState } from '../../src/sim/state/defaults'

import { calendarModule } from '../../src/sim/modules/calendar'
import { economyModule } from '../../src/sim/modules/economy'
import { areasModule } from '../../src/sim/modules/areas'
import { stockModule } from '../../src/sim/modules/stock'
import { customersModule } from '../../src/sim/modules/customers'
import { staffModule } from '../../src/sim/modules/staff'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions'
import { weeklyModule } from '../../src/sim/modules/weekly'
import { monthlyModule } from '../../src/sim/modules/monthly'
import { memoriesModule } from '../../src/sim/modules/memories'
import { historyModule } from '../../src/sim/modules/history'
import { causesModule } from '../../src/sim/modules/causes'
import { pressuresModule } from '../../src/sim/modules/pressures'
import { feedbackModule } from '../../src/sim/modules/feedback'
import { reportsModule } from '../../src/sim/modules/reports'
import { issueSeedsModule } from '../../src/sim/modules/issueSeeds'

type SampleDefinition = { id: string; label: string; tags: string[] }

describe('Registry', () => {
  let registry: Registry<SampleDefinition>

  beforeEach(() => {
    registry = new Registry<SampleDefinition>()
  })

  it('registers and retrieves definitions', () => {
    const item: SampleDefinition = { id: 'a', label: 'A', tags: [] }
    registry.register(item)
    expect(registry.get('a')).toBe(item)
    expect(registry.has('a')).toBe(true)
  })

  it('rejects duplicate ids', () => {
    registry.register({ id: 'a', label: 'A', tags: [] })
    expect(() => registry.register({ id: 'a', label: 'A2', tags: [] })).toThrow(
      /Duplicate registry id: a/,
    )
  })

  it('lists all registered items', () => {
    registry.register({ id: 'a', label: 'A', tags: [] })
    registry.register({ id: 'b', label: 'B', tags: [] })
    const ids = registry.all().map((item) => item.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('throws when retrieving a missing id', () => {
    expect(() => registry.get('missing')).toThrow(/Missing registry id: missing/)
  })

  it('clear empties the registry', () => {
    registry.register({ id: 'a', label: 'A', tags: [] })
    registry.clear()
    expect(registry.all()).toEqual([])
    expect(registry.has('a')).toBe(false)
  })
})

describe('Placeholder registry instances', () => {
  // Phase 8 populates `areaRegistry`; Phase 9 populates `stockRegistry`;
  // Phase 10 populates `customerRegistry`; Phase 11 populates
  // `staffRegistry`; Phase 13 populates `actionRegistry`; Phase 18
  // populates `pressureRegistry`. Each registers its entries at module
  // load time, so the empty-on-import assertion below now applies only
  // to the registries that have not yet been claimed by a later phase.
  it('exist and start empty for every still-empty expandable concept', () => {
    // Phase 67 / ISSUE-027 — reputationRegistry now seeds the
    // `culinary_renown` axis; the remaining listed registries are
    // populated by later phases or stay empty until a feature wires
    // them up.
    const registries = [issueSeedRegistry, moduleRegistry]
    for (const registry of registries) {
      expect(registry.all()).toEqual([])
    }
  })

  it('pressureRegistry is populated by the Phase 18 pressure system', () => {
    // Phase 38 §38.1 — expanded pressures register alongside the canonical
    // ten, so check containment rather than exact equality.
    const ids = pressureRegistry.all().map((p) => p.id)
    for (const id of [
      'food_safety',
      'inspection',
      'staff_burnout',
      'pests',
      'debt',
      'maintenance',
      'violence',
      'reputation_drift',
      'stock_shortage',
      'landlord',
    ]) {
      expect(ids).toContain(id)
    }
  })

  it('areaRegistry is populated by the Phase 8 area system', () => {
    const ids = areaRegistry.all().map((a) => a.id).sort()
    expect(ids).toEqual(['cellar', 'kitchen', 'main_room', 'privy', 'roof'].sort())
  })

  it('stockRegistry is populated by the Phase 9 stock system', () => {
    // Phase 66 / ISSUE-026 — registry spans common+uncommon+rare+legendary;
    // check the six common starters by id rather than full-set match.
    for (const id of ['ale', 'firewood', 'ingredients', 'mugs', 'mushrooms', 'stew']) {
      expect(stockRegistry.has(id)).toBe(true)
    }
  })

  it('customerRegistry is populated by the Phase 10 customer system', () => {
    const ids = customerRegistry.all().map((c) => c.id).sort()
    expect(ids).toEqual(
      ['adventurers', 'local_goblins', 'merchants', 'miners', 'ogres'].sort(),
    )
  })

  it('staffRegistry is populated by the Phase 11 staff system', () => {
    const ids = staffRegistry.all().map((s) => s.id).sort()
    expect(ids).toEqual(['cleaner_bouncer', 'cook', 'server'].sort())
  })

  it('actionRegistry is populated by the Phase 13 owner-action system', () => {
    // Phase 33 §33.4 / §33.6 / §33.7 widen the registry with project,
    // policy, and social-action definitions. The Phase 13 set must still
    // be present; the assertion now checks containment rather than
    // exact equality so later phases can extend the registry without
    // dragging this test along.
    const ids = new Set(actionRegistry.all().map((a) => a.id))
    for (const id of [
      'clean_area',
      'repair_area',
      'restock_item',
      'adjust_prices',
      'pay_staff_bonus',
      'water_down_ale',
      'improve_stew',
      'patch_roof',
      'fumigate_cellar',
      'buy_mugs',
    ]) {
      expect(ids.has(id)).toBe(true)
    }
  })
})

describe('Simulation phases', () => {
  // Phase 7 §7.1 replaced the Phase 2 placeholder list with the canonical
  // pipeline. Keep this assertion in sync with src/sim/core/phases.ts.
  it('include daily, weekly, monthly, and engine-housekeeping phases', () => {
    const required: SimulationPhase[] = [
      'startDay',
      'applyDayTypeModifiers',
      'forecastTraffic',
      'beforeOwnerActions',
      'applyOwnerActions',
      'afterOwnerActions',
      'assignStaffPriorities',
      'beforeService',
      'service',
      'afterService',
      'closing',
      'endDay',
      'endWeek',
      'endMonth',
      'generateReports',
      'validate',
      'advanceCalendar',
    ]
    for (const phase of required) {
      expect(SIMULATION_PHASES).toContain(phase)
    }
  })

  it('contain no duplicates', () => {
    expect(new Set(SIMULATION_PHASES).size).toBe(SIMULATION_PHASES.length)
  })
})

describe('Core sim modules', () => {
  it('can be imported and expose stable id + version', () => {
    const modules: SimulationModule[] = [
      calendarModule,
      economyModule,
      areasModule,
      stockModule,
      customersModule,
      staffModule,
      ownerActionsModule,
      weeklyModule,
      monthlyModule,
      memoriesModule,
      historyModule,
      causesModule,
      pressuresModule,
      feedbackModule,
      reportsModule,
      issueSeedsModule,
    ]

    const expectedIds = [
      'calendar',
      'economy',
      'areas',
      'stock',
      'customers',
      'staff',
      'ownerActions',
      'weekly',
      'monthly',
      'memories',
      'history',
      'causes',
      'pressures',
      'feedback',
      'reports',
      'issueSeeds',
    ]

    expect(modules.map((m) => m.id)).toEqual(expectedIds)
    for (const mod of modules) {
      // Phase 33 §33.3 / §33.5 bumped ownerActions to 0.2.0 when the
      // module gained persistent project / policy / social slices.
      // Other modules still ship 0.1.0.
      const expected = mod.id === 'ownerActions' ? '0.2.0' : '0.1.0'
      expect(mod.version).toBe(expected)
    }
  })
})

describe('Simulation module type surface', () => {
  it('accepts hook tables keyed by SimulationPhase', () => {
    const hook: SimulationHook = () => {}
    const register = (_ctx: RegistrationContext) => {}
    const mod: SimulationModule = {
      id: 'test',
      version: '0.0.0',
      hooks: { startDay: [hook] },
      register,
    }
    expect(mod.id).toBe('test')
    expect(mod.hooks?.startDay?.[0]).toBe(hook)
  })

  // Phase 7 §7.4 / Phase 17 §17.8 — `SimResult` now also carries the
  // ordered phase-boundary diffs. Keep this assertion in sync with
  // src/sim/core/result.ts.
  it('exposes a SimResult shape with state, reports, logs, validation, and diffs', () => {
    const result: SimulationResult = {
      state: createInitialTavernState(),
      reports: [],
      logs: [],
      validation: { errors: [], warnings: [] },
      diffs: [],
    }
    expect(result.reports).toEqual([])
    expect(result.logs).toEqual([])
    expect(result.validation.errors).toEqual([])
    expect(result.validation.warnings).toEqual([])
    expect(result.diffs).toEqual([])
  })
})
