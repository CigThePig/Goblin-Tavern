import { describe, it, expect } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../../src/sim/core/engine'
import { DAY_SEGMENTS } from '../../src/sim/core/segments'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { safeValidateState } from '../../src/sim/state/validation'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { areaUpgradeRegistry } from '../../src/sim/content/tavern/areaUpgradeRegistry'
import {
  checkUpgradeEligibility,
  listCatalogueForArea,
  quoteAreaUpgrade,
  upgradeLabourRequired,
} from '../../src/sim/modules/areas/quote'
import { getUsableCapacity } from '../../src/sim/modules/areas/capacity'
import { getAreasModuleState } from '../../src/sim/modules/areas/state'
import {
  TIME_COST_SHORT,
  TIME_COST_STANDARD,
} from '../../src/sim/modules/ownerActions/stateHelpers'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/stateHelpers'
import { buildUpgradeHelp } from '../../src/reports/upgradeHelp'
import { buildTavernOverview } from '../../src/reports/tavernOverviewProjection'
import type { SimInputOwnerAction } from '../../src/sim/core/context'
import type { TavernState } from '../../src/sim/state/TavernState'

// Expansion Phase 2 (repo phase 209) / ISSUE-172 — OBL-01.
//
// The plan's "Required tests" list for Phase 2, in order:
//
//   1. natural discovery and construction of every upgrade family
//   2. quote and authoritative cost agreement
//   3. insufficient coin, time, material, and labour rejection
//   4. start → in progress → interrupted → resumed → installed
//   5. installed effect on service or another consuming system
//   6. damage → disabled → repair
//   7. save/load at every construction state
//   8. deterministic construction progress
//   9. no duplicate trait/upgrade representation
//  10. bounded area effect propagation
//
// (1)–(9) are here; (10) and the capacity/propagation half of (5) are in
// `phase209.areaCapacityAndPropagation.test.ts`.
//
// EVERY test reaches the feature the way a player does: it queues a real owner
// action on `SimInput` and runs `simulateDay` on the full pipeline. Nothing
// injects an upgrade record, because §5 fails a phase whose tests reach the
// feature only by injecting impossible state. Where a build needs materials or
// coin, the test buys them the way a player would (`withStock` / `withCoin` are
// starting conditions, not injected outcomes).

const SEED = 'phase-209-area-upgrade-lifecycle'

function input(
  actions?: ReadonlyArray<SimInputOwnerAction>,
  staffPriorities?: Record<string, string>,
) {
  return {
    seed: SEED,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
    ...(staffPriorities ? { staffPriorities } : {}),
  }
}

function runDay(
  state: TavernState,
  actions?: ReadonlyArray<SimInputOwnerAction>,
  staffPriorities?: Record<string, string>,
) {
  return simulateDay(state, input(actions, staffPriorities), FULL_PIPELINE)
}

/**
 * The one staff assignment that puts a body on a construction site.
 *
 * Only `cleaner_bouncer` may take `minor_repairs` (`staffRegistry`), and the
 * priority is re-assigned from input every morning — so a crew is something the
 * player keeps choosing, day by day, at the cost of whatever that member was
 * doing instead. That is the §2.3 decision, and a test that set
 * `currentPriority` on state directly would be testing nothing, because the
 * `assignStaffPriorities` phase overwrites it.
 */
const CREW: Record<string, string> = { cleaner_bouncer: 'minor_repairs' }

/** A tavern with coin and a materials yard, the way a prepared player has one. */
function preparedTavern(coin = 400): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  state = withStock(state, 'timber', { quantity: 60 })
  state = withStock(state, 'cut_stone', { quantity: 40 })
  return state
}

function target(areaId: string, upgradeId: string): string {
  return `${areaId}:${upgradeId}`
}

function record(state: TavernState, areaId: string, upgradeId: string) {
  return state.areas[areaId]?.upgrades[upgradeId]
}

/** Run days until the named build leaves `in_progress`, or the cap is hit. */
function runUntilInstalled(
  state: TavernState,
  areaId: string,
  upgradeId: string,
  maxDays = 30,
): { state: TavernState; days: number } {
  let current = state
  for (let day = 1; day <= maxDays; day += 1) {
    current = runDay(current).state
    const live = record(current, areaId, upgradeId)
    if (live?.status === 'installed') return { state: current, days: day }
  }
  return { state: current, days: maxDays }
}

// ---------------------------------------------------------------- 1. discovery

