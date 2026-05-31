// Phase 163 / ISSUE-131 (Faithful Surface arc, Phase 1).
//
// Per-family `TavernState` builders that set up the minimum state needed
// to trigger each issue-seed generator. Lifted from the load-bearing
// recipes in `phase19.issueSeeds.test.ts` and `phase39.expandedIssueSeeds.test.ts`
// so the Phase 1 gate samplers can replay real generator output instead of
// the 2-slot synthetic stub from `cardFactories.makeSeed`.
//
// Each builder takes no arguments and returns a fresh `TavernState`. The
// `captureSeedShape` helper in `tests/cards/compose/gates/realSeedShapes.ts`
// runs each builder once at module load, runs one day with `runOneDay`, and
// captures the resulting seed's structural shape (responseSlots,
// consequenceProfiles, stakes, causes, pressures).

import type { CalendarStamp, TavernState } from '../../src/sim/state/TavernState'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  withArea,
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'
import type { SimInput } from '../../src/sim/core/context'
import { runOneDay } from '../../src/sim/testing/simRunner'
import type { MonthlyModuleState } from '../../src/sim/modules/monthly/types'
import type {
  AttributionState,
  AttributionType,
} from '../../src/sim/modules/attribution/index'
import type {
  EntityRef,
  MemoryState,
  RegularWorldState,
} from '../../src/sim/state/TavernState'

// ----------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------

function plentyOfStock(state: TavernState): TavernState {
  return {
    ...state,
    stock: {
      ...state.stock,
      ale: { ...state.stock['ale']!, quantity: 800, quality: 60 },
      stew: { ...state.stock['stew']!, quantity: 400, quality: 60 },
      mushrooms: { ...state.stock['mushrooms']!, quantity: 200 },
    },
  }
}

function stampOf(state: TavernState): CalendarStamp {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    week: state.calendar.week,
    day: state.calendar.day,
    absoluteDay: state.calendar.totalDaysElapsed,
  }
}

function withDayType(
  state: TavernState,
  dayType: TavernState['calendar']['dayType'],
): TavernState {
  return { ...state, calendar: { ...state.calendar, dayType } }
}

function seedMemories(
  state: TavernState,
  memories: MemoryState[],
): TavernState {
  return {
    ...state,
    memories: [...state.memories, ...memories],
  }
}

function seedAttributions(
  state: TavernState,
  attributions: AttributionState[],
): TavernState {
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
        attributions: [...existing.attributions, ...attributions],
      },
    },
  }
}

function makeAttribution(
  state: TavernState,
  override: Partial<AttributionState> & {
    target: AttributionState['target']
    attributionType: AttributionType
    readable: string
  },
): AttributionState {
  return {
    id: `attr-${override.target.kind}-${override.target.id}-${override.attributionType}-${stampOf(state).absoluteDay}`,
    timestamp: stampOf(state),
    sourceCauseIds: [],
    sourceMemoryIds: [],
    sourceSceneIds: [],
    perceivedBy: { kind: 'customer_group', id: 'miners' },
    accuracy: 'partial',
    strength: 80,
    confidence: 80,
    publicness: 90,
    volatility: 30,
    tags: ['blame'],
    relatedSystems: [],
    ageDays: 0,
    ...override,
  }
}

function injectRegular(
  state: TavernState,
  regular: RegularWorldState,
): TavernState {
  // Phase 39 audit fix §1.3 — `createInitialTavernState` seeds an 11-regular
  // starter roster; the avg-irritation pressure calculator dilutes a single
  // injected high-irritation regular below the firing threshold. Clear
  // starters first so the injected regular dominates the average.
  return {
    ...state,
    world: {
      ...state.world,
      regulars: { [regular.id]: regular },
    },
  }
}

function makeRegular(overrides: Partial<RegularWorldState>): RegularWorldState {
  return {
    id: 'phase163_regular_brik',
    name: {
      display: 'Brik Tallowmug',
      profileId: 'goblin_common',
      parts: { given: 'Brik', family: 'Tallowmug' },
      patternId: 'given_family',
      generatedBy: 'phase163_triggering_state',
    },
    customerGroupId: 'miners',
    loyalty: 50,
    irritation: 30,
    visits: 5,
    knownIncidentIds: [],
    firstSeenDay: 1,
    lastSeenDay: 1,
    tags: ['regular'],
    activeFlags: [],
    ...overrides,
  }
}

// ----------------------------------------------------------------------
// Core families (lifted from phase19.issueSeeds.test.ts)
// ----------------------------------------------------------------------

