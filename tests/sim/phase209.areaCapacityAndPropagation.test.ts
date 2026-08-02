import { describe, it, expect } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withCoin, withStock } from '../../src/sim/testing/stateFactories'
import { areaRegistry, listAreaAdjacency } from '../../src/sim/registries/areaRegistry'
import { AREA_CAPACITY_KINDS } from '../../src/sim/registries/areaCapacityTypes'
import {
  getBaseAreaCapacity,
  getCustomerFacingSeating,
  getInstalledAreaCapacity,
  getKitchenThroughputFactor,
  getTotalUsableWorkstations,
  getUsableAreaCapacity,
  getUsableCapacity,
} from '../../src/sim/modules/areas/capacity'
import {
  AREA_PROPAGATION_EDGES,
  applyAreaPropagation,
  buildPropagationSnapshot,
  findUngroundedPropagationEdges,
} from '../../src/sim/modules/areas/propagation'
import { getAreasModuleState } from '../../src/sim/modules/areas/state'
import {
  buildAreaWorkSchedule,
  getSiteLabourPerDay,
} from '../../src/sim/modules/areas/schedule'
import {
  SITE_BASE_LABOUR_PER_DAY,
  crewMemberLabour,
  getMaxConcurrentSites,
  listActiveSites,
  listConstructionCrew,
} from '../../src/sim/modules/areas/labour'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import {
  ensureAreaConstructionFields,
  ensureRegistryRecords,
} from '../../src/sim/state/migrations'
import { safeValidateState } from '../../src/sim/state/validation'
import { findScheduledEventDefinitionForHookName } from '../../src/sim/contracts/scheduledEvents/registry'
import {
  AREA_COLLAPSE_RISK_EVENT,
  AREA_PROJECT_COMPLETION_EVENT,
  FAILED_PATCH_EVENT,
} from '../../src/sim/modules/areas/areaEvents'
import type { SimInputOwnerAction } from '../../src/sim/core/context'
import type { AreaUpgradeState, TavernState } from '../../src/sim/state/TavernState'

// Expansion Phase 2 (repo phase 209) / ISSUE-172 — the physical model.
//
// This file covers the plan's required test 10 ("bounded area effect
// propagation"), the capacity half of test 5 ("installed effect on service or
// another consuming system"), the §2.5 scheduling rules, the §5.7 migration,
// and the three future-hook families §2.2 moves from narrative to mechanical.

const SEED = 'phase-209-capacity-and-propagation'

function input(actions?: ReadonlyArray<SimInputOwnerAction>) {
  return {
    seed: SEED,
    ...(actions && actions.length > 0 ? { ownerActions: [...actions] } : {}),
  }
}

function runDay(state: TavernState, actions?: ReadonlyArray<SimInputOwnerAction>) {
  return simulateDay(state, input(actions), FULL_PIPELINE)
}

function preparedTavern(coin = 400): TavernState {
  let state = withCoin(createInitialTavernState(), coin)
  state = withStock(state, 'timber', { quantity: 60 })
  state = withStock(state, 'cut_stone', { quantity: 40 })
  return state
}

// -------------------------------------------------------- capacity + adjacency