describe('Phase 209 §2.2 — discovery and construction of every upgrade family', () => {
  it('every catalogue entry is offered by start_area_upgrade in at least one area', () => {
    const state = preparedTavern()
    const def = actionRegistry.get('start_area_upgrade')
    const offered = new Set(
      def.getValidTargets({ state } as never).map((t) => t.id.split(':')[1]!),
    )
    // Two are gated behind a prerequisite on day one (`private_booths` needs
    // better tables, `hidden_reserve_rack` needs the stone shelves,
    // `reinforced_beams` needs patched thatch). Those are eligibility rules with
    // their own reason, not missing discovery — the next assertion proves each
    // one is offered once its prerequisite is met.
    const gated = new Set(['private_booths', 'hidden_reserve_rack', 'reinforced_beams'])
    for (const catalogue of areaUpgradeRegistry.all()) {
      if (gated.has(catalogue.id)) {
        expect(offered.has(catalogue.id)).toBe(false)
        continue
      }
      expect(offered.has(catalogue.id)).toBe(true)
    }
    expect(offered.size).toBe(areaUpgradeRegistry.all().length - gated.size)
  })

  it('every target carries a quote in its hint, so the choice is legible', () => {
    const state = preparedTavern()
    const def = actionRegistry.get('start_area_upgrade')
    for (const t of def.getValidTargets({ state } as never)) {
      expect(t.hint).toBeDefined()
      expect(t.hint).toMatch(/coin/)
      expect(t.hint).toMatch(/labour/)
    }
  })

  it('every upgrade family can actually be built to installed through owner actions', () => {
    // One representative per area, covering all five required areas plus the
    // prerequisite chains, built end to end on the real pipeline.
    const families: Array<[string, string]> = [
      ['main_room', 'better_tables'],
      ['kitchen', 'clean_prep_bench'],
      ['cellar', 'cold_stone_shelves'],
      ['privy', 'lime_bucket_station'],
      ['roof', 'patched_thatch'],
    ]
    for (const [areaId, upgradeId] of families) {
      let state = preparedTavern()
      const first = runDay(state, [
        { actionId: 'start_area_upgrade', targetId: target(areaId, upgradeId) },
      ])
      expect(
        getOwnerActionsModuleState(first.state).rejected,
        `${upgradeId} was rejected: ${JSON.stringify(getOwnerActionsModuleState(first.state).rejected)}`,
      ).toHaveLength(0)
      state = first.state
      const finished = runUntilInstalled(state, areaId, upgradeId)
      expect(
        record(finished.state, areaId, upgradeId)?.status,
        `${upgradeId} never reached installed`,
      ).toBe('installed')
    }
  })

  it('a prerequisite chain becomes offered once its prerequisite is installed', () => {
    let state = preparedTavern()
    state = runDay(state, [
      { actionId: 'start_area_upgrade', targetId: target('main_room', 'better_tables') },
    ]).state
    // Blocked with a specific reason while the tables are unbuilt.
    const blocked = checkUpgradeEligibility(state, 'main_room', 'private_booths')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toMatch(/Better Tables/)

    state = runUntilInstalled(state, 'main_room', 'better_tables').state
    expect(checkUpgradeEligibility(state, 'main_room', 'private_booths').ok).toBe(true)

    const def = actionRegistry.get('start_area_upgrade')
    const offered = def.getValidTargets({ state } as never).map((t) => t.id)
    expect(offered).toContain(target('main_room', 'private_booths'))
  })
})

// -------------------------------------------------------------------- 2. quote

