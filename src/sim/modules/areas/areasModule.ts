import { z } from 'zod'

import type { SimulationModule, SimulationHook } from '../../core/module'
import type { SimContext } from '../../core/context'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'
import type { AreaState } from '../../state/TavernState'

import {
  areaRegistry,
  ensureRequiredAreasRegistered,
} from '../../registries/areaRegistry'
import { clampPercent } from '../../state/normalize'
import { getRule, scaleOngoingIntegerDecay } from '../../contracts/ruleset/index'
import { recordMeterMovement } from '../../contracts/meters/index'
import { ensureRequiredAreaTraitsRegistered } from '../../content/tavern/areaTraitRegistry'
import {
  areaUpgradeRegistry,
  ensureRequiredAreaUpgradesRegistered,
} from '../../content/tavern/areaUpgradeRegistry'
import {
  describeAreaAtmosphere,
  getAreaQualityBand,
  getInstalledUpgradeIds,
  isAreaDamaged,
  isAreaDangerous,
  isAreaFilthy,
  isAreaInspectionRisk,
} from './derived'
import {
  getBaseAreaCapacity,
  getAreaBlockedFraction,
  getCustomerFacingSeating,
  getInstalledAreaCapacity,
  getUsableAreaCapacity,
  getUsableCapacity,
} from './capacity'
import { capacityOf } from '../../registries/areaCapacityTypes'
import {
  AreasModuleStateSchema,
  bumpAreaTotal,
  createInitialAreasModuleState,
  getAreasModuleState,
  writeAreasSlice,
  type AreaCapacitySnapshot,
} from './state'
import { buildAreaWorkSchedule } from './schedule'
import { applyAreaPropagation } from './propagation'
import { tickConstruction, tickUpkeep } from './construction'
import { ensureAreaScheduledEventsRegistered } from './areaEvents'
import { listActiveSites } from './quote'

// Phase 28 — make sure the area trait and upgrade registries are
// populated before any area report or validation runs. Tests sometimes
// import modules in unusual orders; touching the ensure helpers here
// keeps both registries hot the moment `areasModule` is imported.
ensureRequiredAreaTraitsRegistered()
ensureRequiredAreaUpgradesRegistered()
// Expansion Phase 2 §2.2 — the three mechanical event types this module owns
// have to be on the registry before the response bridge routes its first hook,
// which can happen before any other area code runs.
ensureAreaScheduledEventsRegistered()

// Phase 8 §8.2 — Area module.
//
// Responsibilities:
//   - Verify the five required areas (`main_room`, `kitchen`, `cellar`,
//     `privy`, `roof`) exist on the current state.
//   - Apply daily passive decay through `ctx.modifyArea` with
//     `meta.source: 'areas'` (Phase 7 §7.3.1). All randomness comes from
//     the seeded `ctx.rng` (Phase 4); the simulation never uses the
//     unseeded global PRNG.
//   - Build the area report section consumed during `generateReports`.
//   - Run a structural validate pass over `state.areas` so impossible
//     shapes surface even when the engine bypasses full schema validation.
//
// Expansion Phase 2 §2.1–§2.5 — the module becomes the tavern's physical
// model and the one owner of the upgrade lifecycle (OBL-01). Added
// responsibilities:
//
//   - own every upgrade-record transition (`construction.ts`); owner actions,
//     scheduled events and propagation edges request transitions here rather
//     than writing `area.upgrades` themselves;
//   - derive usable capacity from base size + installed fittings − blockage
//     (`capacity.ts`) and publish the day's snapshot so service can read it;
//   - build the day's work schedule and let it gate which sites get labour
//     (`schedule.ts`);
//   - run the eight bounded propagation edges (`propagation.ts`);
//   - resolve the three future-hook families this domain can now honour
//     (`areaEvents.ts`).
//
// Hook beats and why:
//   startDay      reset the per-day slice lists (the upgrade records persist).
//   afterService  capacity snapshot + propagation. Runs here because occupancy
//                 comes from the customers module's `service` turnouts, and
//                 because `areasModule` precedes `customersModule` in the
//                 pipeline the snapshot is on state before customer
//                 satisfaction reads it in the same phase.
//   endDay        schedule → construction → upkeep → passive decay.

const SOURCE = 'areas'

const REQUIRED_AREA_IDS = ['main_room', 'kitchen', 'cellar', 'privy', 'roof'] as const

