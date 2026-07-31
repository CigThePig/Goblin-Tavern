// Expansion Phase 4 (repo phase 211) / ISSUE-174 — the plan's required tests
// for the within-service flow, customer choice, and patron tabs.
//
// The plan lists ten. This file holds the eight that are about the flow itself:
//
//   1. capacity bottlenecks under equal demand
//   2. seating, kitchen, server and cleaning bottleneck isolation
//   3. patience and abandonment
//   4. table turnover and upgrade effects
//   5. actual served recipe driving preference/taboo results
//   6. bounded party/event counts under extreme traffic
//   7. no double sale, stock consumption, or payment
//   8. reports reconcile service substeps to aggregate ledger totals
//
// The regular-behaviour test and the full-day-versus-segmented equivalence and
// reload tests live in `phase211.regularsAndTabs.test.ts` and
// `phase211.serviceBeatPersistence.test.ts`.
//
// EVERY SETUP HERE IS REACHABLE. §5.3 forbids reaching a feature by injecting
// impossible state, so a bottleneck is produced the way a player would produce
// one — by losing a role, blocking a room, or letting the crowd grow — and never
// by writing a capacity number onto state.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import {
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import { getServiceModuleState } from '../../src/sim/modules/service/index'
import { getStockModuleState } from '../../src/sim/modules/stock/index'
import {
  MAX_PARTIES_PER_DAY,
  SERVICE_WAVES,
} from '../../src/sim/modules/service/flow/types'
import type { ServiceFlowResult } from '../../src/sim/modules/service/flow/types'

const SEED = 'phase211/service-flow'

function input(extra: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...extra }
}

function runDay(state: TavernState, extra: Partial<SimInput> = {}) {
  return simulateDay(state, input(extra), FULL_PIPELINE)
}

function flowOf(state: TavernState): ServiceFlowResult {
  return getServiceModuleState(state).result.flow
}

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0)
}

/** A cellar deep enough that stock is never the constraint under test. */
function stocked(state: TavernState): TavernState {
  return withStock(
    withStock(withStock(state, 'ale', { quantity: 4000 }), 'stew', {
      quantity: 4000,
    }),
    'mushrooms',
    { quantity: 4000 },
  )
}

/** A crowd big enough to press on whatever the tightest stage is. */
function busy(state: TavernState): TavernState {
  let next = state
  for (const groupId of Object.keys(state.customerGroups)) {
    if ((state.customerGroups[groupId]?.patronage ?? 0) <= 0) continue
    next = withCustomerGroup(next, groupId, { patronage: 95 })
  }
  return next
}

/**
 * Take somebody off the roster the way an illness does.
 *
 * The absence record is the shape `roster.ts` itself writes when somebody is
 * taken ill, so this is a state the simulation produces on its own rather than
 * an injected impossibility (§5.3).
 */
function without(state: TavernState, staffId: string): TavernState {
  return withStaff(state, staffId, {
    unavailable: true,
    absence: {
      kind: 'illness',
      startedOnDay: state.calendar.totalDaysElapsed,
      untilDay: state.calendar.totalDaysElapsed + 3,
      reason: 'taken ill',
    },
  })
}

describe('Phase 211 §4.1 — capacity binds under equal demand', () => {
  it('the same crowd is served differently by a sound and a rotten kitchen', () => {
    // The kitchen's CONDITION is varied, not its staffing: losing a role would
    // also change the crew's published `serviceSpeed`, which feeds the traffic
    // forecast — so the two nights would not have faced the same crowd, and
    // "under equal demand" would be untrue of the comparison.
    const base = busy(stocked(createInitialTavernState()))
    const rotten: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        kitchen: { ...base.areas['kitchen']!, condition: 5 },
      },
    }

    const soundFlow = flowOf(runDay(base).state)
    const rottenFlow = flowOf(runDay(rotten).state)

    // Same demand — the crowd that set out is identical.
    expect(sum(rottenFlow.demandByGroup)).toBe(sum(soundFlow.demandByGroup))
    // Different outcome, and the difference is capacity.
    expect(rottenFlow.capacity.prepPerWave).toBeLessThan(
      soundFlow.capacity.prepPerWave,
    )
    expect(sum(rottenFlow.servedByGroup)).toBeLessThan(
      sum(soundFlow.servedByGroup),
    )
    expect(rottenFlow.bottleneck?.reason).toBe('kitchen')
  })

  it('an ordinary night on the reference route serves everybody', () => {
    const result = runDay(createInitialTavernState())
    const flow = flowOf(result.state)
    expect(flow.ran).toBe(true)
    expect(sum(flow.abandonedByGroup)).toBe(0)
    expect(sum(flow.servedByGroup)).toBe(sum(flow.demandByGroup))
  })
})