export function buildFoodSafetyTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 80 })
  state = withStock(state, 'mushrooms', { spoilage: 90 })
  state = withStock(state, 'stew', { spoilage: 80, quantity: 400 })
  return state
}

export function buildStockShortageTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withStock(state, 'ale', { quantity: 10 })
  state = withDayType(state, 'payday')
  return state
}

export function buildMaintenanceTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withArea(state, 'main_room', { damage: 80, condition: 15 })
  state = withArea(state, 'roof', { damage: 85, condition: 15 })
  state = withArea(state, 'privy', { condition: 25 })
  return state
}

export function buildStaffBurnoutTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  for (const id of Object.keys(state.staff)) {
    state = withStaff(state, id, {
      paidThisWeek: false,
      stress: 80,
      fatigue: 80,
      morale: 25,
    })
  }
  return state
}

export function buildCustomerComplaintTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withCustomerGroup(state, 'merchants', {
    satisfaction: 20,
    patronage: 30,
  })
  state = withArea(state, 'main_room', { cleanliness: 20 })
  return state
}

export function buildViolenceTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withDayType(state, 'brawl_night')
  state = withCustomerGroup(state, 'ogres', { patronage: 85, rowdiness: 90 })
  state = withCustomerGroup(state, 'adventurers', {
    patronage: 60,
    rowdiness: 80,
  })
  state = withArea(state, 'main_room', { damage: 60 })
  return state
}

export function buildDebtRentTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withRentArrears(state, 250, false)
  state = withCoin(state, 5)
  for (const id of Object.keys(state.customerGroups)) {
    state = withCustomerGroup(state, id, { patronage: 0 })
  }
  for (const id of Object.keys(state.stock)) {
    state = withStock(state, id, { quantity: 0 })
  }
  return state
}

export function buildInspectionTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withArea(state, 'kitchen', { cleanliness: 10, smell: 80 })
  state = withArea(state, 'privy', { smell: 90, cleanliness: 10 })
  state = withStock(state, 'mushrooms', { spoilage: 90 })
  state = withStock(state, 'stew', { spoilage: 80, quantity: 400 })
  state = withCustomerGroup(state, 'merchants', { satisfaction: 15 })
  state = { ...state, reputation: { ...state.reputation, filthy: 90 } }
  return state
}

export function buildReputationShiftTriggeringState(): TavernState {
  let state = plentyOfStock(createInitialTavernState())
  state = withCustomerGroup(state, 'miners', { patronage: 95 })
  state = withCustomerGroup(state, 'merchants', { patronage: 3 })
  state = withCustomerGroup(state, 'ogres', { patronage: 3 })
  state = withCustomerGroup(state, 'adventurers', { patronage: 3 })
  state = withCustomerGroup(state, 'local_goblins', { patronage: 3 })
  return {
    ...state,
    reputation: { ...state.reputation, cheap: 95, filthy: 90 },
  }
}

function withRentArrears(
  state: TavernState,
  arrears: number,
  paid: boolean,
): TavernState {
  const monthly = (state.modules['monthly'] ?? null) as MonthlyModuleState | null
  if (!monthly) return state
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: {
        ...monthly,
        rent: {
          ...monthly.rent,
          arrears,
          paidThisMonth: paid,
          missedPayments: paid
            ? monthly.rent.missedPayments
            : monthly.rent.missedPayments + 1,
        },
        landlord: {
          ...monthly.landlord,
          pressure: paid ? monthly.landlord.pressure : 65,
          missedRentCount: paid
            ? monthly.landlord.missedRentCount
            : monthly.landlord.missedRentCount + 1,
        },
      },
    },
  }
}

// ----------------------------------------------------------------------
// Expanded families (lifted from phase39.expandedIssueSeeds.test.ts)
// ----------------------------------------------------------------------

export function buildStaffIdentityTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const staffId = Object.keys(base.staff)[0]!
  const staffRef: EntityRef = { kind: 'staff', id: staffId }
  const stamp = stampOf(base)
  const weakened: TavernState = {
    ...base,
    staff: {
      ...base.staff,
      [staffId]: {
        ...base.staff[staffId]!,
        loyalty: 20,
        morale: 25,
        paidThisWeek: false,
        stress: 70,
        fatigue: 70,
      },
    },
  }
  const seeded = seedAttributions(weakened, [
    makeAttribution(weakened, {
      target: staffRef,
      attributionType: 'blame',
      readable: 'Cook publicly blamed for botched service.',
      publicness: 90,
      strength: 85,
      tags: ['staff', 'blame'],
    }),
  ])
  return seedMemories(seeded, [
    {
      id: 'mem-staff-scapegoat-1',
      type: 'grudge',
      strength: 80,
      ageDays: 0,
      createdAt: stamp,
      actors: [staffRef],
      locations: [],
      relatedSystems: ['staff'],
      tags: ['staff', 'scapegoat'],
      metadata: { owner: staffRef },
      label: 'scapegoat memory',
    },
  ])
}