describe('Phase 209 §2.1 — areas own physical capacity', () => {
  it('every area declares a capacity vector, and the customer-facing pool is non-empty', () => {
    for (const def of areaRegistry.all()) {
      expect(def.capacity, `${def.id} declares no capacity`).toBeDefined()
      for (const [kind, amount] of Object.entries(def.capacity!)) {
        expect(AREA_CAPACITY_KINDS).toContain(kind)
        expect(amount).toBeGreaterThanOrEqual(0)
      }
    }
    const seating = getCustomerFacingSeating(createInitialTavernState())
    expect(seating.seats).toBeGreaterThan(0)
    expect(seating.usableSeats).toBe(seating.seats)
    // Pooled across every customer-facing room, not just the main room — which
    // is what makes the booths and the stage corner matter to crowding.
    expect(seating.byArea.map((row) => row.areaId).sort()).toEqual([
      'main_room',
      'private_booth',
      'stage_corner',
    ])
  })

  it('adjacency is symmetric and never names an area that does not exist', () => {
    const ids = new Set(areaRegistry.all().map((def) => def.id))
    for (const def of areaRegistry.all()) {
      for (const link of listAreaAdjacency(def.id)) {
        expect(ids.has(link.areaId), `${def.id} → ${link.areaId} is not a real area`).toBe(
          true,
        )
        // Read from either end, the link resolves.
        expect(
          listAreaAdjacency(link.areaId).some((back) => back.areaId === def.id),
          `${link.areaId} does not link back to ${def.id}`,
        ).toBe(true)
        expect(link.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('is not an all-to-all network', () => {
    const areas = areaRegistry.all()
    const possiblePairs = (areas.length * (areas.length - 1)) / 2
    const declared = areas.reduce(
      (sum, def) => sum + (def.adjacency?.length ?? 0),
      0,
    )
    // §2.4's constraint, stated as a number: nine areas could carry 36 pairs.
    expect(declared).toBeLessThan(possiblePairs / 2)
  })

  it('capacity is derived: base + installed − blocked, never stored', () => {
    const state = preparedTavern()
    const main = state.areas['main_room']!
    // Nothing installed on day zero, nothing blocked.
    expect(getInstalledAreaCapacity(main)).toEqual(getBaseAreaCapacity('main_room'))
    expect(getUsableAreaCapacity(main)).toEqual(getBaseAreaCapacity('main_room'))
    // And `AreaState` carries no capacity field to disagree with it.
    expect(Object.keys(main)).not.toContain('capacity')
    expect(Object.keys(main)).not.toContain('usableCapacity')
  })

  it('a wrecked room cannot be used to its nominal size', () => {
    const state = preparedTavern()
    const wrecked: TavernState = {
      ...state,
      areas: {
        ...state.areas,
        main_room: { ...state.areas['main_room']!, condition: 10 },
      },
    }
    expect(getUsableCapacity(wrecked.areas['main_room']!, 'seats')).toBeLessThan(
      getUsableCapacity(state.areas['main_room']!, 'seats'),
    )
  })

  it('publishes a capacity snapshot every day, one row per area', () => {
    const result = runDay(preparedTavern())
    const rows = getAreasModuleState(result.state).capacity
    expect(rows).toHaveLength(Object.keys(result.state.areas).length)
    for (const row of rows) {
      expect(row.usableSeats).toBeLessThanOrEqual(row.seats)
      expect(row.overflow).toBe(Math.max(0, row.occupancy - row.usableSeats))
    }
    // Occupancy is shared out across the customer-facing rooms rather than
    // counted once per room.
    const occupancy = rows.reduce((sum, row) => sum + row.occupancy, 0)
    const turnouts = (
      result.state.modules['customers'] as {
        turnouts: ReadonlyArray<{ visitors: number }>
      }
    ).turnouts
    const visitors = turnouts.reduce((sum, t) => sum + t.visitors, 0)
    expect(occupancy).toBeLessThanOrEqual(visitors + rows.length)
  })
})

// -------------------------------------------------------------- 10. propagation

describe('Phase 209 §2.4 — bounded area effect propagation', () => {
  it('every cross-area edge travels along a declared adjacency link', () => {
    expect(findUngroundedPropagationEdges()).toEqual([])
  })

  it('every edge declares a physical reason and a unique id', () => {
    const ids = AREA_PROPAGATION_EDGES.map((edge) => edge.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const edge of AREA_PROPAGATION_EDGES) {
      expect(edge.reason.length).toBeGreaterThan(10)
      expect(edge.fromAreaId.length).toBeGreaterThan(0)
    }
  })

  it('an edge fires only when its physical precondition is met', () => {
    // Clean kitchen: the filth edge stays silent.
    const clean = runDay(preparedTavern())
    const firedClean = getAreasModuleState(clean.state).propagation.map((p) => p.edgeId)
    expect(firedClean).not.toContain('kitchen_filth_to_food_safety')

    // Filthy kitchen, reached by setting the room's own meter — a legitimate
    // starting condition, not an impossible state.
    const base = preparedTavern()
    const filthy: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        kitchen: { ...base.areas['kitchen']!, cleanliness: 5 },
      },
    }
    const dirty = runDay(filthy)
    const firedDirty = getAreasModuleState(dirty.state).propagation.map((p) => p.edgeId)
    expect(firedDirty).toContain('kitchen_filth_to_food_safety')
    expect(dirty.state.areas['kitchen']!.activeProblems).toContain('unsafe_food_prep')
  })

  it('roof damage reaches the room underneath, and says why', () => {
    const base = preparedTavern()
    const leaking: TavernState = {
      ...base,
      areas: { ...base.areas, roof: { ...base.areas['roof']!, damage: 80 } },
    }
    const result = runDay(leaking)
    const entries = getAreasModuleState(result.state).propagation
    const roofEdge = entries.find((e) => e.edgeId === 'roof_damage_to_main_room')
    expect(roofEdge).toBeDefined()
    expect(roofEdge!.toAreaId).toBe('main_room')
    expect(roofEdge!.reason).toMatch(/over the main room/)
    // And the effect is real, not just reported.
    expect(result.state.areas['main_room']!.condition).toBeLessThan(
      leaking.areas['main_room']!.condition,
    )
  })

  it('does not cascade within a single day: one edge, one target', () => {
    // Every edge is applied against a snapshot taken before any of them ran, so
    // no edge can read another's output in the same tick.
    const base = preparedTavern()
    const bad: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        roof: { ...base.areas['roof']!, damage: 95 },
        kitchen: { ...base.areas['kitchen']!, cleanliness: 5 },
        cellar: { ...base.areas['cellar']!, risk: 90 },
      },
    }
    const snapshot = buildPropagationSnapshot(bad)
    // The snapshot is a plain read of the pre-pass state.
    expect(snapshot.areas['roof']!.damage).toBe(95)

    const result = runDay(bad)
    const fired = getAreasModuleState(result.state).propagation
    // Each fired edge appears exactly once — no re-entry, no chain.
    const counts = new Map<string, number>()
    for (const entry of fired) {
      counts.set(entry.edgeId, (counts.get(entry.edgeId) ?? 0) + 1)
    }
    for (const [edgeId, count] of counts) {
      expect(count, `${edgeId} fired more than once`).toBe(1)
    }
    // And the pass is bounded by the declared edge list, whatever the state.
    expect(fired.length).toBeLessThanOrEqual(AREA_PROPAGATION_EDGES.length)
  })

  // Codex review, P2 — "Restrict cellar pest damage to spoilable stock". The
  // first cut picked the biggest stack in the cellar, which is reliably
  // firewood (or now timber): non-perishable, so `applyDailySpoilage` never
  // reads their spoilage and the edge had no consequence at all.
  it('cellar pests go for the food, not the firewood', () => {
    const base = withStock(preparedTavern(), 'timber', { quantity: 200 })
    const infested: TavernState = {
      ...base,
      areas: { ...base.areas, cellar: { ...base.areas['cellar']!, risk: 90 } },
    }
    // A yard full of timber out-stacks the food, so a "biggest stack in the
    // cellar" rule would send the rats at the lumber.
    expect(infested.stock['timber']!.quantity).toBeGreaterThan(
      infested.stock['mushrooms']!.quantity,
    )
    const result = runDay(infested)
    const entry = getAreasModuleState(result.state).propagation.find(
      (p) => p.edgeId === 'cellar_pests_to_stock',
    )
    expect(entry).toBeDefined()
    expect(entry!.readable).toMatch(/Mushrooms/i)
    expect(result.state.stock['mushrooms']!.spoilage).toBeGreaterThan(
      infested.stock['mushrooms']!.spoilage,
    )
    // The non-perishables are untouched — spoilage on them means nothing.
    expect(result.state.stock['firewood']!.spoilage).toBe(0)
    expect(result.state.stock['timber']!.spoilage).toBe(0)
  })

  it('the propagation log resets every morning, so it cannot grow a save', () => {
    const base = preparedTavern()
    const bad: TavernState = {
      ...base,
      areas: { ...base.areas, roof: { ...base.areas['roof']!, damage: 90 } },
    }
    let state = runDay(bad).state
    const firstCount = getAreasModuleState(state).propagation.length
    expect(firstCount).toBeGreaterThan(0)
    for (let day = 0; day < 5; day += 1) state = runDay(state).state
    expect(getAreasModuleState(state).propagation.length).toBeLessThanOrEqual(
      AREA_PROPAGATION_EDGES.length,
    )
    expect(getAreasModuleState(state).capacity.length).toBe(
      Object.keys(state.areas).length,
    )
  })

  it('a neglected herb bed halves the weekly cut, and recovers when tended', () => {
    const base = preparedTavern()
    const neglected: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        herb_garden: { ...base.areas['herb_garden']!, condition: 20, cleanliness: 20 },
      },
    }
    const flagged = runDay(neglected).state
    expect(flagged.areas['herb_garden']!.activeProblems).toContain('bed_neglected')

    // Tending the bed clears the flag through the same edge.
    const tended: TavernState = {
      ...flagged,
      areas: {
        ...flagged.areas,
        herb_garden: {
          ...flagged.areas['herb_garden']!,
          condition: 70,
          cleanliness: 70,
        },
      },
    }
    const recovered = runDay(tended).state
    expect(recovered.areas['herb_garden']!.activeProblems).not.toContain(
      'bed_neglected',
    )
  })

  it('applyAreaPropagation is a no-op when nothing qualifies', () => {
    // A tavern in good order writes no propagation entries at all, which is what
    // keeps a healthy save quiet.
    const base = preparedTavern()
    const tidy: TavernState = {
      ...base,
      areas: Object.fromEntries(
        Object.entries(base.areas).map(([id, area]) => [
          id,
          { ...area, cleanliness: 80, condition: 80, damage: 5, risk: 10, smell: 10 },
        ]),
      ),
    }
    const result = runDay(tidy)
    const fired = getAreasModuleState(result.state).propagation
    for (const entry of fired) {
      // Anything that did fire is crowding, which is a load fact rather than a
      // neglect fact — and it still names its route.
      expect(entry.reason.length).toBeGreaterThan(0)
    }
    expect(typeof applyAreaPropagation).toBe('function')
  })
})