const startDayHook: SimulationHook = (ctx: SimContext): void => {
  for (const id of REQUIRED_AREA_IDS) {
    if (!ctx.state.areas[id]) {
      throw new Error(`areas module: required area '${id}' is missing from state`)
    }
  }
  // Expansion Phase 2 §5.11 — the four per-day lists are rebuilt from scratch
  // every morning, which is what bounds them. `totals` survives: it is the
  // lifetime record and is fixed-size.
  writeAreasSlice(
    ctx,
    (current) => ({ ...createInitialAreasModuleState(), totals: current.totals }),
    'day_initialize',
  )
}

/**
 * Expansion Phase 2 §2.1 / §2.4 — publish capacity, then propagate.
 *
 * The snapshot is written before the propagation pass so the report and the
 * customers module read the same numbers the edges acted on.
 */
const afterServiceHook: SimulationHook = (ctx: SimContext): void => {
  publishCapacitySnapshot(ctx)
  applyAreaPropagation(ctx)
}

const endDayHook: SimulationHook = (ctx: SimContext): void => {
  // The schedule is written first and then consulted by the construction tick:
  // a site whose block came out `conflicted` makes no progress today (§2.5).
  const schedule = buildAreaWorkSchedule(ctx.state)
  writeAreasSlice(ctx, (current) => ({ ...current, schedule }), 'work_schedule')
  tickConstruction(ctx)
  tickUpkeep(ctx)
  applyPassiveDecay(ctx)
}

/**
 * Write one capacity row per area, and count the day as overcrowded when the
 * pooled customer-facing seating could not hold the crowd.
 */
function publishCapacitySnapshot(ctx: SimContext): void {
  const turnouts =
    (ctx.state.modules['customers'] as
      | { turnouts?: ReadonlyArray<{ visitors: number }> }
      | undefined)?.turnouts ?? []
  const totalVisitors = turnouts.reduce((sum, t) => sum + Math.max(0, t.visitors), 0)
  const seating = getCustomerFacingSeating(ctx.state)

  const rows: AreaCapacitySnapshot[] = []
  for (const area of Object.values(ctx.state.areas)) {
    const installed = getInstalledAreaCapacity(area)
    const usable = getUsableAreaCapacity(area)
    const seats = capacityOf(installed, 'seats')
    const usableSeats = capacityOf(usable, 'seats')
    // Patrons are spread across the customer-facing rooms in proportion to the
    // seating each one actually offers, so a room's occupancy is a share of the
    // pool rather than the whole crowd counted once per room.
    const share =
      seating.usableSeats > 0 && area.tags.includes('customer_facing')
        ? usableSeats / seating.usableSeats
        : 0
    const occupancy = Math.round(totalVisitors * share)
    rows.push({
      areaId: area.id,
      seats,
      usableSeats,
      blockedSeats: seats - usableSeats,
      workstations: capacityOf(installed, 'workstations'),
      usableWorkstations: capacityOf(usable, 'workstations'),
      storage: capacityOf(installed, 'storage'),
      usableStorage: capacityOf(usable, 'storage'),
      occupancy,
      overflow: Math.max(0, occupancy - usableSeats),
    })
  }
  rows.sort((a, b) => a.areaId.localeCompare(b.areaId))
  writeAreasSlice(ctx, (current) => ({ ...current, capacity: rows }), 'capacity_snapshot')

  if (totalVisitors > seating.usableSeats && seating.usableSeats > 0) {
    bumpAreaTotal(ctx, 'overcrowdedDays', 1, 'overcrowded')
  }
}

// Phase 73 / ISSUE-033 §5.7 — areas with `ingredientYield` produce a
// per-week trickle of ingredients into stock. The herb garden is the
// only seeded area carrying this field; calendar tags listed in
// `boostedByCalendarTags` (e.g. `growing_season`) double the yield.
const endWeekHook: SimulationHook = (ctx: SimContext): void => {
  for (const def of areaRegistry.all()) {
    if (!def.ingredientYield) continue
    // The area must exist in state (i.e. it was seeded). New player-
    // built areas would be added to state and then become eligible.
    if (!ctx.state.areas[def.id]) continue
    const yieldDef = def.ingredientYield
    if (!(yieldDef.ingredientId in ctx.state.stock)) continue
    let quantity = yieldDef.perWeek
    const tags: ReadonlyArray<string> = ctx.state.calendar.tags
    if (yieldDef.boostedByCalendarTags.some((t) => tags.includes(t))) {
      quantity *= 2
    }
    // Expansion Phase 2 §2.4 — the garden-state → yield edge. The propagation
    // pass flags a neglected bed; this is where the flag costs something. It is
    // the consuming half of the edge, so the flag is never merely decorative.
    const areaState = ctx.state.areas[def.id]!
    if (areaState.activeProblems.includes('bed_neglected')) {
      quantity = Math.floor(quantity / 2)
    }
    if (quantity <= 0) continue
    const existing = ctx.state.stock[yieldDef.ingredientId]!
    ctx.modifyStock(
      yieldDef.ingredientId,
      { quantity: existing.quantity + quantity },
      {
        source: 'areas.ingredient_yield',
        sourceType: 'area',
        direction: 'increase',
        amount: quantity,
        readable: `${def.label} produced ${quantity} ${yieldDef.ingredientId} this week.`,
        tags: ['area', 'ingredient_yield', def.id, yieldDef.ingredientId],
        relatedActors: [{ kind: 'stock', id: yieldDef.ingredientId }],
        relatedLocations: [{ kind: 'area', id: def.id }],
        relatedSystems: ['areas', 'stock'],
      },
    )
  }
}