describe('Phase 209 §2.2 — quote and authoritative cost agreement', () => {
  it('charges exactly the quoted coin, materials and labour', () => {
    const state = preparedTavern()
    const quote = quoteAreaUpgrade(state, 'main_room', 'better_tables', {
      startMinutes: TIME_COST_STANDARD,
      fundMinutes: TIME_COST_SHORT,
    })!
    const timberBefore = state.stock['timber']!.quantity

    const result = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ])

    // Coin is compared through the day's own ledger rather than end-of-day
    // `state.coin`: the tavern also takes money over the bar, so the till is
    // not a difference of one charge.
    const ledger = (
      result.state.modules['stock'] as {
        ledger: ReadonlyArray<{ source: string; amount: number }>
      }
    ).ledger
    const charge = ledger.find((entry) =>
      entry.source.includes('upgrade.start.better_tables'),
    )!
    expect(charge.amount).toBe(-quote.coin)
    const timberLine = quote.materials.find((m) => m.stockId === 'timber')!
    expect(result.state.stock['timber']!.quantity).toBe(
      timberBefore - timberLine.required,
    )
    const live = record(result.state, 'main_room', 'better_tables')!
    expect(live.requiredProgress).toBe(quote.labourRequired)
    expect(live.coinInvested).toBe(quote.coin)

    // And the applied-action record keeps the quote beside the charge, so the
    // agreement is provable from the day's own report data.
    const applied = getOwnerActionsModuleState(result.state).applied.find(
      (a) => a.actionId === 'start_area_upgrade',
    )!
    expect((applied.data['quoted'] as { coin: number }).coin).toBe(quote.coin)
    expect((applied.data['coin'] as { spent: number }).spent).toBe(quote.coin)
  })

  it('the projection shows the same quote the action charges', () => {
    const state = preparedTavern()
    const overview = buildTavernOverview(state)
    const row = overview.areas.rows
      .find((area) => area.id === 'main_room')!
      .upgrades.find((u) => u.id === 'better_tables')!
    const quote = quoteAreaUpgrade(state, 'main_room', 'better_tables', {
      startMinutes: TIME_COST_STANDARD,
      fundMinutes: TIME_COST_SHORT,
    })!
    expect(row.quote?.coin).toBe(quote.coin)
    expect(row.quote?.labourRequired).toBe(quote.labourRequired)
  })

  it('a derelict room quotes and charges the surcharge, consistently', () => {
    let state = preparedTavern()
    state = {
      ...state,
      areas: {
        ...state.areas,
        kitchen: { ...state.areas['kitchen']!, condition: 20, cleanliness: 60 },
      },
    }
    const quote = quoteAreaUpgrade(state, 'kitchen', 'smoke_vent', {
      startMinutes: TIME_COST_STANDARD,
      fundMinutes: TIME_COST_SHORT,
    })!
    const base = areaUpgradeRegistry.get('smoke_vent').costCoin
    expect(quote.coin).toBeGreaterThan(base)

    const result = runDay(state, [
      { actionId: 'start_area_upgrade', targetId: target('kitchen', 'smoke_vent') },
    ])
    const applied = getOwnerActionsModuleState(result.state).applied.find(
      (a) => a.actionId === 'start_area_upgrade',
    )!
    expect((applied.data['coin'] as { spent: number }).spent).toBe(quote.coin)
    expect(record(result.state, 'kitchen', 'smoke_vent')!.coinInvested).toBe(quote.coin)
  })

  it('derived Help states the same numbers the catalogue holds', () => {
    const rows = buildUpgradeHelp()
    expect(rows).toHaveLength(areaUpgradeRegistry.all().length)
    for (const row of rows) {
      const def = areaUpgradeRegistry.get(row.upgradeId)
      expect(row.costLines.join(' ')).toContain(`${def.costCoin} coin`)
      expect(row.costLines.join(' ')).toContain(
        `${upgradeLabourRequired(def)} labour points`,
      )
      for (const line of def.materials ?? []) {
        expect(row.costLines.join(' ')).toContain(
          `${line.quantity} × ${line.stockId.replace(/_/g, ' ')}`,
        )
      }
      if (def.maintenance) {
        expect(row.upkeepLines.join(' ')).toContain(
          `every ${def.maintenance.intervalDays} days`,
        )
        expect(row.upkeepLines.join(' ')).toContain(`${def.maintenance.coin} coin`)
      }
      for (const required of def.eligibility?.requiresUpgrades ?? []) {
        expect(row.requirementLines.join(' ')).toContain(
          areaUpgradeRegistry.get(required).label,
        )
      }
    }
  })
})

// ---------------------------------------------------------------- 3. rejection

