// Expansion arc / Phase 0 (ISSUE-170, repo phase 207) — frozen baseline probes.
//
// `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` § "Phase 0"
// asks for deterministic fixtures covering a fresh run on every difficulty,
// a normal full day, the same day through Segments A/B/C, week and month
// boundaries, and the no-action / quality / profit / staff / supplier
// routes — each recording coin and ledger totals, traffic and satisfaction,
// cleanliness/damage/area capacity, staff meters and availability, stock and
// recipe output, active obligations, pressure contributors, issue counts and
// response results, persistent collection sizes, and validation failures.
//
// This module produces those snapshots. The frozen values live in
// `docs/plans/expansion/baseline-probes.json`, written by
// `scripts/expansion-baseline.ts --write` and compared by
// `tests/sim/phase207.baselineAndLedger.test.ts`. When a later phase changes
// behavior on purpose, it rewrites the file in the same commit and the diff
// IS the record of what moved — that is the point of freezing them.
//
// The module is pure and headless like the rest of `src/sim/`: no fs, no
// clock, no unseeded randomness. Reading and writing the JSON is the
// script's job, not this file's.

import { FULL_PIPELINE } from '../canonicalPipeline'
import { advanceDaySegment, simulateDay } from '../core/engine'
import type { SimInput } from '../core/context'
import type { SimResult } from '../core/result'
import { DAY_SEGMENTS } from '../core/segments'
import type { TavernState } from '../state/TavernState'
import { createInitialTavernState } from '../state/defaults'
import { DIFFICULTY_PRESETS, applyDifficultyToBase, type DifficultyId } from '../state/difficulty'
import { getPolicyBot, type PolicyBotId } from './policyBots'
import type { MonthlyModuleState } from '../modules/monthly/types'
import type { ResponsesModuleState } from '../modules/responses/types'
import type { ServiceModuleState } from '../modules/service/types'
import type { WeeklyModuleState } from '../modules/weekly/types'
import { getResolvableSeedsToday } from '../modules/issues/issueSeedQueries'
import type {
  IssueSeedModuleState,
  ResponseIntent,
} from '../modules/issues/issueSeedTypes'

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export type ProbeRouteId =
  | 'fresh-easy'
  | 'fresh-standard'
  | 'fresh-hard'
  | 'full-day'
  | 'segmented-day'
  | 'week-boundary'
  | 'month-boundary'
  | 'no-action'
  | 'quality-focused'
  | 'profit-focused'
  | 'staff-focused'
  | 'supplier-focused'
  | 'responsive-route'

export type ProbeRoute = {
  id: ProbeRouteId
  /** What the route is meant to hold still. */
  purpose: string
  /**
   * Which test tier the route belongs to (`vitest.config.ts` HEAVY_TEST_GLOBS
   * owns the file-level split). Every route today measures under ~1.2 s, so
   * the whole set is `fast`; a route that grows into a multi-minute playtest
   * moves to `heavy` and its test file joins the glob list.
   */
  tier: 'fast' | 'heavy'
  days: number
  difficulty: DifficultyId
  /** Which policy bot drives the day, when the route drives one. */
  bot?: PolicyBotId
  /** Run the day as three segments instead of one `simulateDay`. */
  segmented?: boolean
  /** Borrow another route's seed. `segmented-day` must replay `full-day`'s
   *  exact inputs, or the equivalence it exists to prove means nothing. */
  seedFrom?: ProbeRouteId
  /** Answer the day's resolvable cards at Pause 2 (implies `segmented`).
   *  Without this no route ever schedules a pending consequence, and the
   *  plan's "active obligations / response results" metrics stay empty. */
  respond?: boolean
}

/**
 * Every route the plan's Phase 0 names. `supplier-focused` is included now
 * even though the plan defers it "once suppliers become transactional":
 * `auto_always_restock` is the closest reachable procurement route today,
 * so freezing it gives Phase 6 a before-picture to diff against rather
 * than a blank.
 */
