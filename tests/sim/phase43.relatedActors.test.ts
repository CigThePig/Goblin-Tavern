import { describe, expect, it } from 'vitest'

import type { SimContext } from '../../src/sim/core/context'
import { calculateArcEscalation } from '../../src/sim/modules/pressures/calculators/arcEscalation'
import { calculatePolicyBacklash } from '../../src/sim/modules/pressures/calculators/policyBacklash'
import { calculateMarketInstability } from '../../src/sim/modules/pressures/calculators/marketInstability'
import { calculateFestivalReadiness } from '../../src/sim/modules/pressures/calculators/festivalReadiness'
import { applyArcEffect } from '../../src/sim/modules/localArcs/arcEffects'
import { localArcRegistry } from '../../src/sim/content/events/localArcRegistry'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { AttributionState } from '../../src/sim/modules/attribution/attributionTypes'
import type {
  RegularWorldState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 43 §43 — ISSUE-003. The four expanded-pressure calculators and
// the arcEffects helper must populate per-cause `relatedActors` so that
// attribution rules and named-entity-repetition reports see arc /
// policy / market / festival entities downstream.
//
// These tests invoke each calculator (and `applyArcEffect`) with a
// minimal `SimContext` stub: the calculators read only `ctx.state`,
// and `applyArcEffect` is exercised with a tiny mutation-capturing
// stub so we can assert on the cause draft it produces.

function stubContext(state: TavernState): SimContext {
  return { state } as unknown as SimContext
}

function withMerchantsPatron(state: TavernState): TavernState {
  const merchants = state.customerGroups['merchants']!
  return {
    ...state,
    customerGroups: {
      ...state.customerGroups,
      merchants: { ...merchants, patronage: 50 },
    },
  }
}

function makeRegular(overrides: Partial<RegularWorldState>): RegularWorldState {
  return {
    id: 'phase43_regular',
    name: {
      display: 'Test Regular',
      profileId: 'goblin_common',
      parts: { given: 'Test', family: 'Regular' },
      patternId: 'given_family',
      generatedBy: 'phase43_test',
    },
    customerGroupId: 'miners',
    loyalty: 50,
    irritation: 10,
    visits: 3,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 1,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

function seedTavernBlame(state: TavernState): TavernState {
  const stamp = {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
  const attribution: AttributionState = {
    id: 'phase43-blame-tavern',
    timestamp: stamp,
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy: { kind: 'customer_group', id: 'miners' },
    target: { kind: 'tavern_identity', id: state.meta.tavernId },
    attributionType: 'blame',
    accuracy: 'true',
    strength: 90,
    confidence: 80,
    publicness: 80,
    volatility: 20,
    readable: 'Owner blamed publicly.',
    tags: ['policy', 'blame'],
    relatedSystems: ['attribution'],
    ageDays: 0,
  }
  const existing = (state.modules['attribution'] as
    | {
        attributions: AttributionState[]
        generatedToday: string[]
        lastUpdatedDay: number
      }
    | undefined) ?? {
    attributions: [],
    generatedToday: [],
    lastUpdatedDay: -1,
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      attribution: {
        ...existing,
        attributions: [...existing.attributions, attribution],
      },
    },
  }
}

// ----------------------------------------------------------------------

describe('Phase 43 — arcEscalation per-cause relatedActors', () => {
  it('rising / active / climax arc causes each carry the contributing local_event refs', () => {
    const base = createInitialTavernState()
    const today = base.calendar.totalDaysElapsed
    const seeded: TavernState = {
      ...base,
      world: {
        ...base.world,
        localEvents: {
          ...base.world.localEvents,
          arc_rising_a: {
            id: 'arc_rising_a',
            definitionId: 'mushroom_blight',
            label: 'Rising Arc A',
            startedDay: today,
            intensity: 30,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['arc'],
            activeFlags: [],
            type: 'mushroom_blight',
            stage: 'rising',
          },
          arc_active_b: {
            id: 'arc_active_b',
            definitionId: 'mushroom_blight',
            label: 'Active Arc B',
            startedDay: today,
            intensity: 40,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['arc'],
            activeFlags: [],
            type: 'mushroom_blight',
            stage: 'active',
          },
          arc_climax_c: {
            id: 'arc_climax_c',
            definitionId: 'mushroom_blight',
            label: 'Climax Arc C',
            startedDay: today,
            intensity: 50,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['arc'],
            activeFlags: [],
            type: 'mushroom_blight',
            stage: 'climax',
          },
        },
      },
    }
    const result = calculateArcEscalation(stubContext(seeded))
    const rising = result.causes.find((c) => c.id === 'rising_arcs')
    const active = result.causes.find((c) => c.id === 'active_arcs')
    const climax = result.causes.find((c) => c.id === 'climax_arcs')
    expect(rising?.relatedActors).toEqual([
      { kind: 'local_event', id: 'arc_rising_a' },
    ])
    expect(active?.relatedActors).toEqual([
      { kind: 'local_event', id: 'arc_active_b' },
    ])
    expect(climax?.relatedActors).toEqual([
      { kind: 'local_event', id: 'arc_climax_c' },
    ])
  })
})

describe('Phase 43 — policyBacklash per-cause relatedActors', () => {
  it('attaches customer_group, regular, and tavern_identity refs to their causes', () => {
    const base = withMerchantsPatron(createInitialTavernState())
    // Replace the 6 starter regulars (irritation=0) with a single test
    // regular at irritation=70 so the avgIrritation gate clears.
    const seededWithRegular: TavernState = {
      ...base,
      world: {
        ...base.world,
        regulars: {
          phase43_irritated: makeRegular({
            id: 'phase43_irritated',
            irritation: 70,
          }),
        },
      },
    }
    const seeded = seedTavernBlame(seededWithRegular)
    const result = calculatePolicyBacklash(stubContext(seeded))
    // Phase 201 / audit Wave 2 — the aggregate `disliking_groups` cause
    // became one line PER POLICY (`disliking_groups_<policyId>`), tagged
    // with that policy's id, so the policy_backlash card can name the
    // policy on real evidence instead of on a generic `policy` tag. The
    // per-cause actor attribution this test guards is unchanged.
    const disliking = result.causes.find((c) =>
      c.id.startsWith('disliking_groups'),
    )
    const irritation = result.causes.find((c) => c.id === 'regular_irritation')
    const blame = result.causes.find((c) => c.id === 'tavern_blame')
    expect(disliking?.relatedActors).toEqual([
      { kind: 'customer_group', id: 'merchants' },
    ])
    expect(disliking?.tags).toContain('cheap_payday_specials')
    expect(irritation?.relatedActors).toContainEqual({
      kind: 'regular',
      id: 'phase43_irritated',
    })
    expect(blame?.relatedActors).toEqual([
      { kind: 'tavern_identity', id: seeded.meta.tavernId },
    ])
  })
})

describe('Phase 43 — marketInstability per-cause relatedActors', () => {
  it('attaches supplier refs to price/reliability causes and local_event refs to seasonal_arc_market', () => {
    const base = createInitialTavernState()
    const today = base.calendar.totalDaysElapsed
    const supplierIds = Object.keys(base.world.suppliers)
    const firstSupplier = supplierIds[0]!
    const secondSupplier = supplierIds[1] ?? firstSupplier
    // Push at least one supplier below the LOW_RELIABILITY threshold so
    // both the average and the per-supplier collection produce refs.
    const loweredSuppliers = { ...base.world.suppliers }
    for (const id of supplierIds) {
      const s = loweredSuppliers[id]!
      loweredSuppliers[id] = { ...s, reliability: 30 }
    }
    const seeded: TavernState = {
      ...base,
      world: {
        ...base.world,
        suppliers: loweredSuppliers,
        localEvents: {
          ...base.world.localEvents,
          seasonal_crisis_arc: {
            id: 'seasonal_crisis_arc',
            definitionId: 'mushroom_blight',
            label: 'Seasonal Crisis',
            startedDay: today,
            intensity: 40,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['seasonal'],
            activeFlags: [],
            type: 'seasonal_crisis',
            stage: 'active',
          },
        },
      },
      modules: {
        ...base.modules,
        suppliers: {
          ...(base.modules['suppliers'] as Record<string, unknown>),
          activeMarketConditions: [],
          deliveriesToday: [],
          priceAdjustmentsToday: [
            {
              supplierId: firstSupplier,
              stockId: 'ale',
              basePrice: 10,
              effectivePrice: 14,
              conditionIds: [],
              tags: ['phase43_test'],
            },
            {
              supplierId: secondSupplier,
              stockId: 'stew',
              basePrice: 10,
              effectivePrice: 9, // not elevated, should not contribute
              conditionIds: [],
              tags: ['phase43_test'],
            },
          ],
          missedDeliveriesToday: [],
        },
      },
    }
    const result = calculateMarketInstability(stubContext(seeded))
    const priceCause = result.causes.find((c) => c.id === 'price_adjustments_high')
    const reliabilityCause = result.causes.find((c) => c.id === 'avg_reliability_low')
    const seasonalCause = result.causes.find((c) => c.id === 'seasonal_arc_market')
    expect(priceCause?.relatedActors).toEqual([
      { kind: 'supplier', id: firstSupplier },
    ])
    expect(reliabilityCause?.relatedActors).toContainEqual({
      kind: 'supplier',
      id: firstSupplier,
    })
    expect(seasonalCause?.relatedActors).toEqual([
      { kind: 'local_event', id: 'seasonal_crisis_arc' },
    ])
    // Calculator-level aggregate includes all collected refs.
    expect(result.relatedActors).toContainEqual({
      kind: 'supplier',
      id: firstSupplier,
    })
    expect(result.relatedActors).toContainEqual({
      kind: 'local_event',
      id: 'seasonal_crisis_arc',
    })
  })
})

describe('Phase 43 — festivalReadiness per-cause relatedActors', () => {
  it('attaches local_event, stock, staff, and supplier refs to their respective causes', () => {
    const base = createInitialTavernState()
    const today = base.calendar.totalDaysElapsed
    const staffIds = Object.keys(base.staff)
    const fatigueStaffId = staffIds[0]!
    const supplierIds = Object.keys(base.world.suppliers)
    const strongSupplierId = supplierIds[0]!
    const seeded: TavernState = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock['ale']!, quantity: 20 },
        stew: { ...base.stock['stew']!, quantity: 10 },
      },
      staff: {
        ...base.staff,
        [fatigueStaffId]: { ...base.staff[fatigueStaffId]!, fatigue: 80 },
      },
      world: {
        ...base.world,
        suppliers: {
          ...base.world.suppliers,
          [strongSupplierId]: {
            ...base.world.suppliers[strongSupplierId]!,
            relationship: 85,
            reliability: 85,
          },
        },
        localEvents: {
          ...base.world.localEvents,
          festival_arc_a: {
            id: 'festival_arc_a',
            definitionId: 'mushroom_blight',
            label: 'Festival Arc',
            startedDay: today,
            intensity: 50,
            relatedFactionIds: [],
            relatedCultureIds: [],
            tags: ['festival'],
            activeFlags: [],
            type: 'festival',
            stage: 'rising',
          },
        },
      },
    }
    const result = calculateFestivalReadiness(stubContext(seeded))
    const arcCause = result.causes.find((c) => c.id === 'festival_arc_active')
    const aleCause = result.causes.find((c) => c.id === 'low_ale_for_festival')
    const stewCause = result.causes.find((c) => c.id === 'low_stew_for_festival')
    const staffCause = result.causes.find((c) => c.id === 'fatigued_staff')
    const supplierCause = result.causes.find((c) => c.id === 'strong_suppliers')
    expect(arcCause?.relatedActors).toEqual([
      { kind: 'local_event', id: 'festival_arc_a' },
    ])
    expect(aleCause?.relatedActors).toEqual([{ kind: 'stock', id: 'ale' }])
    expect(stewCause?.relatedActors).toEqual([{ kind: 'stock', id: 'stew' }])
    expect(staffCause?.relatedActors).toContainEqual({
      kind: 'staff',
      id: fatigueStaffId,
    })
    expect(supplierCause?.relatedActors).toContainEqual({
      kind: 'supplier',
      id: strongSupplierId,
    })
  })
})