describe('Phase 209 §2.2 — insufficient coin, time, material and labour', () => {
  it('rejects a start the player cannot pay for, with a coin reason', () => {
    const state = withStock(withCoin(createInitialTavernState(), 5), 'timber', {
      quantity: 60,
    })
    const result = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ])
    const rejected = getOwnerActionsModuleState(result.state).rejected
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.code).toBe('insufficient_coin')
    expect(record(result.state, 'main_room', 'better_tables')).toBeUndefined()
  })

  it('rejects a start with no materials in store, naming the shortfall', () => {
    const state = withCoin(createInitialTavernState(), 400)
    expect(state.stock['timber']!.quantity).toBe(0)
    const result = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ])
    const rejected = getOwnerActionsModuleState(result.state).rejected
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.code).toBe('insufficient_materials')
    expect(rejected[0]!.reason).toMatch(/Timber/)
  })

  it('rejects work beyond the owner’s 360-minute day', () => {
    const state = preparedTavern()
    // Three standard chores fill the day; a fourth cannot fit.
    const result = runDay(state, [
      { actionId: 'clean_area', targetId: 'main_room' },
      { actionId: 'clean_area', targetId: 'kitchen' },
      { actionId: 'clean_area', targetId: 'cellar' },
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ])
    const slice = getOwnerActionsModuleState(result.state)
    expect(slice.timeSpent).toBeLessThanOrEqual(slice.timeBudget)
    expect(slice.rejected.some((r) => r.code === 'over_budget')).toBe(true)
    expect(record(result.state, 'main_room', 'better_tables')).toBeUndefined()
  })

  it('rejects a second site when there is no crew to run it', () => {
    let state = preparedTavern()
    state = runDay(state, [
      { actionId: 'start_area_upgrade', targetId: target('kitchen', 'sharp_knives') },
    ]).state
    // `sharp_knives` needs one labour point, so it may already be done; use a
    // long build to hold the single crew slot.
    state = preparedTavern()
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('roof', 'patched_thatch'),
      },
    ]).state
    const second = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('cellar', 'cold_stone_shelves'),
      },
    ])
    const rejected = getOwnerActionsModuleState(second.state).rejected
    // Either the roof finished (one labour point a day, two needed) and the
    // second start is legal, or the slot is held and the reason is the crew.
    if (rejected.length > 0) {
      expect(rejected[0]!.code).toBe('no_free_crew')
      expect(rejected[0]!.reason).toMatch(/minor repairs/)
    } else {
      expect(record(second.state, 'roof', 'patched_thatch')?.status).not.toBe(
        'in_progress',
      )
    }
  })

  it('rejects funding, pausing or repairing a record that is not in that state', () => {
    const state = preparedTavern()
    const result = runDay(state, [
      {
        actionId: 'fund_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
      {
        actionId: 'repair_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ])
    const rejected = getOwnerActionsModuleState(result.state).rejected
    expect(rejected).toHaveLength(2)
    expect(rejected.map((r) => r.code)).toEqual([
      'unknown_target',
      'unknown_target',
    ])
  })
})

// ---------------------------------------------------------------- 4. lifecycle

describe('Phase 209 §2.2 — start → in progress → interrupted → resumed → installed', () => {
  it('walks the whole path through owner actions and keeps progress across the pause', () => {
    let state = preparedTavern()

    // start
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('privy', 'stone_drainage'),
      },
    ]).state
    expect(record(state, 'privy', 'stone_drainage')?.status).toBe('in_progress')

    // in progress
    state = runDay(state).state
    const working = record(state, 'privy', 'stone_drainage')!
    expect(working.progress ?? 0).toBeGreaterThan(0)
    expect(working.progress ?? 0).toBeLessThan(working.requiredProgress ?? 99)

    // interrupted
    state = runDay(state, [
      {
        actionId: 'pause_area_upgrade',
        targetId: target('privy', 'stone_drainage'),
      },
    ]).state
    const paused = record(state, 'privy', 'stone_drainage')!
    expect(paused.status).toBe('paused')
    expect(paused.progress).toBe(working.progress)
    expect(paused.pausedOnDay).toBeDefined()

    // a paused site banks no labour — the interruption is real
    state = runDay(state).state
    expect(record(state, 'privy', 'stone_drainage')?.progress).toBe(working.progress)

    // resumed
    state = runDay(state, [
      {
        actionId: 'resume_area_upgrade',
        targetId: target('privy', 'stone_drainage'),
      },
    ]).state
    expect(record(state, 'privy', 'stone_drainage')?.status).toBe('in_progress')

    // installed
    const finished = runUntilInstalled(state, 'privy', 'stone_drainage')
    const installed = record(finished.state, 'privy', 'stone_drainage')!
    expect(installed.status).toBe('installed')
    expect(installed.installedAtDay).toBeDefined()
    expect(installed.condition).toBe(100)
    expect(installed.upkeepDueDay).toBeDefined()
  })

  it('abandoning a build writes off what was spent and frees the crew', () => {
    let state = preparedTavern()
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('cellar', 'rat_proof_barrels'),
      },
    ]).state
    const spent = record(state, 'cellar', 'rat_proof_barrels')!.coinInvested

    state = runDay(state, [
      {
        actionId: 'cancel_area_upgrade',
        targetId: target('cellar', 'rat_proof_barrels'),
      },
    ]).state
    const cancelled = record(state, 'cellar', 'rat_proof_barrels')!
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.coinInvested).toBe(spent)
    expect(cancelled.disabledReason).toMatch(/Abandoned/)

    // A cancelled record can be started again from scratch.
    expect(checkUpgradeEligibility(state, 'cellar', 'rat_proof_barrels').ok).toBe(true)
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('cellar', 'rat_proof_barrels'),
      },
    ]).state
    const restarted = record(state, 'cellar', 'rat_proof_barrels')!
    expect(restarted.status).toBe('in_progress')
    // The restart banks nothing from the abandoned attempt; the only labour on
    // it is what the site itself put in during the same day's `endDay` tick.
    expect(restarted.progress!).toBeLessThanOrEqual(1)
    expect(restarted.coinInvested).toBe(
      areaUpgradeRegistry.get('rat_proof_barrels').costCoin,
    )
  })

  it('a site with nowhere to work reports why, and does not silently stall', () => {
    // Two builds in the same room: the second cannot have the floor.
    let state = preparedTavern()
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'reinforced_stools'),
      },
    ]).state
    // A staff member on repairs lifts the concurrency limit to two sites, which
    // isolates the same-room exclusivity rule from the crew limit.
    state = runDay(
      state,
      [
        {
          actionId: 'start_area_upgrade',
          targetId: target('main_room', 'hearth_repair'),
        },
      ],
      CREW,
    ).state

    const slice = getAreasModuleState(state)
    const conflicted = slice.schedule.filter((b) => b.status === 'conflicted')
    if (conflicted.length > 0) {
      for (const block of conflicted) {
        expect(block.conflictReason, `${block.id} conflicted with no reason`).toBeTruthy()
      }
    }
    // Whatever the schedule decided, no live site is left without an
    // explanation: it either progressed or it says why not.
    for (const entry of slice.construction) {
      if (entry.labourAdded === 0) expect(entry.stalledReason).toBeTruthy()
    }
  })
})