export const PROBE_ROUTES: ReadonlyArray<ProbeRoute> = [
  {
    id: 'fresh-easy',
    purpose: 'Day-zero state on Easy — the opening values difficulty currently edits',
    tier: 'fast',
    days: 0,
    difficulty: 'easy',
  },
  {
    id: 'fresh-standard',
    purpose: 'Day-zero state on Standard — the reference opening',
    tier: 'fast',
    days: 0,
    difficulty: 'standard',
  },
  {
    id: 'fresh-hard',
    purpose: 'Day-zero state on Hard — the opening values difficulty currently edits',
    tier: 'fast',
    days: 0,
    difficulty: 'hard',
  },
  {
    id: 'full-day',
    purpose: 'One normal day through the run-all `simulateDay` path',
    tier: 'fast',
    days: 1,
    difficulty: 'standard',
  },
  {
    id: 'segmented-day',
    purpose:
      'The same day through Segments A, B and C — must match `full-day` exactly (plan §2.2 equivalence)',
    tier: 'fast',
    days: 1,
    difficulty: 'standard',
    segmented: true,
    seedFrom: 'full-day',
  },
  {
    id: 'week-boundary',
    purpose: 'Seven days — the first `endWeek` settlement',
    tier: 'fast',
    days: 7,
    difficulty: 'standard',
  },
  {
    id: 'month-boundary',
    purpose: 'Twenty-eight days — the first `endMonth` settlement, rent, and inspection drift',
    tier: 'fast',
    days: 28,
    difficulty: 'standard',
  },
  {
    id: 'no-action',
    purpose: 'Fourteen days with no owner actions — the neglect floor',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_no_owner_actions',
  },
  {
    id: 'quality-focused',
    purpose: 'Fourteen days of cleaning and upkeep',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_clean_focused',
  },
  {
    id: 'profit-focused',
    purpose: 'Fourteen days of margin-first play',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_profit_focused',
  },
  {
    id: 'staff-focused',
    purpose: 'Fourteen days of staff-first play',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_staff_friendly',
  },
  {
    id: 'supplier-focused',
    purpose:
      'Fourteen days of restocking — the procurement route Phase 6 replaces with a real order chain',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_always_restock',
  },
  {
    id: 'responsive-route',
    purpose:
      'Fourteen days answering every resolvable card at Pause 2 — the only route that fills the pending queue, so it is the OBL-02 before-picture',
    tier: 'fast',
    days: 14,
    difficulty: 'standard',
    bot: 'auto_clean_focused',
    segmented: true,
    respond: true,
  },
]

export function getProbeRoute(id: ProbeRouteId): ProbeRoute {
  const route = PROBE_ROUTES.find((r) => r.id === id)
  if (!route) throw new Error(`Unknown baseline probe route: ${id}`)
  return route
}

/** The seed a route runs on. Fixed per route so a snapshot is reproducible
 *  from the route id alone; `seedFrom` lets a route replay another's inputs. */
export function probeSeed(routeId: ProbeRouteId): string {
  const route = PROBE_ROUTES.find((r) => r.id === routeId)
  return `expansion-baseline/${route?.seedFrom ?? routeId}`
}

// ---------------------------------------------------------------------------
// Snapshot shape
// ---------------------------------------------------------------------------