describe('Phase 43 — arcEffects raw cause relatedActors', () => {
  it('pressure_delta and reputation_signal causes carry the local_event arc ref', () => {
    const base = createInitialTavernState()
    const today = base.calendar.totalDaysElapsed
    const arc = {
      id: 'arc_phase43_eff',
      definitionId: 'inspection_campaign',
      label: 'Inspection Campaign',
      startedDay: today,
      intensity: 40,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: ['arc'],
      activeFlags: [],
      type: 'inspection_campaign',
      stage: 'rising' as const,
    }
    const definition = localArcRegistry.get('inspection_campaign')

    const capturedCauses: Array<{ relatedActors?: unknown; tags?: string[] }> = []
    const ctx = {
      state: base,
      modifyModuleState: (id: string, update: (current: unknown) => unknown) => {
        base.modules[id] = update(base.modules[id])
      },
      modifyPressure: () => {},
      modifyReputation: () => {},
      modifyCustomerGroup: () => {},
      modifySupplier: () => {},
      addCause: (cause: { relatedActors?: unknown; tags?: string[] }) => {
        capturedCauses.push(cause)
        return cause
      },
    } as unknown as SimContext

    for (const effect of definition.effects) {
      if (effect.kind !== 'pressure_delta' && effect.kind !== 'reputation_signal')
        continue
      applyArcEffect({ ctx, arc, definition, effect })
    }
    expect(capturedCauses.length).toBeGreaterThanOrEqual(2)
    const pressureCause = capturedCauses.find((c) =>
      c.tags?.includes('pressure'),
    )
    const reputationCause = capturedCauses.find((c) =>
      c.tags?.includes('reputation'),
    )
    expect(pressureCause?.relatedActors).toEqual([
      { kind: 'local_event', id: arc.id },
    ])
    expect(reputationCause?.relatedActors).toEqual([
      { kind: 'local_event', id: arc.id },
    ])
  })

  it('customer_group_modifier and supplier_modifier meta drafts carry the arc ref', () => {
    const base = createInitialTavernState()
    const today = base.calendar.totalDaysElapsed
    const arc = {
      id: 'arc_phase43_mod',
      definitionId: 'miner_payday_boom',
      label: 'Miner Boom',
      startedDay: today,
      intensity: 30,
      relatedFactionIds: [],
      relatedCultureIds: [],
      tags: ['arc'],
      activeFlags: [],
      type: 'mining_boom',
      stage: 'rising' as const,
    }
    const definition = localArcRegistry.get('miner_payday_boom')

    const capturedMetas: Array<{ relatedActors?: unknown }> = []
    const ctx = {
      state: base,
      modifyModuleState: (id: string, update: (current: unknown) => unknown) => {
        base.modules[id] = update(base.modules[id])
      },
      modifyPressure: () => {},
      modifyReputation: () => {},
      modifyCustomerGroup: (
        _id: string,
        _changes: unknown,
        meta: { relatedActors?: unknown },
      ) => {
        capturedMetas.push(meta)
      },
      modifySupplier: (
        _id: string,
        _changes: unknown,
        meta: { relatedActors?: unknown },
      ) => {
        capturedMetas.push(meta)
      },
      addCause: () => undefined,
    } as unknown as SimContext

    for (const effect of definition.effects) {
      if (
        effect.kind !== 'customer_group_modifier' &&
        effect.kind !== 'supplier_modifier'
      )
        continue
      applyArcEffect({ ctx, arc, definition, effect })
    }
    expect(capturedMetas.length).toBeGreaterThanOrEqual(1)
    for (const meta of capturedMetas) {
      expect(meta.relatedActors).toEqual([
        { kind: 'local_event', id: arc.id },
      ])
    }
  })
})