describe('Phase 211 §4.1 — each stage can be the bottleneck on its own', () => {
  it('losing the cook makes the kitchen the bottleneck', () => {
    const state = without(busy(stocked(createInitialTavernState())), 'cook')
    const flow = flowOf(runDay(state).state)
    expect(flow.bottleneck?.reason).toBe('kitchen')
    expect(flow.capacity.drivers.kitchen).toBe(0)
  })

  it('losing the server makes delivery the bottleneck', () => {
    // An ORDINARY crowd, not a flood: with the kitchen unaffected it comfortably
    // cooks what an ordinary night wants, so the only stage that cannot cope is
    // the empty floor. Piling on a payday crowd would have overrun the kitchen
    // too and the isolation would have proved nothing.
    const state = without(stocked(createInitialTavernState()), 'server')
    const flow = flowOf(runDay(state).state)
    expect(flow.capacity.drivers.service).toBe(0)
    expect(flow.bottleneck?.reason).toBe('delivery')
  })

  it('a room the player let rot turns people away for want of a seat', () => {
    // Dereliction is what takes seats out of service — the same rule the areas
    // module uses for `isAreaDamaged`, so this is a room the player let rot.
    const sound = busy(stocked(createInitialTavernState()))
    const derelict: TavernState = {
      ...sound,
      areas: Object.fromEntries(
        Object.entries(sound.areas).map(([id, area]) => [
          id,
          area.tags.includes('customer_facing') ? { ...area, condition: 2 } : area,
        ]),
      ),
    }

    const soundFlow = flowOf(runDay(sound).state)
    const derelictFlow = flowOf(runDay(derelict).state)

    expect(derelictFlow.capacity.seats).toBeLessThan(soundFlow.capacity.seats)
    const soundSeatBlocks = soundFlow.waves.reduce((t, w) => t + w.blocked.seats, 0)
    const derelictSeatBlocks = derelictFlow.waves.reduce(
      (t, w) => t + w.blocked.seats,
      0,
    )
    // Seats are a stage that gave way, and it gave way because the room did.
    expect(derelictSeatBlocks).toBeGreaterThan(soundSeatBlocks)
  })

  it('an empty cellar makes stock the bottleneck', () => {
    const state = busy(
      withStock(withStock(createInitialTavernState(), 'ale', { quantity: 2 }), 'stew', {
        quantity: 2,
      }),
    )
    const result = runDay(state)
    const flow = flowOf(result.state)
    const stockBlocks = flow.waves.reduce((total, wave) => total + wave.blocked.stock, 0)
    expect(stockBlocks).toBeGreaterThan(0)
    // And it is recorded as a shortage, not swallowed by a silent substitution.
    expect(getServiceModuleState(result.state).result.shortages.length).toBeGreaterThan(0)
  })

  it('losing the cleaner leaves tables standing dirty', () => {
    const withCleaner = flowOf(runDay(busy(stocked(createInitialTavernState()))).state)
    const noCleaner = flowOf(
      runDay(without(busy(stocked(createInitialTavernState())), 'cleaner_bouncer')).state,
    )
    expect(noCleaner.capacity.resetPerWave).toBeLessThan(
      withCleaner.capacity.resetPerWave,
    )
    expect(noCleaner.unresetSeats).toBeGreaterThanOrEqual(withCleaner.unresetSeats)
    // And the mess carries into the morning, which is how a cleaning shortfall
    // reaches tomorrow's service rather than vanishing at midnight.
    const dirtyRooms = Object.values(noCleaner.unresetByArea).reduce(
      (total, seats) => total + seats,
      0,
    )
    expect(dirtyRooms).toBe(noCleaner.unresetSeats)
  })
})

describe('Phase 211 §4.1 — patience and abandonment', () => {
  it('a crowd the kitchen cannot feed gives up and goes home', () => {
    const state = without(busy(stocked(createInitialTavernState())), 'cook')
    const result = runDay(state)
    const flow = flowOf(result.state)

    const abandoned = sum(flow.abandonedByGroup)
    expect(abandoned).toBeGreaterThan(0)
    // Everybody is accounted for: served, gone, or still in when the doors shut.
    expect(abandoned + sum(flow.servedByGroup)).toBeLessThanOrEqual(
      sum(flow.demandByGroup),
    )
    // And the parties that left say why.
    const walked = flow.parties.filter((party) => party.outcome !== 'served')
    expect(walked.length).toBeGreaterThan(0)
    expect(walked.every((party) => party.notes.length > 0)).toBe(true)
  })

  it('the groups who left are unhappier for it', () => {
    const state = without(busy(stocked(createInitialTavernState())), 'cook')
    const result = runDay(state)
    const flow = flowOf(result.state)
    const worst = Object.entries(flow.abandonedByGroup).sort(
      (a, b) => b[1] - a[1],
    )[0]
    expect(worst).toBeDefined()
    const [groupId] = worst!
    const before = state.customerGroups[groupId]!.satisfaction
    expect(result.state.customerGroups[groupId]!.satisfaction).toBeLessThan(before)
    // …and the reason is on the record.
    expect(
      result.state.causes.some(
        (cause) =>
          cause.target === `customer:${groupId}.satisfaction` &&
          cause.tags.includes('abandonment'),
      ),
    ).toBe(true)
  })
})