/**
 * Expansion Phase 1 §1.3 / §1.5 — apply one unit of ongoing area decay
 * through the shared ruleset and meter machinery.
 *
 * Two things happen that did not before:
 *
 *   1. the base delta is scaled by `areaDeteriorationMultiplier`, with the
 *      fractional remainder banked, so `easy` really does decay ~60% as fast
 *      rather than rounding back to the same integer (`OBL-05`);
 *   2. movement that the `[0,100]` clamp would have thrown away is recorded
 *      as meter debt or excess, so a room that has been filthy for a
 *      fortnight is no longer indistinguishable from one filthy since
 *      Tuesday.
 *
 * On `standard` the multiplier is exactly 1 and the banking is skipped
 * entirely, so the reference route's numbers are unchanged.
 */
function decayAreaField(
  ctx: SimContext,
  areaId: string,
  field: 'cleanliness' | 'condition' | 'smell' | 'risk',
  /** Signed: negative worsens a "higher is better" meter. */
  baseDelta: number,
  reason: string,
): void {
  const area = ctx.state.areas[areaId]
  if (!area) return

  const multiplier = getRule(ctx.state, 'areaDeteriorationMultiplier')
  const scaled = scaleOngoingIntegerDecay(
    ctx,
    `area_decay:${areaId}:${field}`,
    baseDelta,
    multiplier,
  )
  if (scaled === 0) return

  const previous = area[field]
  const desired = previous + scaled
  const visible = clampPercent(desired)

  if (visible !== previous) {
    ctx.modifyArea(areaId, { [field]: visible }, { source: SOURCE, reason })
  }

  // Recorded even when the visible value did not move — that is exactly the
  // case §1.5 exists for.
  recordMeterMovement(ctx, {
    target: `area:${areaId}.${field}`,
    previousVisible: previous,
    desired,
    visible,
  })
}

function applyPassiveDecay(ctx: SimContext): void {
  // Numbers are intentionally small. Phase 8 is about believable movement,
  // not balance — see `phases-06-10.md` §8.3 ("intentionally imperfect").

  decayAreaField(ctx, 'main_room', 'cleanliness', -1, 'passive_decay')

  const kitchen = ctx.state.areas['kitchen']
  if (kitchen) {
    // The roll is taken before scaling so the RNG draw is unchanged by
    // difficulty — otherwise `easy` and `standard` would diverge in every
    // downstream stream, not just in the decay this rule owns.
    const drift = ctx.rng.chance(0.5) ? 2 : 1
    decayAreaField(ctx, 'kitchen', 'cleanliness', -drift, 'passive_decay')
  }

  decayAreaField(ctx, 'privy', 'smell', 1, 'passive_decay')

  const cellar = ctx.state.areas['cellar']
  if (cellar && cellar.cleanliness < 40) {
    decayAreaField(ctx, 'cellar', 'risk', 1, 'pest_drift')
  }

  const roof = ctx.state.areas['roof']
  if (roof && ctx.rng.chance(0.2)) {
    decayAreaField(ctx, 'roof', 'condition', -1, 'weather_decay')
  }

  // Phase 28 §28.8 — a sticky floor catches an extra boot every couple
  // of days. The bump is deterministic (driven off `totalDaysElapsed`)
  // so replays are stable and a test can rely on a clear difference
  // between the trait present and trait absent — without leaning on the
  // RNG state, which other modules also draw from.
  const dayParity = ctx.state.calendar.totalDaysElapsed % 2
  const mainRoom = ctx.state.areas['main_room']
  if (mainRoom && mainRoom.traits.includes('sticky_floor') && dayParity === 0) {
    decayAreaField(ctx, 'main_room', 'risk', 1, 'sticky_floor_trait')
  }
}