// ------------------------------------------------------- 5. installed effect

describe('Phase 209 §2.1 — an installed fitting changes a consuming system', () => {
  it('better_tables raises usable seating, and building it lowers it first', () => {
    const state = preparedTavern()
    const seatsBefore = getUsableCapacity(state.areas['main_room']!, 'seats')

    const started = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('main_room', 'better_tables'),
      },
    ]).state
    const seatsDuring = getUsableCapacity(started.areas['main_room']!, 'seats')
    expect(seatsDuring).toBeLessThan(seatsBefore)

    const finished = runUntilInstalled(started, 'main_room', 'better_tables').state
    const seatsAfter = getUsableCapacity(finished.areas['main_room']!, 'seats')
    expect(seatsAfter).toBe(
      seatsBefore + areaUpgradeRegistry.get('better_tables').capacityEffects!.seats!,
    )
  })

  it('cold_stone_shelves raises cellar storage, which the spoilage rule reads', () => {
    const state = preparedTavern()
    const before = getUsableCapacity(state.areas['cellar']!, 'storage')
    const finished = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('cellar', 'cold_stone_shelves'),
        },
      ]).state,
      'cellar',
      'cold_stone_shelves',
    ).state
    expect(getUsableCapacity(finished.areas['cellar']!, 'storage')).toBe(
      before + areaUpgradeRegistry.get('cold_stone_shelves').capacityEffects!.storage!,
    )
  })

  it('a fitting stops contributing capacity the moment it is disabled', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('main_room', 'better_tables'),
        },
      ]).state,
      'main_room',
      'better_tables',
    ).state
    const withFitting = getUsableCapacity(state.areas['main_room']!, 'seats')

    // Neglect the service long enough that it wears through the failure line.
    // No injected state: the upkeep rule does it, day by day.
    for (let day = 0; day < 90; day += 1) {
      state = runDay(state).state
      const live = record(state, 'main_room', 'better_tables')!
      if (live.status === 'disabled') break
    }
    const live = record(state, 'main_room', 'better_tables')!
    expect(['damaged', 'disabled']).toContain(live.status)
    if (live.status === 'disabled') {
      expect(getUsableCapacity(state.areas['main_room']!, 'seats')).toBeLessThan(
        withFitting,
      )
      expect(live.disabledReason).toBeTruthy()
    }
  })
})

// ------------------------------------------------------- 6. damage → repair