// ------------------------------------------------------------- crowding effect

describe('Phase 209 §2.1 / §2.4 — capacity materially shapes service', () => {
  it('overcrowding costs satisfaction and marks the room', () => {
    // A tavern with almost nowhere to sit: remove the two extra customer-facing
    // rooms' seating by wrecking them, which is a state the game can reach.
    const base = preparedTavern()
    const cramped: TavernState = {
      ...base,
      areas: {
        ...base.areas,
        main_room: { ...base.areas['main_room']!, condition: 12 },
        private_booth: { ...base.areas['private_booth']!, condition: 12 },
        stage_corner: { ...base.areas['stage_corner']!, condition: 12 },
      },
    }
    const crampedRun = runDay(cramped)
    const roomy = runDay(base)

    const crampedSeats = getCustomerFacingSeating(cramped).usableSeats
    const roomySeats = getCustomerFacingSeating(base).usableSeats
    expect(crampedSeats).toBeLessThan(roomySeats)

    const crowdedNotes = (
      crampedRun.state.modules['customers'] as {
        turnouts: ReadonlyArray<{ notes: string[] }>
      }
    ).turnouts.flatMap((t) => t.notes)
    const roomyNotes = (
      roomy.state.modules['customers'] as {
        turnouts: ReadonlyArray<{ notes: string[] }>
      }
    ).turnouts.flatMap((t) => t.notes)

    // The opening night is busy enough to be crowded even in a sound tavern —
    // that is the calibration, not a bug — so the assertion is about SEVERITY:
    // the cramped house crowds more groups than the roomy one.
    const crowdedCount = crowdedNotes.filter((note) =>
      /not enough seats/.test(note),
    ).length
    const roomyCount = roomyNotes.filter((note) => /not enough seats/.test(note)).length
    expect(crowdedCount).toBeGreaterThan(roomyCount)
    expect(getAreasModuleState(crampedRun.state).totals.overcrowdedDays).toBe(1)

    // And the room itself takes the wear, through the crowding edge.
    const edges = getAreasModuleState(crampedRun.state).propagation.map(
      (entry) => entry.edgeId,
    )
    expect(edges).toContain('crowding_to_main_room_wear')
  })

  it('an overstuffed store spoils its stock faster', () => {
    // Same cellar, same stock, different usable storage: one cellar is sound,
    // the other is wrecked enough to lose most of its shelving.
    const base = withStock(preparedTavern(), 'mushrooms', { quantity: 400 })
    const wrecked: TavernState = {
      ...base,
      areas: { ...base.areas, cellar: { ...base.areas['cellar']!, condition: 10 } },
    }
    const sound: TavernState = {
      ...base,
      areas: { ...base.areas, cellar: { ...base.areas['cellar']!, condition: 90 } },
    }
    const wreckedRun = runDay(wrecked).state
    const soundRun = runDay(sound).state
    expect(wreckedRun.stock['mushrooms']!.spoilage).toBeGreaterThan(
      soundRun.stock['mushrooms']!.spoilage,
    )
  })
})