function describeStatus(area: AreaState): string {
  if (isAreaInspectionRisk(area)) return 'Inspection risk'
  if (isAreaDamaged(area)) return 'Damaged'
  if (isAreaDangerous(area)) return 'Dangerous'
  if (isAreaFilthy(area)) return 'Filthy'
  return `Quality: ${getAreaQualityBand(area)}`
}

/**
 * Per-area capacity / construction / upkeep lines.
 *
 * Deliberately terse and silent-when-uninteresting: the report layer surfaces
 * simulation facts, it does not write cards.
 */
function describeAreaPhysicalLines(ctx: SimContext, area: AreaState): string[] {
  const lines: string[] = []
  const today = ctx.state.calendar.totalDaysElapsed

  const base = getBaseAreaCapacity(area.id)
  const installed = getInstalledAreaCapacity(area)
  const usable = getUsableAreaCapacity(area)
  const blocked = getAreaBlockedFraction(area)
  const parts: string[] = []
  for (const kind of ['seats', 'workstations', 'storage', 'beds'] as const) {
    const total = capacityOf(installed, kind)
    if (total === 0) continue
    const use = capacityOf(usable, kind)
    const added = total - capacityOf(base, kind)
    parts.push(
      `${kind} ${use}/${total}` + (added > 0 ? ` (+${added} from fittings)` : ''),
    )
  }
  if (parts.length > 0) {
    lines.push(`  Capacity: ${parts.join(', ')}`)
  }
  if (blocked > 0) {
    lines.push(`  ${Math.round(blocked * 100)}% of the room is out of use`)
  }

  for (const record of Object.values(area.upgrades).sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const def = areaUpgradeRegistry.has(record.id)
      ? areaUpgradeRegistry.get(record.id)
      : undefined
    const label = def?.label ?? record.id
    if (record.status === 'in_progress' || record.status === 'paused') {
      const state = record.status === 'paused' ? 'paused' : 'building'
      lines.push(
        `  ${label}: ${state} ${record.progress ?? 0}/${record.requiredProgress ?? 0} labour` +
          (record.stalledReason ? ` — stalled: ${record.stalledReason}` : ''),
      )
      continue
    }
    if (record.status === 'damaged' || record.status === 'disabled') {
      lines.push(
        `  ${label}: ${record.status} (condition ${record.condition ?? 0})` +
          (record.disabledReason ? ` — ${record.disabledReason}` : ''),
      )
      continue
    }
    if (record.status === 'installed' && record.upkeepDueDay !== undefined) {
      const overdue = today - record.upkeepDueDay
      if (overdue > 0) {
        lines.push(
          `  ${label}: service ${overdue} day${overdue === 1 ? '' : 's'} overdue (condition ${record.condition ?? 100})`,
        )
      } else if (overdue >= -2) {
        lines.push(`  ${label}: service due in ${-overdue} day(s)`)
      }
    }
  }

  return lines
}