describe('Phase 209 §2.2 — damage → disabled → repair', () => {
  // Codex review, P2 — "Disable trait effects when fittings break". The first
  // cut of `damageUpgrade` changed only the upgrade record, so a fitting that
  // had scrubbed a trait on install kept scrubbing it while disabled: the
  // cellar stayed pest-free forever and the pest calculator kept granting a
  // benefit the record itself called out of service.
  it('a broken fitting stops giving the room what it was giving', () => {
    let state = preparedTavern()
    // The cellar comes with `pest_prone`; rat-proof barrels scrub it.
    expect(state.areas['cellar']!.traits).toContain('pest_prone')
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('cellar', 'rat_proof_barrels'),
        },
      ]).state,
      'cellar',
      'rat_proof_barrels',
    ).state
    expect(state.areas['cellar']!.traits).not.toContain('pest_prone')

    // Neglect the service until the barrels rot through.
    for (let day = 0; day < 90; day += 1) {
      state = runDay(state).state
      const live = record(state, 'cellar', 'rat_proof_barrels')!
      if (live.status === 'damaged' || live.status === 'disabled') break
    }
    expect(['damaged', 'disabled']).toContain(
      record(state, 'cellar', 'rat_proof_barrels')!.status,
    )
    // The pests are back, because the barrels are not holding them out.
    expect(state.areas['cellar']!.traits).toContain('pest_prone')

    // …and repairing them puts the benefit back.
    state = withCoin(state, 200)
    state = runDay(state, [
      {
        actionId: 'repair_area_upgrade',
        targetId: target('cellar', 'rat_proof_barrels'),
      },
    ]).state
    expect(record(state, 'cellar', 'rat_proof_barrels')!.status).toBe('installed')
    expect(state.areas['cellar']!.traits).not.toContain('pest_prone')
  })

  it('suspending one fitting never scrubs a trait the room came with', () => {
    // `hearth_repair` ADDS `cozy` and removes `drafty`; the main room has
    // neither by default, so a break must remove `cozy` and must NOT invent
    // `drafty` — the room never had it.
    let state = preparedTavern()
    expect(state.areas['main_room']!.traits).not.toContain('drafty')
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('main_room', 'hearth_repair'),
        },
      ]).state,
      'main_room',
      'hearth_repair',
    ).state
    expect(state.areas['main_room']!.traits).toContain('cozy')

    for (let day = 0; day < 90; day += 1) {
      state = runDay(state).state
      const live = record(state, 'main_room', 'hearth_repair')!
      if (live.status === 'damaged' || live.status === 'disabled') break
    }
    expect(state.areas['main_room']!.traits).not.toContain('cozy')
    expect(state.areas['main_room']!.traits).not.toContain('drafty')
  })

  it('an overdue fitting wears, breaks, and can be repaired back into service', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('privy', 'lime_bucket_station'),
        },
      ]).state,
      'privy',
      'lime_bucket_station',
    ).state
    expect(record(state, 'privy', 'lime_bucket_station')?.condition).toBe(100)

    // The lime bucket wants filling weekly. Leave it.
    for (let day = 0; day < 60; day += 1) {
      state = runDay(state).state
      const live = record(state, 'privy', 'lime_bucket_station')!
      if (live.status === 'damaged' || live.status === 'disabled') break
    }
    const broken = record(state, 'privy', 'lime_bucket_station')!
    expect(['damaged', 'disabled']).toContain(broken.status)
    expect(broken.condition!).toBeLessThan(25)
    expect(broken.damagedOnDay).toBeDefined()

    // Repair is discoverable while it is broken…
    const repairDef = actionRegistry.get('repair_area_upgrade')
    expect(
      repairDef.getValidTargets({ state } as never).map((t) => t.id),
    ).toContain(target('privy', 'lime_bucket_station'))

    // …and puts it back in service.
    state = withCoin(state, 100)
    state = runDay(state, [
      {
        actionId: 'repair_area_upgrade',
        targetId: target('privy', 'lime_bucket_station'),
      },
    ]).state
    const repaired = record(state, 'privy', 'lime_bucket_station')!
    expect(repaired.status).toBe('installed')
    expect(repaired.condition).toBe(85)
    expect(repaired.disabledReason).toBeUndefined()
    expect(getAreasModuleState(state).totals.upgradesRepaired).toBeGreaterThan(0)
  })

  it('servicing on time keeps a fitting at full condition', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('privy', 'lime_bucket_station'),
        },
      ]).state,
      'privy',
      'lime_bucket_station',
    ).state

    for (let week = 0; week < 4; week += 1) {
      for (let day = 0; day < 6; day += 1) state = runDay(state).state
      state = runDay(state, [
        {
          actionId: 'maintain_area_upgrade',
          targetId: target('privy', 'lime_bucket_station'),
        },
      ]).state
    }
    const live = record(state, 'privy', 'lime_bucket_station')!
    expect(live.status).toBe('installed')
    expect(live.condition!).toBeGreaterThanOrEqual(90)
    expect(getAreasModuleState(state).totals.upkeepsServiced).toBe(4)
  })
})

// --------------------------------------------------------------- 7. save/load