export type ProbeSnapshot = {
  route: ProbeRouteId
  seed: string
  days: number
  difficulty: DifficultyId
  calendar: {
    year: number
    month: number
    week: number
    day: number
    dayOfWeek: number
    totalDaysElapsed: number
  }
  coin: number
  /** Coin and ledger totals — per-day service sums plus the two accumulators. */
  ledger: {
    serviceCoinEarned: number
    serviceNetCoin: number
    serviceUnpaidTabs: number
    weekly: Record<string, number>
    monthly: Record<string, number>
  }
  traffic: { total: number; byGroup: Record<string, number> }
  satisfaction: { mean: number; byGroup: Record<string, number> }
  patronage: Record<string, number>
  reputation: Record<string, number>
  /** Cleanliness, damage, and the closest thing to capacity the model has
   *  today: how many upgrades an area has installed or in progress. Phase 2
   *  replaces the proxy with real capacity. */
  areas: Record<
    string,
    {
      condition: number
      cleanliness: number
      mess: number
      damage: number
      smell: number
      risk: number
      upgradesInstalled: number
      upgradesInProgress: number
      activeProblems: number
    }
  >
  staff: Record<
    string,
    {
      role: string
      skill: number
      morale: number
      stress: number
      fatigue: number
      loyalty: number
      wage: number
      paidThisWeek: boolean
      available: boolean
    }
  >
  stock: Record<string, { quantity: number; quality: number; spoilage: number }>
  recipes: { onMenu: number; timesServed: Record<string, number> }
  /** Active obligations, as the repository models them today. The emptiness
   *  of `pending*` and the absence of any loan record are the baseline
   *  OBL-02/OBL-04/OBL-07 findings, frozen. */
  obligations: {
    pendingTotal: number
    pendingByKind: Record<string, number>
    totalResolved: number
    totalApplied: number
    totalExpired: number
    rent: Record<string, number | boolean>
    landlord: Record<string, number>
    inspection: Record<string, number>
    unpaidStaff: number
  }
  pressures: Record<string, { value: number; trend: number; topCauses: string[] }>
  issues: {
    totalGenerated: number
    totalRejected: number
    seedsToday: number
    surfacedToday: number
    withheldToday: number
    responsesResolvedToday: number
    responsesAppliedToday: number
  }
  /** Persistent collection sizes — the bounded-growth baseline (plan §5.11). */
  collections: Record<string, number>
  validation: { ok: boolean; errors: number; warnings: number }
}

// ---------------------------------------------------------------------------
// Running a route
// ---------------------------------------------------------------------------

function initialStateFor(route: ProbeRoute): TavernState {
  const base = createInitialTavernState()
  return applyDifficultyToBase(base, DIFFICULTY_PRESETS[route.difficulty])
}

function inputFor(route: ProbeRoute, state: TavernState, dayIndex: number): SimInput {
  const input: SimInput = { seed: `${probeSeed(route.id)}-d${dayIndex}` }
  if (!route.bot) return input
  const bot = getPolicyBot(route.bot)
  const ownerActions = [...bot.chooseActions(state)]
  const staffPriorities = bot.chooseStaffPriorities?.(state)
  return {
    ...input,
    ...(ownerActions.length > 0 ? { ownerActions } : {}),
    ...(staffPriorities && Object.keys(staffPriorities).length > 0 ? { staffPriorities } : {}),
  }
}

/**
 * The fixed response policy for `respond` routes: take each resolvable
 * seed's FIRST slot, its first allowed verb, and its first target option.
 * Deterministic, and reached the way a player reaches it — the seeds are
 * whatever the day naturally generated, not injected fixtures.
 */
function firstSlotIntents(state: TavernState, dayIndex: number): ResponseIntent[] {
  const intents: ResponseIntent[] = []
  getResolvableSeedsToday(state).forEach((seed, index) => {
    const slot = seed.responseSlots[0]
    const verb = slot?.allowedVerbs[0]
    if (!slot || !verb) return
    intents.push({
      id: `baseline-d${dayIndex}-${index}`,
      seedId: seed.id,
      verb,
      shape: slot.shape,
      ...(slot.targetOptions[0] ? { target: slot.targetOptions[0] } : {}),
      tags: [],
      intensity: 1,
      metadata: { responseSlotId: slot.id },
    })
  })
  return intents
}

/** Run one day the way the route asks for it: as one `simulateDay`, or as
 *  the three resumable segments the player actually crosses. */