/** regular_customer firing at `type: 'relationship_test'` — low irritation. */
export function buildRegularCustomerRelationshipTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const stamp = stampOf(base)
  const regular = makeRegular({ loyalty: 25, irritation: 45 })
  const regularRef: EntityRef = { kind: 'regular', id: regular.id }
  let state = injectRegular(base, regular)
  state = seedMemories(state, [
    {
      id: 'mem-regular-relationship',
      type: 'grudge',
      strength: 60,
      ageDays: 0,
      createdAt: stamp,
      actors: [regularRef],
      locations: [],
      relatedSystems: ['regulars'],
      tags: ['regular', 'ignored_complaint', 'memory'],
      metadata: { owner: regularRef },
      label: 'mild dissatisfaction',
    },
  ])
  return state
}

/** regular_customer firing at `type: 'complaint'` — irritation > 60. */
export function buildRegularCustomerComplaintTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const stamp = stampOf(base)
  const regular = makeRegular({ loyalty: 20, irritation: 80 })
  const regularRef: EntityRef = { kind: 'regular', id: regular.id }
  let state = injectRegular(base, regular)
  state = seedMemories(state, [
    {
      id: 'mem-regular-ignored',
      type: 'grudge',
      strength: 80,
      ageDays: 0,
      createdAt: stamp,
      actors: [regularRef],
      locations: [],
      relatedSystems: ['regulars'],
      tags: ['regular', 'ignored_complaint', 'memory'],
      metadata: { owner: regularRef },
      label: 'ignored regular complaint',
    },
  ])
  return state
}

export function buildSupplierRelationshipTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const supplierId = Object.keys(base.world.suppliers)[0]!
  const supplierRef: EntityRef = { kind: 'supplier', id: supplierId }
  const stamp = stampOf(base)
  let state = seedAttributions(base, [
    makeAttribution(base, {
      target: supplierRef,
      attributionType: 'blame',
      readable: 'Supplier blamed publicly for spoiled goods.',
      strength: 85,
      publicness: 85,
      tags: ['supplier', 'blame'],
    }),
  ])
  return seedMemories(state, [
    {
      id: 'mem-supplier-late-1',
      type: 'grudge',
      strength: 80,
      ageDays: 0,
      createdAt: stamp,
      actors: [supplierRef],
      locations: [],
      relatedSystems: ['suppliers'],
      tags: ['supplier', 'late_payment'],
      metadata: { subjects: [supplierRef] },
      label: 'supplier late payment',
    },
  ])
}

export function buildCultureConflictTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const cultureId = Object.keys(base.world.cultures)[0]!
  return {
    ...base,
    world: {
      ...base.world,
      cultures: {
        ...base.world.cultures,
        [cultureId]: {
          ...base.world.cultures[cultureId]!,
          tension: 80,
        },
      },
    },
    pressures: {
      ...base.pressures,
      cultural_tension: {
        ...base.pressures['cultural_tension']!,
        value: 60,
      },
    },
  }
}

export function buildSeasonalArcTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const today = base.calendar.totalDaysElapsed
  return {
    ...base,
    world: {
      ...base.world,
      localEvents: {
        ...base.world.localEvents,
        mushroom_festival_arc: {
          id: 'mushroom_festival_arc',
          definitionId: 'mushroom_festival',
          label: 'Mushroom Festival',
          startedDay: today,
          intensity: 70,
          relatedFactionIds: [],
          relatedCultureIds: [],
          tags: ['festival', 'arc'],
          activeFlags: [],
          type: 'festival',
          stage: 'active',
          lastUpdatedDay: today,
        },
      },
    },
    pressures: {
      ...base.pressures,
      arc_escalation: {
        ...base.pressures['arc_escalation']!,
        value: 60,
      },
      festival_readiness: {
        ...base.pressures['festival_readiness']!,
        value: 55,
      },
    },
  }
}