describe('Phase 209 §5.10 — save/load at every construction state', () => {
  const states: Array<[string, (base: TavernState) => TavernState]> = [
    [
      'available (nothing started)',
      (base) => base,
    ],
    [
      'in_progress',
      (base) =>
        runDay(base, [
          {
            actionId: 'start_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ]).state,
    ],
    [
      'paused',
      (base) => {
        const started = runDay(base, [
          {
            actionId: 'start_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ]).state
        return runDay(started, [
          {
            actionId: 'pause_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ]).state
      },
    ],
    [
      'cancelled',
      (base) => {
        const started = runDay(base, [
          {
            actionId: 'start_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ]).state
        return runDay(started, [
          {
            actionId: 'cancel_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ]).state
      },
    ],
    [
      'installed',
      (base) =>
        runUntilInstalled(
          runDay(base, [
            {
              actionId: 'start_area_upgrade',
              targetId: target('privy', 'lime_bucket_station'),
            },
          ]).state,
          'privy',
          'lime_bucket_station',
        ).state,
    ],
    [
      'damaged/disabled',
      (base) => {
        let state = runUntilInstalled(
          runDay(base, [
            {
              actionId: 'start_area_upgrade',
              targetId: target('privy', 'lime_bucket_station'),
            },
          ]).state,
          'privy',
          'lime_bucket_station',
        ).state
        for (let day = 0; day < 60; day += 1) {
          state = runDay(state).state
          const live = record(state, 'privy', 'lime_bucket_station')!
          if (live.status === 'damaged' || live.status === 'disabled') break
        }
        return state
      },
    ],
  ]

  for (const [label, build] of states) {
    it(`round-trips and continues identically from ${label}`, () => {
      const state = build(preparedTavern())

      // The state validates, which is what a save requires.
      const validation = safeValidateState(state, { modules: FULL_PIPELINE })
      expect(
        validation.success,
        validation.success ? '' : JSON.stringify(validation.errors[0]),
      ).toBe(true)

      // A JSON round-trip is exactly what the save envelope does.
      const reloaded = JSON.parse(JSON.stringify(state)) as TavernState
      expect(reloaded.areas).toEqual(state.areas)

      // And the next day is identical either side of the reload — save/load
      // must not change the deterministic outcome (§5's fail list).
      const direct = runDay(state)
      const afterReload = runDay(reloaded)
      expect(afterReload.state.areas).toEqual(direct.state.areas)
      expect(afterReload.state.coin).toBe(direct.state.coin)
      expect(getAreasModuleState(afterReload.state)).toEqual(
        getAreasModuleState(direct.state),
      )
    })
  }
})

// ------------------------------------------------------------ 8. determinism

describe('Phase 209 §2.3 — deterministic construction progress', () => {
  it('the same seed and inputs produce identical progress every run', () => {
    const build = () => {
      let state = preparedTavern()
      state = runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('privy', 'stone_drainage'),
        },
      ]).state
      for (let day = 0; day < 5; day += 1) state = runDay(state).state
      return state
    }
    const a = build()
    const b = build()
    expect(b.areas).toEqual(a.areas)
    expect(getAreasModuleState(b)).toEqual(getAreasModuleState(a))
  })

  it('full-day and segmented runs agree on construction state', () => {
    // The same day, run as one batch and as three resumed segments. §5.9.
    let state = preparedTavern()
    state = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: target('cellar', 'rat_proof_barrels'),
      },
    ]).state

    const batch = simulateDay(state, input(), FULL_PIPELINE)

    let segmented = state
    const dayStart = segmented
    for (const segment of DAY_SEGMENTS) {
      segmented = advanceDaySegment(segmented, input(), FULL_PIPELINE, segment, {
        dayBaseline: dayStart,
      }).state
    }

    expect(segmented.areas['cellar']!.upgrades).toEqual(
      batch.state.areas['cellar']!.upgrades,
    )
    expect(getAreasModuleState(segmented).construction).toEqual(
      getAreasModuleState(batch.state).construction,
    )
    expect(getAreasModuleState(segmented).schedule).toEqual(
      getAreasModuleState(batch.state).schedule,
    )
  })

  it('a staffed site really does build faster than an unattended one', () => {
    const start = (state: TavernState, crew?: Record<string, string>) =>
      runDay(
        state,
        [
          {
            actionId: 'start_area_upgrade',
            targetId: target('privy', 'stone_drainage'),
          },
        ],
        crew,
      ).state

    const alone = start(preparedTavern())
    const staffed = start(preparedTavern(), CREW)

    // Two days is enough to separate them without letting the staffed run
    // finish (7 labour needed, ~3/day staffed, 1/day alone).
    let a = alone
    let b = staffed
    for (let day = 0; day < 2; day += 1) {
      a = runDay(a).state
      b = runDay(b, undefined, CREW).state
    }
    const aProgress = record(a, 'privy', 'stone_drainage')!.progress!
    const bRecord = record(b, 'privy', 'stone_drainage')!
    // The staffed site either banked more labour or already finished; both are
    // "faster", and asserting only the first would be fragile if it completes.
    if (bRecord.status === 'installed') {
      expect(record(a, 'privy', 'stone_drainage')!.status).toBe('in_progress')
    } else {
      expect(bRecord.progress!).toBeGreaterThan(aProgress)
    }
  })
})

// ---------------------------------------------------- 9. no duplicate model

describe('Phase 209 §2.2 — one authoritative record, no duplicate representation', () => {
  it('no owner action creates a project record for something the catalogue builds', () => {
    // The five retired starters are gone from the registry entirely.
    for (const retired of [
      'start_private_booths',
      'start_hearth_repair',
      'start_music_corner',
      'start_rat_proof_storage',
      'start_larger_stew_pot',
      'fund_active_project',
      'cancel_project',
    ]) {
      expect(actionRegistry.has(retired), `${retired} is still registered`).toBe(false)
    }
  })

  it('building an upgrade writes the upgrade record and no parallel project', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('main_room', 'music_corner'),
        },
      ]).state,
      'main_room',
      'music_corner',
    ).state

    expect(record(state, 'main_room', 'music_corner')?.status).toBe('installed')
    // The trait it grants is on the area…
    expect(state.areas['main_room']!.traits).toContain('music_friendly')
    // …and nothing invented a second record to describe the same thing.
    expect(Object.keys(getOwnerActionsModuleState(state).projects)).toHaveLength(0)
  })

  it('every legacy project type now points at exactly one upgrade definition', () => {
    const seen = new Map<string, string>()
    for (const def of areaUpgradeRegistry.all()) {
      if (!def.legacyProjectType) continue
      expect(seen.has(def.legacyProjectType)).toBe(false)
      seen.set(def.legacyProjectType, def.id)
    }
    expect([...seen.keys()].sort()).toEqual([
      'larger_stew_pot',
      'music_corner',
      'private_booths',
      'rat_proof_storage',
      'repair_hearth',
    ])
  })

  it('a superseding upgrade retires the one it replaces', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('roof', 'patched_thatch'),
        },
      ]).state,
      'roof',
      'patched_thatch',
    ).state
    expect(record(state, 'roof', 'patched_thatch')?.status).toBe('installed')

    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('roof', 'reinforced_beams'),
        },
      ]).state,
      'roof',
      'reinforced_beams',
      40,
    ).state

    const beams = record(state, 'roof', 'reinforced_beams')!
    expect(beams.status).toBe('installed')
    expect(beams.replacedUpgradeId).toBe('patched_thatch')
    const thatch = record(state, 'roof', 'patched_thatch')!
    expect(thatch.status).toBe('cancelled')
    expect(thatch.disabledReason).toMatch(/Superseded/)
  })

  // Codex review, P2 — "Keep superseded upgrades from being rebuilt". A
  // superseded record lands in `cancelled`, and `cancelled` is restartable, so
  // the thatch the beams replaced could be built again — leaving both installed,
  // the patch's meter benefit re-applied and two upkeep clocks running for
  // mutually exclusive roof work.
  it('an upgrade that was superseded cannot be built again', () => {
    let state = preparedTavern()
    state = runUntilInstalled(
      runDay(state, [
        { actionId: 'start_area_upgrade', targetId: target('roof', 'patched_thatch') },
      ]).state,
      'roof',
      'patched_thatch',
    ).state
    state = runUntilInstalled(
      runDay(state, [
        {
          actionId: 'start_area_upgrade',
          targetId: target('roof', 'reinforced_beams'),
        },
      ]).state,
      'roof',
      'reinforced_beams',
      40,
    ).state
    expect(record(state, 'roof', 'patched_thatch')!.status).toBe('cancelled')

    const verdict = checkUpgradeEligibility(state, 'roof', 'patched_thatch')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.code).toBe('superseded')
      expect(verdict.reason).toMatch(/Reinforced Beams/)
    }
    // It is not offered, and a queued attempt is rejected rather than applied.
    const offered = actionRegistry
      .get('start_area_upgrade')
      .getValidTargets({ state } as never)
      .map((t) => t.id)
    expect(offered).not.toContain(target('roof', 'patched_thatch'))

    const attempt = runDay(state, [
      { actionId: 'start_area_upgrade', targetId: target('roof', 'patched_thatch') },
    ])
    expect(getOwnerActionsModuleState(attempt.state).rejected[0]?.code).toBe(
      'superseded',
    )
    expect(record(attempt.state, 'roof', 'patched_thatch')!.status).toBe('cancelled')
  })

  it('the catalogue itself contains no duplicate area/upgrade pairing', () => {
    for (const area of Object.values(createInitialTavernState().areas)) {
      const ids = listCatalogueForArea(area).map((def) => def.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
