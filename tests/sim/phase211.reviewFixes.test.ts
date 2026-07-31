import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import type { SimContext } from '../../src/sim/core/context'
import { simulateDay } from '../../src/sim/core/engine'
import { createRngStreams } from '../../src/sim/core/rng'
import { getScheduledEventDefinition, readScheduledEventsSlice } from '../../src/sim/contracts/scheduledEvents/index'
import { listPatronTabs } from '../../src/sim/modules/service/tabs'
import { buildParties } from '../../src/sim/modules/service/flow/parties'
import { applyServiceAreaImpact } from '../../src/sim/modules/service/flow/areaImpact'
import { emptyFlowResult, MAX_PARTIES_PER_DAY, type ServiceFlowResult } from '../../src/sim/modules/service/flow/types'
import { generateFlowIncidents } from '../../src/sim/modules/service/flow/flowIncidents'
import { createInitialServiceModuleState, getServiceModuleState } from '../../src/sim/modules/service/serviceModule'
import { openPatronTab } from '../../src/sim/modules/service/tabs'
import { SERVICE_SCHEDULED_EVENTS } from '../../src/sim/modules/service/serviceEvents'
import { REGULAR_SCHEDULED_EVENTS } from '../../src/sim/modules/regulars/regularEvents'
import { getRegularModuleState } from '../../src/sim/modules/regulars/state'
import { openRequests } from '../../src/sim/modules/regulars/regularRequests'
import { recordVisitOutcomes } from '../../src/sim/modules/regulars/regularOutcomes'
import { answerRegularRequestAction } from '../../src/sim/modules/ownerActions/serviceActions'
import { getStockModuleState } from '../../src/sim/modules/stock/state'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { RegularWorldState, TavernState } from '../../src/sim/state/TavernState'
import { withCustomerGroup, withStaff, withStock } from '../../src/sim/testing/stateFactories'

function mutableContext(initial: TavernState): {
  ctx: SimContext
  state: () => TavernState
} {
  let current = structuredClone(initial)
  const streams = createRngStreams('phase211-review-fixes')
  const ctx = {
    get state() {
      return current
    },
    getRngStream: (id: Parameters<typeof streams.get>[0]) => streams.get(id),
    getDayType: () => current.calendar.dayType,
    getCulture: (id: string) => current.world.cultures[id],
    modifyRegular: (
      id: string,
      changes: Partial<RegularWorldState>,
    ) => {
      const regular = current.world.regulars[id]
      if (!regular) return
      current = {
        ...current,
        world: {
          ...current.world,
          regulars: {
            ...current.world.regulars,
            [id]: { ...regular, ...changes },
          },
        },
      }
    },
    modifyCustomerGroup: (id: string, changes: Record<string, unknown>) => {
      const group = current.customerGroups[id]
      if (!group) return
      current = {
        ...current,
        customerGroups: {
          ...current.customerGroups,
          [id]: { ...group, ...changes },
        },
      }
    },
    modifyArea: (id: string, changes: Record<string, unknown>) => {
      const area = current.areas[id]
      if (!area) return
      current = {
        ...current,
        areas: { ...current.areas, [id]: { ...area, ...changes } },
      }
    },
    modifyModuleState: <T>(
      moduleId: string,
      updater: (value: T | undefined) => T,
    ) => {
      current = {
        ...current,
        modules: {
          ...current.modules,
          [moduleId]: updater(current.modules[moduleId] as T | undefined),
        },
      }
    },
    addCause: () => undefined,
    addMemory: () => undefined,
    addHistory: () => undefined,
  } as unknown as SimContext
  return { ctx, state: () => current }
}

function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 4000 }), 'stew', {
      quantity: 4000,
    }),
    'mushrooms',
    { quantity: 4000 },
  )
}