export function buildRumourCrisisTriggeringState(): TavernState {
  const base = plentyOfStock(createInitialTavernState())
  const supplierId = Object.keys(base.world.suppliers)[0]!
  const supplierRef: EntityRef = { kind: 'supplier', id: supplierId }
  const stamp = stampOf(base)
  const withAttributions = seedAttributions(base, [
    makeAttribution(base, {
      target: supplierRef,
      attributionType: 'blame',
      accuracy: 'false',
      readable: 'False rumour blames supplier.',
      publicness: 95,
      strength: 90,
      tags: ['rumour', 'supplier'],
    }),
    makeAttribution(base, {
      target: supplierRef,
      attributionType: 'distrust',
      accuracy: 'partial',
      readable: 'Supplier distrusted by miners.',
      publicness: 90,
      strength: 90,
      tags: ['rumour', 'supplier'],
    }),
  ])
  return {
    ...withAttributions,
    world: {
      ...withAttributions.world,
      socialRumours: {
        ...withAttributions.world.socialRumours,
        rumour_spoiled_goods: {
          id: 'rumour_spoiled_goods',
          label: 'Spoiled goods rumour spreads',
          strength: 80,
          accuracy: 'false',
          sourceEntityId: 'miners',
          targetEntityId: supplierId,
          subject: supplierRef,
          firstHeardDay: stamp.absoluteDay,
          lastSpreadDay: stamp.absoluteDay,
          tags: ['rumour', 'supplier'],
        },
      },
    },
  }
}

// ----------------------------------------------------------------------
// Families not covered by phase19/phase39 tests
// ----------------------------------------------------------------------

export function buildFactionRequestTriggeringState(): TavernState {
  // The faction_anger calculator (calculators/factionAnger.ts) inputs:
  //   avg(100 - faction.relationship), faction.fearOfTavern, blame
  //   attributions, faction-tied memories, policy_backlash.
  // To clear the generator's threshold (anger.value >= 25) we drop
  // every faction's relationship to 15 and add a blame attribution +
  // memory on the chosen faction so the recent-causes channel fires too.
  const base = plentyOfStock(createInitialTavernState())
  const stamp = stampOf(base)
  const factionIds = Object.keys(base.world.factions)
  if (factionIds.length === 0) {
    throw new Error('buildFactionRequestTriggeringState: no factions in initial state')
  }
  const factions: TavernState['world']['factions'] = { ...base.world.factions }
  for (const id of factionIds) {
    factions[id] = { ...factions[id]!, relationship: 15, fear: 70 }
  }
  const chosenId = factionIds[0]!
  const chosenRef: EntityRef = { kind: 'faction', id: chosenId }
  let state: TavernState = {
    ...base,
    world: { ...base.world, factions },
  }
  state = seedAttributions(state, [
    makeAttribution(state, {
      target: chosenRef,
      attributionType: 'blame',
      readable: 'Faction publicly accuses the tavern of disrespect.',
      publicness: 90,
      strength: 85,
      tags: ['faction', 'blame'],
    }),
  ])
  return seedMemories(state, [
    {
      id: 'mem-faction-slight',
      type: 'grudge',
      strength: 75,
      ageDays: 0,
      createdAt: stamp,
      actors: [chosenRef],
      locations: [],
      relatedSystems: ['factions'],
      tags: ['faction', chosenId, 'slight'],
      metadata: { owner: chosenRef },
      label: 'faction slight',
    },
  ])
}

export function buildAreaAtmosphereTriggeringState(): TavernState {
  // generateAreaAtmosphere requires (100 - cleanliness) + damage >= 60
  // on at least one area, plus recent causes tagged area/cleanliness/damage.
  // Drop main_room's cleanliness to 20 and bump damage to 50; pressure
  // module's `maintenance` calculator will pick up the area state and
  // produce causes tagged 'maintenance' that feed `recentCauseEntries`.
  let state = plentyOfStock(createInitialTavernState())
  state = withArea(state, 'main_room', { cleanliness: 20, damage: 50 })
  state = withArea(state, 'kitchen', { cleanliness: 30, damage: 30 })
  return state
}

export function buildRivalTavernArcTriggeringState(): TavernState {
  // Need rival_tavern_pressure >= 25 + a rival-themed local arc + recent
  // causes tagged rival/market/patronage. Set the rival_tavern_pressure
  // snapshot directly; the pressure calculator may rewrite during the
  // day but should not drop below threshold given the depressed customer
  // groups + arc presence below.
  const base = plentyOfStock(createInitialTavernState())
  const today = base.calendar.totalDaysElapsed
  let state: TavernState = {
    ...base,
    world: {
      ...base.world,
      localEvents: {
        ...base.world.localEvents,
        rival_tavern_arc: {
          id: 'rival_tavern_arc',
          definitionId: 'rival_tavern_expansion',
          label: 'Rival tavern expands',
          startedDay: today,
          intensity: 70,
          relatedFactionIds: [],
          relatedCultureIds: [],
          tags: ['rival', 'market', 'arc'],
          activeFlags: [],
          type: 'rival_expansion',
          stage: 'active',
          lastUpdatedDay: today,
        },
      },
    },
    pressures: {
      ...base.pressures,
      rival_tavern_pressure: {
        ...(base.pressures['rival_tavern_pressure'] ?? {
          id: 'rival_tavern_pressure',
          label: 'rival_tavern_pressure',
          tags: [],
          topCauses: [],
        }),
        id: 'rival_tavern_pressure',
        label: 'rival_tavern_pressure',
        value: 60,
        trend: 1,
        tags: ['rival', 'market'],
        topCauses: [],
      },
    },
  }
  for (const id of Object.keys(state.customerGroups)) {
    state = withCustomerGroup(state, id, { patronage: 10 })
  }
  return state
}