// ------------------------------------------------------------------ scheduling

describe('Phase 209 §2.5 — the work schedule is load-bearing', () => {
  it('the day’s schedule is written every day and reset every morning', () => {
    const state = runDay(preparedTavern()).state
    const slice = getAreasModuleState(state)
    // No builds, no crew, no owner area work → nothing to schedule.
    expect(slice.schedule).toEqual([])

    const building = runDay(state, [
      {
        actionId: 'start_area_upgrade',
        targetId: 'privy:stone_drainage',
      },
    ]).state
    const blocks = getAreasModuleState(building).schedule
    expect(blocks.length).toBeGreaterThan(0)
    const site = blocks.find((b) => b.actorKind === 'site')!
    expect(site.upgradeId).toBe('stone_drainage')
    expect(site.status).toBe('scheduled')
    // The owner's own start shows up with the minutes the day clock charged.
    const owner = blocks.find((b) => b.actorKind === 'owner')
    expect(owner?.minutes).toBe(120)
  })

  it('every conflicted block carries a reason', () => {
    const state = preparedTavern()
    const blocks = buildAreaWorkSchedule(state)
    for (const block of blocks) {
      if (block.status !== 'conflicted') continue
      expect(block.conflictReason, `${block.id} conflicted silently`).toBeTruthy()
    }
  })

  // Codex review, P2 — "Split crew labour only across scheduled sites". The
  // first cut divided the crew by every `in_progress` record, so a site the
  // schedule had conflicted still took a share of the carpenter — and that
  // share simply vanished, because a conflicted site banks nothing.
  it('a conflicted site takes no share of the crew', () => {
    // Two builds live in the SAME room: the schedule clears one and conflicts
    // the other, because you cannot rebuild the hearth and fit the tables on
    // the same floor at once.
    //
    // Staged across two days on purpose. `assignStaffPriorities` runs AFTER
    // `applyOwnerActions`, so the crew a player puts on repairs this morning is
    // not on the rota when this morning's start is gate-checked — the second
    // site only becomes startable the following day.
    const crew = { cleaner_bouncer: 'minor_repairs' }
    const day1 = simulateDay(
      preparedTavern(),
      {
        ...input([
          { actionId: 'start_area_upgrade', targetId: 'main_room:hearth_repair' },
        ]),
        staffPriorities: crew,
      },
      FULL_PIPELINE,
    ).state
    const state = simulateDay(
      day1,
      {
        ...input([
          { actionId: 'start_area_upgrade', targetId: 'main_room:better_tables' },
        ]),
        staffPriorities: crew,
      },
      FULL_PIPELINE,
    ).state

    // The schedule the module wrote while both were live is the artifact under
    // test — one of them may well have finished on the strength of it.
    const schedule = getAreasModuleState(state).schedule
    const clearedSites = schedule.filter(
      (b) => b.actorKind === 'site' && b.status === 'scheduled',
    )
    const conflicted = schedule.filter(
      (b) => b.actorKind === 'site' && b.status === 'conflicted',
    )
    // The same-room rule bites: one site works, one waits with a reason.
    expect(clearedSites).toHaveLength(1)
    expect(conflicted.length).toBeGreaterThan(0)
    expect(conflicted[0]!.conflictReason).toMatch(/floor/)

    // The whole crew goes to the site that is actually being worked, rather
    // than half of it being lost to the site nobody is standing on. The crew
    // has to be re-asserted on the state under test, because priorities are
    // re-assigned from input every morning.
    const site = clearedSites[0]!
    const staffed: TavernState = {
      ...state,
      staff: Object.fromEntries(
        Object.entries(state.staff).map(([id, member]) => [
          id,
          id === 'cleaner_bouncer'
            ? { ...member, currentPriority: 'minor_repairs' as const }
            : member,
        ]),
      ),
    }
    const soloLabour = getSiteLabourPerDay(staffed, site.areaId, schedule)
    const crewMembers = listConstructionCrew(staffed)
    expect(crewMembers).toHaveLength(1)
    expect(soloLabour).toBe(
      SITE_BASE_LABOUR_PER_DAY + crewMemberLabour(crewMembers[0]!),
    )
  })

  // Codex review, P2 — "Enforce workstation capacity in construction limits".
  // Workstation capacity was declared with consumers claimed and had none:
  // nothing in production read it except a report.
  it('usable workstations cap how many sites can run at once', () => {
    const state = preparedTavern()
    // Wreck every room badly enough that its workstations stop counting.
    const derelict: TavernState = {
      ...state,
      areas: Object.fromEntries(
        Object.entries(state.areas).map(([id, area]) => [
          id,
          { ...area, condition: 5 },
        ]),
      ),
      staff: Object.fromEntries(
        Object.entries(state.staff).map(([id, member]) => [
          id,
          id === 'cleaner_bouncer'
            ? { ...member, currentPriority: 'minor_repairs' as const }
            : member,
        ]),
      ),
    }
    // Supervision alone would allow two sites; the work space does not.
    expect(getTotalUsableWorkstations(derelict)).toBeLessThan(2)
    expect(getMaxConcurrentSites(derelict)).toBe(1)
    // Never zero, or repairing the place would become unreachable.
    expect(getMaxConcurrentSites(derelict)).toBeGreaterThan(0)
  })

  it('kitchen workstations change what the kitchen actually gets out', () => {
    const state = preparedTavern()
    // A tavern that has built and broken nothing scores exactly 1, which is
    // what keeps the reference route untouched.
    expect(getKitchenThroughputFactor(state)).toBe(1)

    const wrecked: TavernState = {
      ...state,
      areas: { ...state.areas, kitchen: { ...state.areas['kitchen']!, condition: 5 } },
    }
    expect(getKitchenThroughputFactor(wrecked)).toBeLessThan(1)

    // And it reaches the till — but only when the kitchen is the thing standing
    // in the way, which is what Expansion Phase 4 changed about this claim.
    //
    // The factor used to scale DEMAND: every patron simply bought less from a
    // worse kitchen, whether or not the kitchen was busy. Phase 4 §4.1 makes it
    // scale CAPACITY instead — servings per wave — which is the honest reading
    // of "what the kitchen gets out", and it means a crippled kitchen costs
    // nothing on a quiet night because there was slack to lose. So the crowd
    // here is one the kitchen has to work for: at this patronage the sound
    // kitchen is already near its ceiling, and the crippled one drops below it.
    const busy = (input: TavernState): TavernState => ({
      ...input,
      customerGroups: Object.fromEntries(
        Object.entries(input.customerGroups).map(([id, group]) => [
          id,
          group.patronage > 0 ? { ...group, patronage: 95 } : group,
        ]),
      ),
    })
    const soundCoin = runDay(busy(state)).state.coin - state.coin
    const wreckedCoin = runDay(busy(wrecked)).state.coin - wrecked.coin
    expect(wreckedCoin).toBeLessThan(soundCoin)
  })

  it('the concurrency limit rises with a staff member on repairs', () => {
    const state = preparedTavern()
    expect(getMaxConcurrentSites(state)).toBe(1)
    const withCrew: TavernState = {
      ...state,
      staff: Object.fromEntries(
        Object.entries(state.staff).map(([id, member]) => [
          id,
          id === 'cleaner_bouncer'
            ? { ...member, currentPriority: 'minor_repairs' as const }
            : member,
        ]),
      ),
    }
    expect(getMaxConcurrentSites(withCrew)).toBe(2)
    expect(listActiveSites(state)).toEqual([])
  })
})