describe('Phase 211 automated-review regressions', () => {
  it('conserves every group after the party cap and clamps regular companions', () => {
    const state = createInitialTavernState()
    const streams = createRngStreams('phase211-party-review')
    const ctx = {
      state,
      getRngStream: () => streams.get('service_flow'),
    } as unknown as SimContext

    const capped = buildParties(ctx, {
      demandByGroup: { adventurers: 1000, ogres: 7 },
      regularVisitIds: [],
    })
    expect(capped.length).toBeLessThanOrEqual(MAX_PARTIES_PER_DAY)
    expect(capped.some((party) => party.groupId === 'ogres')).toBe(true)
    expect(
      capped.reduce((sum, party) => sum + party.size, 0),
    ).toBe(1007)

    const regular = Object.values(state.world.regulars)[0]!
    const oneHead = buildParties(ctx, {
      demandByGroup: { [regular.customerGroupId]: 1 },
      regularVisitIds: [regular.id],
    })
    expect(oneHead).toHaveLength(1)
    expect(oneHead[0]!.size).toBe(1)
  })

  it('registers service and regular event owners at import time', () => {
    for (const definition of [
      ...SERVICE_SCHEDULED_EVENTS,
      ...REGULAR_SCHEDULED_EVENTS,
    ]) {
      expect(getScheduledEventDefinition(definition.type)).toBeDefined()
    }
  })

  it('opens requests only for regulars whose visit intent succeeded', () => {
    const initial = createInitialTavernState()
    const regular = Object.values(initial.world.regulars)[0]!
    const state: TavernState = {
      ...initial,
      recipes: {
        ...initial.recipes,
        dish_ale: { ...initial.recipes['dish_ale']!, onMenu: false },
      },
      world: {
        ...initial.world,
        regulars: {
          ...initial.world.regulars,
          [regular.id]: {
            ...regular,
            favoriteRecipeId: 'dish_ale',
            ownerStanding: 80,
          },
        },
      },
    }
    const mutable = mutableContext(state)
    expect(openRequests(mutable.ctx, [])).toEqual([])
    expect(mutable.state().world.regulars[regular.id]!.openRequest).toBeUndefined()
    expect(openRequests(mutable.ctx, [regular.id])).toEqual([regular.id])
    expect(mutable.state().world.regulars[regular.id]!.openRequest?.status).toBe(
      'open',
    )
  })

  it('lets an autonomously returning regular roll a visit in the same day', () => {
    let initial = stocked(createInitialTavernState())
    const regular = Object.values(initial.world.regulars)[0]!
    initial = withCustomerGroup(initial, regular.customerGroupId, {
      patronage: 100,
      loyalty: 100,
      satisfaction: 100,
    })
    initial = {
      ...initial,
      calendar: { ...initial.calendar, totalDaysElapsed: 10 },
      world: {
        ...initial.world,
        regulars: {
          ...initial.world.regulars,
          [regular.id]: {
            ...regular,
            loyalty: 100,
            irritation: 0,
            ownerStanding: 100,
            stoppedVisiting: { sinceDay: 0, reason: 'their usual is off' },
            favoriteRecipeId: 'dish_ale',
          },
        },
      },
    }

    let returnedWithIntent = false
    for (let attempt = 0; attempt < 12 && !returnedWithIntent; attempt += 1) {
      const after = simulateDay(
        initial,
        { seed: `phase211-return-review-${attempt}` },
        FULL_PIPELINE,
      ).state
      const slice = getRegularModuleState(after)
      returnedWithIntent =
        slice.returnedToday.includes(regular.id) &&
        slice.visitIntents.some((intent) => intent.regularId === regular.id)
    }
    expect(returnedWithIntent).toBe(true)
  })

  it('schedules a tab due date and wipes the real debt before granting its request', () => {
    const initial = createInitialTavernState()
    const regular = Object.values(initial.world.regulars)[0]!
    const mutable = mutableContext(initial)
    const entry = openPatronTab(mutable.ctx, {
      amount: 20,
      groupId: regular.customerGroupId,
      debtorKind: 'regular',
      debtorId: regular.id,
      collectionProbability: 0.8,
      readable: `${regular.name.display} owes 20 coin.`,
    })!
    const scheduled = readScheduledEventsSlice(mutable.state()).queue.find(
      (event) =>
        (event.payload as { obligationId?: string }).obligationId ===
        entry.obligationId,
    )
    expect(scheduled).toBeDefined()

    mutable.ctx.modifyModuleState('service', () => ({
      ...createInitialServiceModuleState(),
      patronTabs: [entry],
    }), { source: 'test' })
    mutable.ctx.modifyRegular(regular.id, {
      openRequest: {
        id: 'request-slate',
        kind: 'forgive_my_slate',
        openedOnDay: 0,
        expiresOnDay: 7,
        readable: `${regular.name.display} asks to clear the slate.`,
        status: 'open',
      },
    }, { source: 'test' })

    answerRegularRequestAction.apply!(mutable.ctx, {
      actionId: 'answer_regular_request',
      targetId: regular.id,
      amount: 1,
    })
    expect(
      listPatronTabs(mutable.state()).filter(
        (record) => record.counterparty.id === regular.id,
      ),
    ).toEqual([])
    expect(mutable.state().world.regulars[regular.id]!.openRequest?.status).toBe(
      'granted',
    )
  })

  it('deduplicates authoritative shortages per group and ingredient', () => {
    let state = createInitialTavernState()
    for (const groupId of Object.keys(state.customerGroups)) {
      state = withCustomerGroup(state, groupId, {
        patronage: groupId === 'miners' ? 100 : 0,
      })
    }
    state = withStock(withStock(withStock(state, 'ale', { quantity: 0 }), 'stew', {
      quantity: 0,
    }), 'mushrooms', { quantity: 0 })
    const after = simulateDay(
      state,
      { seed: 'phase211-shortage-review' },
      FULL_PIPELINE,
    ).state
    const stockShortages = getStockModuleState(after).shortages.filter(
      (shortage) => shortage.reason === 'unmet_demand',
    )
    const flow = getServiceModuleState(after).result.flow
    const perGroupUnique = Object.values(flow.shortagesByGroup).reduce(
      (count, shortages) =>
        count + new Set(shortages.map((shortage) => shortage.stockId)).size,
      0,
    )
    expect(stockShortages.length).toBe(perGroupUnique)
  })

  it('records incident, shortage, and wait instead of a favourite-only memory', () => {
    const initial = createInitialTavernState()
    const regular = Object.values(initial.world.regulars)[0]!
    const flow = emptyFlowResult()
    flow.ran = true
    flow.shortagesByGroup[regular.customerGroupId] = [
      { stockId: 'ale', requested: 3, available: 0, day: 1, reason: 'unmet_demand' },
    ]
    flow.parties = [
      {
        id: 'party_001',
        groupId: regular.customerGroupId,
        size: 1,
        regularId: regular.id,
        arrivalWave: 0,
        patience: 5,
        wavesWaited: 2,
        seatedWave: 0,
        servedWave: 2,
        areaId: 'main_room',
        outcome: 'served',
        order: [
          { recipeId: 'dish_ale', servings: 1, delivered: 1, drivers: [] },
        ],
        paid: 1,
        tab: 0,
        notes: ['No ale left for part of the order.'],
      },
    ]
    const state: TavernState = {
      ...initial,
      world: {
        ...initial.world,
        regulars: {
          ...initial.world.regulars,
          [regular.id]: {
            ...regular,
            favoriteRecipeId: 'dish_ale',
            favoriteAreaId: 'main_room',
          },
        },
      },
      modules: {
        ...initial.modules,
        service: {
          result: {
            flow,
            incidents: [
              {
                id: 'minor_brawl',
                severity: 40,
                actorGroup: regular.customerGroupId,
                areaId: 'main_room',
                effects: [],
              },
            ],
          },
        },
      },
    }
    const mutable = mutableContext(state)
    recordVisitOutcomes(mutable.ctx, [regular.id])
    const kinds = mutable.state().world.regulars[regular.id]!.serviceMemory?.map(
      (memory) => memory.kind,
    )
    expect(kinds).toEqual(expect.arrayContaining(['shortage', 'incident', 'waited']))
    expect(kinds).not.toContain('served_favourite')
  })

  it('attributes a brawl to the rowdy group and includes its extra damage', () => {
    let state = stocked(createInitialTavernState())
    for (const groupId of Object.keys(state.customerGroups)) {
      state = withCustomerGroup(state, groupId, {
        patronage: groupId === 'ogres' ? 100 : 0,
        rowdiness: groupId === 'ogres' ? 100 : 0,
        loyalty: 100,
        satisfaction: 100,
      })
    }
    state = withStaff(state, 'cleaner_bouncer', { unavailable: true })
    state = { ...state, calendar: { ...state.calendar, dayType: 'brawl_night' } }
    const after = simulateDay(
      state,
      { seed: 'brawl-0' },
      FULL_PIPELINE,
    ).state
    const result = getServiceModuleState(after).result
    const brawl = result.incidents.find((incident) => incident.id === 'minor_brawl')
    expect(brawl?.actorGroup).toBe('ogres')

    const baseline = mutableContext(state)
    applyServiceAreaImpact(baseline.ctx, result.flow, result.serviceQuality)
    const baselineDelta =
      baseline.state().areas[brawl!.areaId!]!.damage -
      state.areas[brawl!.areaId!]!.damage
    const serviceDelta = result.damageCreated.find(
      (change) => change.areaId === brawl!.areaId && change.field === 'damage',
    )?.delta
    expect(serviceDelta).toBe(
      baselineDelta + 1,
    )

    // A fabricated mixed room confirms alphabetic order cannot blame a quiet
    // group when the rowdy group is the one that supplied the heat.
    const mixed: ServiceFlowResult = {
      ...emptyFlowResult(),
      ran: true,
      capacity: {
        ...emptyFlowResult().capacity,
        seats: 20,
        seatsByArea: [{ areaId: 'main_room', seats: 20 }],
      },
      parties: [
        {
          id: 'party_001', groupId: 'adventurers', size: 15, arrivalWave: 0,
          patience: 2, wavesWaited: 0, seatedWave: 0, servedWave: 0,
          areaId: 'main_room', outcome: 'served', paid: 15, tab: 0, notes: [],
          order: [{ recipeId: 'dish_ale', servings: 15, delivered: 15, drivers: [] }],
        },
        {
          id: 'party_002', groupId: 'ogres', size: 5, arrivalWave: 0,
          patience: 2, wavesWaited: 0, seatedWave: 0, servedWave: 0,
          areaId: 'main_room', outcome: 'served', paid: 5, tab: 0, notes: [],
          order: [{ recipeId: 'dish_ale', servings: 5, delivered: 5, drivers: [] }],
        },
      ],
    }
    const actor = generateFlowIncidents(baseline.ctx, {
      flow: mixed,
      quality: {
        foodQualityModifier: 0, serviceSpeed: 0, tabControl: 0,
        messControl: 0, fightControl: 0, repairSupport: 0, staffSummaries: [],
      },
      regularsById: {},
      dayType: 'brawl_night',
    }).find((incident) => incident.id === 'minor_brawl')
    expect(actor?.actorGroup).toBe('ogres')
  })
})