function runOneDay(route: ProbeRoute, state: TavernState, dayIndex: number): SimResult {
  const input = inputFor(route, state, dayIndex)
  if (!route.segmented && !route.respond) return simulateDay(state, input, FULL_PIPELINE)

  let current = state
  let last: SimResult | undefined
  for (const segment of DAY_SEGMENTS) {
    // Responses are chosen at Pause 2, against the state Segment B left —
    // the same seam the UI submits from.
    const segmentInput =
      route.respond && segment === 'C'
        ? (() => {
            const intents = firstSlotIntents(current, dayIndex)
            return intents.length > 0 ? { ...input, responseIntents: intents } : input
          })()
        : input
    last = advanceDaySegment(current, segmentInput, FULL_PIPELINE, segment, {
      ...(segment === 'A' ? {} : { dayBaseline: state }),
    })
    current = last.state
  }
  return last!
}

export type ProbeRun = {
  route: ProbeRoute
  finalState: TavernState
  /** Per-day results, oldest first. Empty for the day-zero fresh routes. */
  results: SimResult[]
}

export function runProbeRoute(routeId: ProbeRouteId): ProbeRun {
  const route = getProbeRoute(routeId)
  let state = initialStateFor(route)
  const results: SimResult[] = []
  for (let day = 0; day < route.days; day += 1) {
    const result = runOneDay(route, state, day)
    results.push(result)
    state = result.state
  }
  return { route, finalState: state, results }
}

// ---------------------------------------------------------------------------
// Snapshotting
// ---------------------------------------------------------------------------

/** Guard against float drift making an otherwise-deterministic probe churn. */
function round(value: number): number {
  return Number.isInteger(value) ? value : Number(value.toFixed(6))
}

function roundAll(source: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of Object.keys(source).sort()) out[key] = round(source[key]!)
  return out
}

function moduleSlice<T>(state: TavernState, id: string): T | undefined {
  return state.modules[id] as T | undefined
}

function economyTotals(economy: Record<string, number> | undefined): Record<string, number> {
  return economy ? roundAll(economy) : {}
}