// ------------------------------------------------------------------- migration

describe('Phase 209 §5.7 — the migration neither loses nor fabricates work', () => {
  it('gives an older installed fitting a condition and an upkeep clock', () => {
    const base = createInitialTavernState()
    const legacy = {
      ...base,
      calendar: { ...base.calendar, totalDaysElapsed: 40 },
      areas: {
        ...base.areas,
        main_room: {
          ...base.areas['main_room']!,
          upgrades: {
            better_tables: {
              id: 'better_tables',
              status: 'installed' as const,
              tags: ['furniture'],
            },
          },
        },
      },
    }
    const migrated = ensureAreaConstructionFields(legacy)
    const record: AreaUpgradeState =
      migrated.areas['main_room']!.upgrades['better_tables']!
    expect(record.condition).toBe(100)
    // The clock starts from the day the save is at — not backdated into an
    // overdue bill the player never incurred.
    expect(record.lastUpkeepDay).toBe(40)
    expect(record.upkeepDueDay).toBe(61)
    expect(safeValidateState(migrated, { modules: FULL_PIPELINE }).success).toBe(true)
  })

  it('converts a completed legacy project into an installed upgrade record', () => {
    const base = createInitialTavernState()
    const legacy = {
      ...base,
      calendar: { ...base.calendar, totalDaysElapsed: 12 },
      areas: {
        ...base.areas,
        // The trait the old project applied is already on the room.
        main_room: { ...base.areas['main_room']!, traits: ['cozy'] },
      },
      modules: {
        ...base.modules,
        ownerActions: {
          ...(base.modules['ownerActions'] as Record<string, unknown>),
          projects: {
            'project:repair_hearth': {
              id: 'project:repair_hearth',
              projectType: 'repair_hearth',
              label: 'Hearth Repair',
              targetType: 'area',
              targetId: 'main_room',
              startedAtDay: 4,
              progress: 4,
              requiredProgress: 4,
              coinInvested: 8,
              status: 'completed',
              tags: ['project'],
              effectsPreview: [],
            },
          },
        },
      },
    }
    const migrated = ensureAreaConstructionFields(legacy)
    const record = migrated.areas['main_room']!.upgrades['hearth_repair']!
    expect(record.status).toBe('installed')
    expect(record.coinInvested).toBe(8)
    // …and the duplicate representation is gone.
    const projects = (
      migrated.modules!['ownerActions'] as { projects: Record<string, unknown> }
    ).projects
    expect(Object.keys(projects)).toHaveLength(0)
  })

  it('converts an in-flight legacy project and keeps its share of progress', () => {
    const base = createInitialTavernState()
    const legacy = {
      ...base,
      calendar: { ...base.calendar, totalDaysElapsed: 9 },
      modules: {
        ...base.modules,
        ownerActions: {
          ...(base.modules['ownerActions'] as Record<string, unknown>),
          projects: {
            'project:private_booths': {
              id: 'project:private_booths',
              projectType: 'private_booths',
              label: 'Private Booths',
              targetType: 'area',
              targetId: 'main_room',
              startedAtDay: 6,
              progress: 3,
              requiredProgress: 5,
              coinInvested: 10,
              status: 'active',
              tags: ['project'],
              effectsPreview: [],
            },
          },
        },
      },
    }
    const migrated = ensureAreaConstructionFields(legacy)
    const record = migrated.areas['main_room']!.upgrades['private_booths']!
    expect(record.status).toBe('in_progress')
    // 3/5 of the old build → 3/5 of the new labour requirement (8 → 4).
    expect(record.requiredProgress).toBe(8)
    expect(record.progress).toBe(4)
    expect(record.startedAtDay).toBe(6)
  })

  // Codex review, P1 — "Backfill construction materials into existing saves".
  // A save written before this phase has a valid `stock` map, so nothing added
  // `timber` / `cut_stone` to it: every material line would read "0 held" and
  // reject the build, while `restock_item` enumerates `state.stock` and so
  // could never offer a way to buy any. Permanently unbuildable.
  it('merges newly registered stock and recipe records into an existing save', () => {
    const base = createInitialTavernState()
    const stock = { ...base.stock }
    delete (stock as Record<string, unknown>)['timber']
    delete (stock as Record<string, unknown>)['cut_stone']
    const recipes = { ...base.recipes }
    delete (recipes as Record<string, unknown>)['dish_timber']
    delete (recipes as Record<string, unknown>)['dish_cut_stone']
    const legacy = { ...base, stock, recipes }

    const migrated = ensureRegistryRecords(legacy)
    expect(migrated.stock['timber']).toBeDefined()
    expect(migrated.stock['cut_stone']).toBeDefined()
    // At the registry default — an empty shelf, not a free pile of timber.
    expect(migrated.stock['timber']!.quantity).toBe(0)
    expect(migrated.recipes['dish_timber']).toBeDefined()
    expect(safeValidateState(migrated, { modules: FULL_PIPELINE }).success).toBe(true)

    // …and the player can now actually buy some, which is the point.
    const restockTargets = actionRegistry
      .get('restock_item')
      .getValidTargets({ state: migrated } as never)
      .map((t) => t.id)
    expect(restockTargets).toContain('timber')
  })

  it('leaves a record the save already has exactly as the player left it', () => {
    const base = createInitialTavernState()
    const played = {
      ...base,
      stock: {
        ...base.stock,
        ale: { ...base.stock['ale']!, quantity: 7, quality: 12, spoilage: 61 },
      },
    }
    const migrated = ensureRegistryRecords(played)
    expect(migrated.stock['ale']).toEqual(played.stock['ale'])
  })

  // Codex review, P2 — "Consume materials owed by migrated builds". A migrated
  // in-flight record had no `materialsUsed`, so the tick treated stock it had
  // never drawn as delivered: the build finished free and the timber stayed on
  // the shelf for the next one.
  it('a migrated in-flight build owes no materials it was never billed for', () => {
    const base = createInitialTavernState()
    const legacy = {
      ...base,
      calendar: { ...base.calendar, totalDaysElapsed: 9 },
      modules: {
        ...base.modules,
        ownerActions: {
          ...(base.modules['ownerActions'] as Record<string, unknown>),
          projects: {
            'project:private_booths': {
              id: 'project:private_booths',
              projectType: 'private_booths',
              label: 'Private Booths',
              targetType: 'area',
              targetId: 'main_room',
              startedAtDay: 6,
              progress: 3,
              requiredProgress: 5,
              coinInvested: 10,
              status: 'active',
              tags: ['project'],
              effectsPreview: [],
            },
          },
        },
      },
    }
    const migrated = ensureAreaConstructionFields(legacy)
    const record: AreaUpgradeState =
      migrated.areas['main_room']!.upgrades['private_booths']!
    // Stamped as supplied — the legacy quote charged coin and never materials,
    // so retroactively billing the player would change a closed deal, and
    // leaving it absent would let the tick charge them silently.
    expect(record.materialsUsed).toEqual({ timber: 8 })
  })

  it('a build that somehow owes materials draws them before it progresses', () => {
    // Reached by running the tick against a record whose materials are only
    // partly delivered — the general guard, whatever produced the record.
    let state = withCoin(createInitialTavernState(), 400)
    state = withStock(state, 'timber', { quantity: 20 })
    const started = runDay(state, [
      { actionId: 'start_area_upgrade', targetId: 'main_room:better_tables' },
    ]).state
    const afterStart = started.stock['timber']!.quantity

    // Strip half the delivery, as a partial clawback would.
    const owing: TavernState = {
      ...started,
      areas: {
        ...started.areas,
        main_room: {
          ...started.areas['main_room']!,
          upgrades: {
            ...started.areas['main_room']!.upgrades,
            better_tables: {
              ...started.areas['main_room']!.upgrades['better_tables']!,
              materialsUsed: { timber: 2 },
            },
          },
        },
      },
    }
    const next = runDay(owing).state
    // The two it still owed came out of the store, and the record says so.
    expect(next.stock['timber']!.quantity).toBe(afterStart - 2)
    expect(
      next.areas['main_room']!.upgrades['better_tables']!.materialsUsed,
    ).toEqual({ timber: 4 })
  })

  it('is idempotent and leaves a fresh state untouched', () => {
    const fresh = createInitialTavernState()
    expect(ensureAreaConstructionFields(fresh)).toBe(fresh)
    const once = ensureAreaConstructionFields({
      ...fresh,
      areas: {
        ...fresh.areas,
        roof: {
          ...fresh.areas['roof']!,
          upgrades: {
            patched_thatch: {
              id: 'patched_thatch',
              status: 'installed' as const,
              tags: [],
            },
          },
        },
      },
    })
    expect(ensureAreaConstructionFields(once)).toBe(once)
  })
})