export function buildRivalTavernSystemTriggeringState(): TavernState {
  // Same as the arc variant but WITHOUT the rival local arc — the
  // generator falls back to `systemRef('rival_tavern')`. Slot shape
  // shifts subtly (host_counter_event's targetOptions point at the
  // system ref instead of an arc ref), so we capture both.
  //
  // The pressure calculator rewrites `rival_tavern_pressure` each day
  // from arc intensity / reputation_drift / regular loss / rumours, so
  // a direct state write is wiped. Drive it instead via the inputs the
  // calculator reads: multiple rival-tagged rumours, depressed
  // patronage, low loyalty regulars, and bad reputation/atmosphere
  // (which drives reputation_drift + regular_customer_loss above the
  // 35 thresholds the calculator gates on).
  const base = plentyOfStock(createInitialTavernState())
  const stamp = stampOf(base)
  let state: TavernState = {
    ...base,
    world: {
      ...base.world,
      socialRumours: {
        ...base.world.socialRumours,
        phase163_rival_rumour_a: {
          id: 'phase163_rival_rumour_a',
          label: 'A rival cellar boasts the best ale in town',
          strength: 95,
          accuracy: 'partial',
          sourceEntityId: 'miners',
          subject: { kind: 'system', id: 'rival_tavern' },
          firstHeardDay: stamp.absoluteDay,
          lastSpreadDay: stamp.absoluteDay,
          tags: ['rival', 'competition'],
        },
        phase163_rival_rumour_b: {
          id: 'phase163_rival_rumour_b',
          label: 'The rival is poaching our regulars',
          strength: 90,
          accuracy: 'partial',
          sourceEntityId: 'merchants',
          subject: { kind: 'system', id: 'rival_tavern' },
          firstHeardDay: stamp.absoluteDay,
          lastSpreadDay: stamp.absoluteDay,
          tags: ['rival', 'competition'],
        },
        phase163_rival_rumour_c: {
          id: 'phase163_rival_rumour_c',
          label: 'Merchants prefer the rival cellar these days',
          strength: 80,
          accuracy: 'partial',
          sourceEntityId: 'merchants',
          subject: { kind: 'system', id: 'rival_tavern' },
          firstHeardDay: stamp.absoluteDay,
          lastSpreadDay: stamp.absoluteDay,
          tags: ['rival', 'competition'],
        },
      },
    },
    // Depressed reputation drives the `reputation_drift` pressure above
    // its 35 threshold; cheap+filthy is the same combination phase19
    // uses for reputation_shift.
    reputation: { ...base.reputation, cheap: 90, filthy: 85 },
  }
  // Empty patronage + low loyalty regulars drives `regular_customer_loss`
  // above its 35 threshold.
  for (const id of Object.keys(state.customerGroups)) {
    state = withCustomerGroup(state, id, { patronage: 3, satisfaction: 20 })
  }
  return state
}

export function buildMonthlyReviewTriggeringState(): TavernState {
  // Phase 186 / Cluster 4 — monthly_review was re-homed to the first
  // morning of the new month: it is produced in the `startDay` pass, gated
  // on a persisted `lastMonthlyResult` (written by `monthlyModule.endMonth`
  // on day 28) AND `calendar.day === 1`. We advance exactly 27 days here;
  // captureSeedShape then runs the capture day (day 28 — month-end, which
  // writes `lastMonthlyResult` but does not yet fire the review) and, on
  // finding nothing, runs its built-in one-day warm-up (day 29 — the first
  // morning of month 2), where the morning pass fires the generator. So
  // 27 + capture + warm-up lands exactly on day 29. Cost: one-off at module
  // load (~0.8s).
  let state = plentyOfStock(createInitialTavernState())
  const seed: SimInput = { seed: 'phase163-monthly-review-trigger' }
  for (let i = 0; i < 27; i += 1) {
    state = runOneDay(state, seed).state
  }
  return state
}