describe('Phase 211 §4.1 — turnover and upgrades', () => {
  it('more seats mean fewer people turned away', () => {
    let base = busy(stocked(createInitialTavernState()))
    base = {
      ...base,
      areas: Object.fromEntries(
        Object.entries(base.areas).map(([id, area]) => [
          id,
          id === 'main_room' ? { ...area, condition: 20 } : area,
        ]),
      ),
    }
    // The same room with `better_tables` installed: +6 seats and −5 mess, so it
    // both holds more people and turns tables round faster.
    const upgraded: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        main_room: {
          ...base.areas['main_room']!,
          upgrades: {
            ...base.areas['main_room']!.upgrades,
            better_tables: {
              id: 'better_tables',
              status: 'installed',
              installedAtDay: 0,
              condition: 100,
              tags: [],
            },
          },
        },
      },
    }

    const plainFlow = flowOf(runDay(base).state)
    const upgradedFlow = flowOf(runDay(upgraded).state)

    expect(upgradedFlow.capacity.seats).toBeGreaterThan(plainFlow.capacity.seats)
    expect(sum(upgradedFlow.servedByGroup)).toBeGreaterThanOrEqual(
      sum(plainFlow.servedByGroup),
    )
  })

  it('served parties free their seats again before the night is out', () => {
    const flow = flowOf(runDay(stocked(createInitialTavernState())).state)
    const served = flow.parties.filter((party) => party.outcome === 'served')
    expect(served.length).toBeGreaterThan(0)
    // Turnover is real: somebody who was served earlier in the evening has left.
    expect(served.some((party) => party.leftWave !== undefined)).toBe(true)
    // And occupancy is never more than the room holds.
    for (const wave of flow.waves) {
      expect(wave.occupied).toBeLessThanOrEqual(flow.capacity.seats)
    }
  })
})

describe('Phase 211 §4.4 — the dish that was actually served drives the result', () => {
  it('a culture taboo fires on the delivered recipe, not on the menu', () => {
    // Goblin culture dislikes nothing by default, so the taboo is reached the
    // way the sim reaches it: a group whose CULTURE minds a tag the group
    // itself is happy with. `dish_mushrooms` carries `risky`.
    let state = stocked(createInitialTavernState())
    const goblins = state.customerGroups['local_goblins']!
    const cultureId = goblins.cultureId
    state = {
      ...state,
      world: {
        ...state.world,
        cultures: {
          ...state.world.cultures,
          [cultureId]: {
            ...state.world.cultures[cultureId]!,
            dislikedTags: ['risky'],
          },
        },
      },
    }
    const result = runDay(busy(state))
    const slice = getServiceModuleState(result.state).result
    const taboo = slice.incidents.find((incident) => incident.id === 'taboo_served')
    expect(taboo).toBeDefined()
    expect(taboo!.effects.some((effect) => effect.includes('dish_mushrooms'))).toBe(true)

    // The dish really was delivered — the incident is not speculative.
    const delivered = slice.flow.parties.some((party) =>
      party.order.some(
        (line) => line.recipeId === 'dish_mushrooms' && line.delivered > 0,
      ),
    )
    expect(delivered).toBe(true)
  })

  it('a group refuses a dish its own tags veto, whatever the score', () => {
    // Merchants dislike `risky`, which `dish_mushrooms` carries.
    const result = runDay(busy(stocked(createInitialTavernState())))
    const flow = flowOf(result.state)
    const merchantOrders = flow.parties
      .filter((party) => party.groupId === 'merchants')
      .flatMap((party) => party.order)
    expect(merchantOrders.length).toBeGreaterThan(0)
    expect(merchantOrders.every((line) => line.recipeId !== 'dish_mushrooms')).toBe(
      true,
    )
  })
})

describe('Phase 211 §"bounded party/event counts under extreme traffic"', () => {
  it('a flood arrives as bigger parties, not unbounded ones', () => {
    let state = stocked(createInitialTavernState())
    for (const groupId of Object.keys(state.customerGroups)) {
      if ((state.customerGroups[groupId]?.patronage ?? 0) <= 0) continue
      state = withCustomerGroup(state, groupId, {
        patronage: 100,
        loyalty: 100,
        satisfaction: 100,
      })
    }
    const flow = flowOf(runDay(state).state)

    expect(flow.parties.length).toBeLessThanOrEqual(MAX_PARTIES_PER_DAY)
    expect(flow.waves.length).toBe(SERVICE_WAVES)
    // Headcount is conserved exactly: nobody is lost to the cap.
    const inParties = flow.parties.reduce((total, party) => total + party.size, 0)
    expect(inParties).toBe(sum(flow.demandByGroup))
  })
})