export function snapshotProbeRun(run: ProbeRun): ProbeSnapshot {
  const { route, finalState: state, results } = run

  const service = moduleSlice<ServiceModuleState>(state, 'service')
  const weekly = moduleSlice<WeeklyModuleState>(state, 'weekly')
  const monthly = moduleSlice<MonthlyModuleState>(state, 'monthly')
  const responses = moduleSlice<ResponsesModuleState>(state, 'responses')
  const issueSeeds = moduleSlice<IssueSeedModuleState>(state, 'issueSeeds')

  // Coin and ledger totals: sum the per-day service results across the whole
  // route rather than reading the week/month accumulators, which reset on
  // their boundaries.
  let serviceCoinEarned = 0
  let serviceNetCoin = 0
  let serviceUnpaidTabs = 0
  const trafficByGroup: Record<string, number> = {}
  for (const result of results) {
    const dayService = moduleSlice<ServiceModuleState>(result.state, 'service')?.result
    if (!dayService) continue
    serviceCoinEarned += dayService.coinEarned
    serviceNetCoin += dayService.netCoinEarned
    serviceUnpaidTabs += dayService.unpaidTabs
    for (const [groupId, visitors] of Object.entries(dayService.trafficByGroup)) {
      trafficByGroup[groupId] = (trafficByGroup[groupId] ?? 0) + visitors
    }
  }

  const satisfactionByGroup: Record<string, number> = {}
  const patronage: Record<string, number> = {}
  for (const groupId of Object.keys(state.customerGroups).sort()) {
    const group = state.customerGroups[groupId]!
    satisfactionByGroup[groupId] = round(group.satisfaction)
    patronage[groupId] = round(group.patronage)
  }
  const satisfactionValues = Object.values(satisfactionByGroup)
  const satisfactionMean =
    satisfactionValues.length === 0
      ? 0
      : round(satisfactionValues.reduce((a, b) => a + b, 0) / satisfactionValues.length)

  const areas: ProbeSnapshot['areas'] = {}
  for (const areaId of Object.keys(state.areas).sort()) {
    const area = state.areas[areaId]!
    const upgrades = Object.values(area.upgrades)
    areas[areaId] = {
      condition: round(area.condition),
      cleanliness: round(area.cleanliness),
      mess: round(area.mess),
      damage: round(area.damage),
      smell: round(area.smell),
      risk: round(area.risk),
      upgradesInstalled: upgrades.filter((u) => u.status === 'installed').length,
      upgradesInProgress: upgrades.filter((u) => u.status === 'in_progress').length,
      activeProblems: area.activeProblems.length,
    }
  }

  const staff: ProbeSnapshot['staff'] = {}
  for (const staffId of Object.keys(state.staff).sort()) {
    const person = state.staff[staffId]!
    staff[staffId] = {
      role: person.role,
      skill: round(person.skill),
      morale: round(person.morale),
      stress: round(person.stress),
      fatigue: round(person.fatigue),
      loyalty: round(person.loyalty),
      wage: round(person.wage),
      paidThisWeek: person.paidThisWeek,
      available: person.unavailable !== true,
    }
  }

  const stock: ProbeSnapshot['stock'] = {}
  for (const stockId of Object.keys(state.stock).sort()) {
    const item = state.stock[stockId]!
    stock[stockId] = {
      quantity: round(item.quantity),
      quality: round(item.quality),
      spoilage: round(item.spoilage),
    }
  }

  const timesServed: Record<string, number> = {}
  let onMenu = 0
  for (const recipeId of Object.keys(state.recipes).sort()) {
    const recipe = state.recipes[recipeId]!
    timesServed[recipeId] = recipe.timesServed
    if (recipe.onMenu) onMenu += 1
  }

  const pendingByKind: Record<string, number> = {}
  for (const entry of responses?.pending ?? []) {
    pendingByKind[entry.payload.kind] = (pendingByKind[entry.payload.kind] ?? 0) + 1
  }

  const pressures: ProbeSnapshot['pressures'] = {}
  for (const pressureId of Object.keys(state.pressures).sort()) {
    const pressure = state.pressures[pressureId]!
    pressures[pressureId] = {
      value: round(pressure.value),
      trend: round(pressure.trend),
      topCauses: [...pressure.topCauses],
    }
  }

  const lastValidation = results.at(-1)?.validation

  return {
    route: route.id,
    seed: probeSeed(route.id),
    days: route.days,
    difficulty: route.difficulty,
    calendar: {
      year: state.calendar.year,
      month: state.calendar.month,
      week: state.calendar.week,
      day: state.calendar.day,
      dayOfWeek: state.calendar.dayOfWeek,
      totalDaysElapsed: state.calendar.totalDaysElapsed,
    },
    coin: round(state.coin),
    ledger: {
      serviceCoinEarned: round(serviceCoinEarned),
      serviceNetCoin: round(serviceNetCoin),
      serviceUnpaidTabs: round(serviceUnpaidTabs),
      weekly: economyTotals(weekly?.economy as Record<string, number> | undefined),
      monthly: economyTotals(
        monthly?.accumulator?.economy as Record<string, number> | undefined,
      ),
    },
    traffic: {
      total: round(Object.values(trafficByGroup).reduce((a, b) => a + b, 0)),
      byGroup: roundAll(trafficByGroup),
    },
    satisfaction: { mean: satisfactionMean, byGroup: satisfactionByGroup },
    patronage,
    reputation: roundAll(state.reputation as unknown as Record<string, number>),
    areas,
    staff,
    stock,
    recipes: { onMenu, timesServed },
    obligations: {
      pendingTotal: responses?.pending.length ?? 0,
      pendingByKind,
      totalResolved: responses?.totalResolved ?? 0,
      totalApplied: responses?.totalApplied ?? 0,
      totalExpired: responses?.totalExpired ?? 0,
      rent: {
        monthlyAmount: monthly?.rent.monthlyAmount ?? 0,
        paidThisMonth: monthly?.rent.paidThisMonth ?? false,
        missedPayments: monthly?.rent.missedPayments ?? 0,
        arrears: monthly?.rent.arrears ?? 0,
      },
      landlord: {
        opinion: monthly?.landlord.opinion ?? 0,
        pressure: monthly?.landlord.pressure ?? 0,
        missedRentCount: monthly?.landlord.missedRentCount ?? 0,
      },
      inspection: {
        suspicion: monthly?.inspection.suspicion ?? 0,
        warningCount: monthly?.inspection.warningCount ?? 0,
      },
      unpaidStaff: Object.values(state.staff).filter((s) => !s.paidThisWeek).length,
    },
    pressures,
    issues: {
      totalGenerated: issueSeeds?.totalGenerated ?? 0,
      totalRejected: issueSeeds?.totalRejected ?? 0,
      seedsToday: issueSeeds?.seedsToday.length ?? 0,
      surfacedToday: issueSeeds?.surfacedToday.length ?? 0,
      withheldToday: issueSeeds?.withheldToday?.length ?? 0,
      responsesResolvedToday: responses?.resolvedToday.length ?? 0,
      responsesAppliedToday: responses?.appliedFromPendingToday.length ?? 0,
    },
    collections: {
      memories: state.memories.length,
      history: state.history.length,
      causes: state.causes.length,
      pressures: Object.keys(state.pressures).length,
      areas: Object.keys(state.areas).length,
      stock: Object.keys(state.stock).length,
      staff: Object.keys(state.staff).length,
      customerGroups: Object.keys(state.customerGroups).length,
      recipes: Object.keys(state.recipes).length,
      ventures: Object.keys(state.ventures).length,
      arcs: Object.keys(state.arcs).length,
      transformations: Object.keys(state.transformations).length,
      cultures: Object.keys(state.world.cultures).length,
      factions: Object.keys(state.world.factions).length,
      suppliers: Object.keys(state.world.suppliers).length,
      regulars: Object.keys(state.world.regulars).length,
      notableNpcs: Object.keys(state.world.notableNpcs).length,
      localEvents: Object.keys(state.world.localEvents).length,
      socialRumours: Object.keys(state.world.socialRumours).length,
      hireableAdventurers: Object.keys(state.world.hireableAdventurers).length,
      expeditionsActive: state.expeditions.active.length,
      expeditionsCompleted: state.expeditions.completed.length,
      responsesPending: responses?.pending.length ?? 0,
      issueCooldowns: Object.keys(issueSeeds?.cooldowns ?? {}).length,
    },
    validation: {
      ok: (lastValidation?.errors.length ?? 0) === 0,
      errors: lastValidation?.errors.length ?? 0,
      warnings: lastValidation?.warnings.length ?? 0,
    },
  }
}

export function probeSnapshot(routeId: ProbeRouteId): ProbeSnapshot {
  return snapshotProbeRun(runProbeRoute(routeId))
}

export type BaselineProbeFile = {
  /** Bump when the snapshot SHAPE changes so a stale file fails loudly
   *  instead of silently comparing missing fields. */
  version: number
  routes: Record<string, { purpose: string; tier: 'fast' | 'heavy'; days: number }>
  snapshots: Record<string, ProbeSnapshot>
}

export const BASELINE_PROBE_VERSION = 1

/** Run every route and assemble the file the repository freezes. */
export function buildBaselineProbeFile(
  routes: ReadonlyArray<ProbeRoute> = PROBE_ROUTES,
): BaselineProbeFile {
  const meta: BaselineProbeFile['routes'] = {}
  const snapshots: BaselineProbeFile['snapshots'] = {}
  for (const route of routes) {
    meta[route.id] = { purpose: route.purpose, tier: route.tier, days: route.days }
    snapshots[route.id] = probeSnapshot(route.id)
  }
  return { version: BASELINE_PROBE_VERSION, routes: meta, snapshots }
}