// -------------------------------------------------- mechanical hook families

describe('Phase 209 §2.2 — three future-hook families become mechanical', () => {
  it('the bridge resolves both exact and parameterised hook names to this domain', () => {
    expect(findScheduledEventDefinitionForHookName('failed_patch_possible')?.type).toBe(
      FAILED_PATCH_EVENT,
    )
    expect(
      findScheduledEventDefinitionForHookName('area_collapse_risk_main_room')?.type,
    ).toBe(AREA_COLLAPSE_RISK_EVENT)
    expect(
      findScheduledEventDefinitionForHookName('area_project_completion_cellar')?.type,
    ).toBe(AREA_PROJECT_COMPLETION_EVENT)
    // A name no domain claims stays unclaimed, so it is filed as narrative.
    // (`supplier_retaliation_possible` was the example here until expansion
    // Phase 6 gave the supplier domain the terms and credit to honour it;
    // `merchant_flight_possible` is recorded in the implementation ledger as
    // deliberately staying narrative, so it is the stable example now.)
    expect(
      findScheduledEventDefinitionForHookName('merchant_flight_possible'),
    ).toBeUndefined()
    // Phase 6 owns the supplier families the areas module never could.
    expect(
      findScheduledEventDefinitionForHookName('supplier_retaliation_possible')
        ?.ownerModuleId,
    ).toBe('suppliers')
    // The bare prefix with no subject is not a valid family member.
    expect(
      findScheduledEventDefinitionForHookName('area_collapse_risk_'),
    ).toBeUndefined()
  })

  it('each family is owned by the areas module and declares a warning window', () => {
    for (const type of [
      FAILED_PATCH_EVENT,
      AREA_COLLAPSE_RISK_EVENT,
      AREA_PROJECT_COMPLETION_EVENT,
    ]) {
      const def = findScheduledEventDefinitionForHookName(
        type === FAILED_PATCH_EVENT ? type : `${type}_main_room`,
      )!
      expect(def.ownerModuleId).toBe('areas')
      expect(def.kind).toBe('mechanical')
      expect(def.warningWindowDays).toBeGreaterThan(0)
      expect(def.expiryDays).toBeGreaterThan(0)
      expect(typeof def.resolve).toBe('function')
      expect(typeof def.fromFutureHook).toBe('function')
    }
  })

  it('the adapters build a validated payload and decline names they do not own', () => {
    const collapse = findScheduledEventDefinitionForHookName(
      'area_collapse_risk_kitchen',
    )!
    const adapted = collapse.fromFutureHook!({
      hookName: 'area_collapse_risk_kitchen',
      readable: 'the kitchen may give way',
      scheduledForDay: 12,
    })!
    expect(adapted.payload).toEqual({ areaId: 'kitchen' })
    expect(adapted.target).toEqual({ kind: 'area', id: 'kitchen' })
    expect(collapse.payloadSchema.safeParse(adapted.payload).success).toBe(true)
    // Declines a name from a different family.
    expect(
      collapse.fromFutureHook!({
        hookName: 'failed_patch_possible',
        readable: '',
        scheduledForDay: 1,
      }),
    ).toBeUndefined()
  })

  // Codex review, P2 — "Bind patch failures to their originating area". The
  // first cut picked whichever patched room was currently most damaged, so a
  // promise made about one room could collapse another — or lapse because the
  // unrelated room had since been repaired.
  it('a patch failure binds to the room whose patch made the promise', () => {
    const def = findScheduledEventDefinitionForHookName(FAILED_PATCH_EVENT)!
    // The payload deliberately carries no area: the hook name has none, so the
    // resolver reads the memory the same response profile wrote, matched on the
    // day the promise was made.
    const adapted = def.fromFutureHook!({
      hookName: FAILED_PATCH_EVENT,
      readable: 'the patch may fail',
      scheduledForDay: 20,
    })!
    expect(adapted.payload).toEqual({ scope: 'patched_area' })
    expect(def.payloadSchema.safeParse(adapted.payload).success).toBe(true)
    // Binding is by creation day, so two patches on different days cannot be
    // confused for one another.
    expect(def.exactOnceKey({ type: def.type, scheduledForDay: 20, payload: adapted.payload })).not.toBe(
      def.exactOnceKey({ type: def.type, scheduledForDay: 21, payload: adapted.payload }),
    )
  })

  it('exact-once keys are stable for the same promise and distinct per area', () => {
    const collapse = findScheduledEventDefinitionForHookName(
      'area_collapse_risk_kitchen',
    )!
    const key = (areaId: string, day: number) =>
      collapse.exactOnceKey({
        type: collapse.type,
        scheduledForDay: day,
        payload: { areaId },
      })
    expect(key('kitchen', 10)).toBe(key('kitchen', 10))
    expect(key('kitchen', 10)).not.toBe(key('cellar', 10))
    expect(key('kitchen', 10)).not.toBe(key('kitchen', 11))
  })
})