function buildAreaReport(ctx: SimContext): ReportSection {
  const areas = Object.values(ctx.state.areas)
  const lines: string[] = []
  for (const area of areas) {
    lines.push(`${area.label}`)
    lines.push(`  Condition: ${area.condition}`)
    lines.push(`  Cleanliness: ${area.cleanliness}`)
    lines.push(`  Damage: ${area.damage}`)
    lines.push(`  Smell: ${area.smell}`)
    lines.push(`  Risk: ${area.risk}`)
    lines.push(`  Status: ${describeStatus(area)}`)

    // Phase 28 §28.7 — compact identity lines. We deliberately keep
    // these one-line summaries: the report layer is not a card writer,
    // it is the simulation surfacing facts.
    const atmosphereLine = describeAreaAtmosphere(area)
    if (atmosphereLine.length > 0) {
      lines.push(`  Atmosphere: ${atmosphereLine.join(', ')}`)
    }
    const installed = getInstalledUpgradeIds(area)
    if (installed.length > 0) {
      lines.push(`  Upgrades installed: ${installed.join(', ')}`)
    }
    const availableUpgrade = pickSuggestedUpgrade(area)
    if (availableUpgrade) {
      lines.push(`  Upgrade available: ${availableUpgrade}`)
    }

    // Expansion Phase 2 §"Player-facing work" — capacity, blockage,
    // construction progress and upkeep, reported wherever they are non-trivial.
    // Silent on a room with no capacity and no work, so a plain tavern's report
    // reads as it always did.
    for (const line of describeAreaPhysicalLines(ctx, area)) lines.push(line)
  }

  let worstArea: AreaState | undefined
  for (const area of areas) {
    if (!worstArea || area.condition < worstArea.condition) {
      worstArea = area
    }
  }
  if (worstArea) {
    lines.push('')
    lines.push(`Worst area: ${worstArea.label} (condition ${worstArea.condition})`)
  }

  const slice = getAreasModuleState(ctx.state)
  const seating = getCustomerFacingSeating(ctx.state)
  const occupancy = slice.capacity.reduce((sum, row) => sum + row.occupancy, 0)
  if (seating.seats > 0) {
    lines.push('')
    lines.push(
      `Seating: ${seating.usableSeats}/${seating.seats} usable` +
        (seating.blockedSeats > 0 ? ` (${seating.blockedSeats} closed off)` : '') +
        (occupancy > 0 ? `, ${occupancy} patrons held` : ''),
    )
    if (occupancy > seating.usableSeats) {
      lines.push(
        `  Overcrowded by ${occupancy - seating.usableSeats} — mess, wear and tempers all rise.`,
      )
    }
  }

  const conflicts = slice.schedule.filter((block) => block.status === 'conflicted')
  if (slice.construction.length > 0 || conflicts.length > 0) {
    lines.push('')
    lines.push('Work in hand:')
    for (const entry of slice.construction) {
      lines.push(`  ${entry.readable}`)
    }
    for (const block of conflicts) {
      lines.push(`  ${block.label}: ${block.conflictReason ?? 'blocked'}`)
    }
  }

  if (slice.propagation.length > 0) {
    lines.push('')
    lines.push('Knock-on effects:')
    for (const entry of slice.propagation) {
      lines.push(`  ${entry.readable} (${entry.reason})`)
    }
  }

  return {
    id: 'areas',
    source: SOURCE,
    title: 'AREA REPORT',
    lines,
    data: {
      worstAreaId: worstArea?.id,
      worstAreaCondition: worstArea?.condition,
      // Expansion Phase 2 — the physical facts the projection layer reads
      // rather than re-deriving.
      seats: seating.seats,
      usableSeats: seating.usableSeats,
      occupancy,
      activeSites: listActiveSites(ctx.state).length,
      scheduleConflicts: conflicts.length,
      propagationEdgesFired: slice.propagation.map((entry) => entry.edgeId),
    },
  }
}

// Phase 28 §28.7 — pick a single upgrade label per area to surface in
// the report. We prefer upgrades that are not already installed and
// that fit this area's id, but skip silently when nothing is available.
// This keeps the area report compact rather than dumping the whole
// upgrade catalogue every day.
function pickSuggestedUpgrade(area: AreaState): string | undefined {
  for (const def of areaUpgradeRegistry.all()) {
    if (def.allowedAreaIds && !def.allowedAreaIds.includes(area.id)) continue
    if (def.allowedAreaTags && !def.allowedAreaTags.some((t) => area.tags.includes(t))) {
      continue
    }
    const existing = area.upgrades[def.id]
    if (existing && existing.status === 'installed') continue
    return def.label
  }
  return undefined
}

function validateAreas(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const id of REQUIRED_AREA_IDS) {
    if (!ctx.state.areas[id]) {
      issues.push({
        path: `areas.${id}`,
        message: `Required area '${id}' is missing`,
        code: 'missing_required_area',
      })
    }
  }
  return issues
}

// Phase 6 §6.1.1 reserved `state.modules.areas` with an empty passthrough
// object. Expansion Phase 2 §2.1 fills the slot: the schema now lives with the
// slice in `state.ts`, and every field in it is optional so a save carrying the
// old reserved `{}` still validates rather than bouncing.

export const areasModule: SimulationModule = {
  id: 'areas',
  version: '0.1.0',
  hooks: {
    startDay: [startDayHook],
    // Expansion Phase 2 §2.1 / §2.4 — capacity snapshot + propagation, after
    // the day's turnouts exist and before customer satisfaction reads them.
    afterService: [afterServiceHook],
    endDay: [endDayHook],
    // Phase 73 / ISSUE-033 §5.7 — ingredient yield from gameplay-
    // bearing areas (herb_garden).
    endWeek: [endWeekHook],
  },
  buildReport: buildAreaReport,
  validate: validateAreas,
  stateSchema: AreasModuleStateSchema,
}

// Re-export so callers that prefer to read areas via the registry have a
// single place to import. Keeping the helper exported also lets tests
// (and future host environments) re-seed the registry deterministically.
export { areaRegistry, ensureRequiredAreasRegistered }
export {
  getAreaQualityBand,
  isAreaFilthy,
  isAreaDamaged,
  isAreaDangerous,
  isAreaInspectionRisk,
} from './derived'