describe('Phase 211 §"no double sale, stock consumption, or payment"', () => {
  it('every serving is sold exactly once', () => {
    const result = runDay(busy(stocked(createInitialTavernState())))
    const slice = getServiceModuleState(result.state).result

    // What the parties were given, per stock item, from the order lines…
    const deliveredByStock = new Map<string, number>()
    for (const party of slice.flow.parties) {
      for (const line of party.order) {
        if (line.delivered <= 0) continue
        // The three starter recipes are 1:1 on their single input.
        const stockId = line.recipeId.replace(/^dish_/, '')
        deliveredByStock.set(
          stockId,
          (deliveredByStock.get(stockId) ?? 0) + line.delivered,
        )
      }
    }
    // …must equal what the ledger says left the cellar.
    for (const consumed of slice.stockConsumed) {
      expect(deliveredByStock.get(consumed.stockId) ?? 0).toBe(consumed.quantity)
    }
    expect(slice.stockConsumed.length).toBe(deliveredByStock.size)
  })

  it('the coin ledger records each sale once and the tabs once', () => {
    const before = busy(stocked(createInitialTavernState()))
    const result = runDay(before)
    const slice = getServiceModuleState(result.state).result
    const ledger = getStockModuleState(result.state).ledger

    const sales = ledger
      .filter((entry) => entry.category === 'sales')
      .reduce((total, entry) => total + entry.amount, 0)
    expect(sales).toBe(slice.coinEarned)

    // Ledger spends are negative; the slice reports the slate as a positive sum.
    const tabs = ledger
      .filter((entry) => entry.tags.includes('unpaid_tab'))
      .reduce((total, entry) => total + entry.amount, 0)
    expect(-tabs).toBe(slice.unpaidTabs)
    expect(slice.netCoinEarned).toBe(slice.coinEarned - slice.unpaidTabs)
  })

  it('a party is never charged for a serving it never got', () => {
    // A cellar that runs dry mid-service: some ordered servings cannot land.
    const state = busy(
      withStock(withStock(createInitialTavernState(), 'ale', { quantity: 30 }), 'stew', {
        quantity: 30,
      }),
    )
    const flow = flowOf(runDay(state).state)
    for (const party of flow.parties) {
      const delivered = party.order.reduce((total, line) => total + line.delivered, 0)
      if (delivered === 0) {
        expect(party.paid).toBe(0)
        expect(party.tab).toBe(0)
      }
      // And a party never paid for more than it was handed.
      for (const line of party.order) {
        expect(line.delivered).toBeLessThanOrEqual(line.servings)
      }
    }
  })
})

describe('Phase 211 §"reports reconcile service substeps to aggregate totals"', () => {
  it('the aggregate result is the flow, added up', () => {
    const result = runDay(busy(stocked(createInitialTavernState())))
    const slice = getServiceModuleState(result.state).result
    const flow = slice.flow

    // Coin: the per-group rollup is the flow's own per-group coin.
    const rollupCoin = Object.values(slice.purchasesByGroup).reduce(
      (total, purchase) => total + purchase.coinEarned,
      0,
    )
    expect(rollupCoin).toBe(slice.coinEarned)
    expect(slice.netCoinEarned).toBe(slice.coinEarned - slice.unpaidTabs)

    // Traffic: every group's headline number is the demand the flow received.
    for (const [groupId, traffic] of Object.entries(slice.trafficByGroup)) {
      expect(traffic).toBe(flow.demandByGroup[groupId] ?? 0)
    }

    // Parties: the per-wave summaries add up to the day's arrivals.
    const arrivedAcrossWaves = flow.waves.reduce(
      (total, wave) => total + wave.arrived,
      0,
    )
    const inParties = flow.parties.reduce((total, party) => total + party.size, 0)
    expect(arrivedAcrossWaves).toBe(inParties)
  })

  it('the daily service report states the reconciliation it is claiming', () => {
    const result = runDay(busy(stocked(createInitialTavernState())))
    const section = result.reports.find((report) => report.id === 'service')
    expect(section).toBeDefined()
    const text = section!.lines.join('\n')
    expect(text).toContain('Service Flow:')
    expect(text).toContain('Reconciles:')
    expect(text).toContain('Takings reconcile:')
    expect(text).toMatch(/Bottleneck:/)
  })
})
