import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

// Expansion Phase 2 §2.1–§2.5 — the areas module's own slice.
//
// Before this phase `state.modules.areas` was a reserved empty object: the
// module decayed six meters and printed a report, and owned no state of its
// own. It now owns the four per-day records that make the physical model
// legible — the work schedule, what the construction sites did, which
// propagation edges fired, and what capacity actually looked like under
// load — plus lifetime counters.
//
// The upgrade records themselves deliberately do NOT live here. They live on
// `AreaState.upgrades`, which is the one authoritative construction record
// (§2.2). This slice is the day's *bookkeeping about* those records, and
// every list in it is rebuilt from scratch each morning, which is what keeps
// it bounded (§5.11): the schedule is at most one block per site plus one
// per staff member, the construction log at most one entry per live site,
// the propagation log at most one entry per declared edge, and the capacity
// snapshot exactly one entry per area.

export const AREAS_MODULE_ID = 'areas'

export type AreaWorkBlockKind = 'construction' | 'upkeep' | 'repair'

/**
 * §2.5 — one accepted piece of work, placed inside the day.
 *
 * The player never arranges minutes by hand: blocks are DERIVED from what
 * is live (running builds, assigned staff, the owner actions the player
 * queued), and their job is to explain concurrency and conflicts. A block
 * that could not be placed is kept with `status: 'conflicted'` and a reason
 * rather than dropped, because "why did nothing happen on the cellar today"
 * is exactly the question this record exists to answer.
 */
export type AreaWorkBlock = {
  id: string
  kind: AreaWorkBlockKind
  areaId: string
  upgradeId?: string
  /** Who works it. Staff blocks name the member; owner blocks do not. */
  actorKind: 'owner' | 'staff' | 'site'
  actorId?: string
  label: string
  /** Minutes the block occupies of its actor's day. */
  minutes: number
  /** Minute offset within the actor's own working day. */
  startMinute: number
  /** Set when the block holds an exclusive workstation in `areaId`. */
  holdsWorkstation: boolean
  status: 'scheduled' | 'conflicted'
  /** Mandatory whenever `status` is `conflicted`. */
  conflictReason?: string
}

/** §2.3 — what one construction site actually managed today. */
export type AreaConstructionLogEntry = {
  areaId: string
  upgradeId: string
  labourAdded: number
  progress: number
  requiredProgress: number
  /** `site`, `staff:<id>`, `owner` — who contributed labour. */
  contributors: string[]
  /** Set when the site produced no progress; always explains itself. */
  stalledReason?: string
  readable: string
}

/** §2.4 — one propagation edge that actually fired today. */
export type AreaPropagationEntry = {
  edgeId: string
  fromAreaId: string
  /** Absent for edges whose consequence lands outside the area graph. */
  toAreaId?: string
  /** The physical route the effect travelled. Never decorative. */
  reason: string
  readable: string
}

/** §2.1 — capacity as it actually stood under the day's load. */
export type AreaCapacitySnapshot = {
  areaId: string
  /** Base + installed fittings, before blockage. */
  seats: number
  /** After construction blockage and damage. What patrons could use. */
  usableSeats: number
  blockedSeats: number
  workstations: number
  usableWorkstations: number
  storage: number
  usableStorage: number
  /** Patrons the area actually had to hold. */
  occupancy: number
  /** `occupancy - usableSeats`, floored at 0. */
  overflow: number
}

export type AreasModuleState = {
  schedule: AreaWorkBlock[]
  construction: AreaConstructionLogEntry[]
  propagation: AreaPropagationEntry[]
  capacity: AreaCapacitySnapshot[]
  /** Lifetime counters. Fixed size, so they cannot grow a save. */
  totals: {
    upgradesStarted: number
    upgradesInstalled: number
    upgradesCancelled: number
    upgradesDamaged: number
    upgradesRepaired: number
    upkeepsServiced: number
    labourApplied: number
    overcrowdedDays: number
  }
}

export function createInitialAreasModuleState(): AreasModuleState {
  return {
    schedule: [],
    construction: [],
    propagation: [],
    capacity: [],
    totals: {
      upgradesStarted: 0,
      upgradesInstalled: 0,
      upgradesCancelled: 0,
      upgradesDamaged: 0,
      upgradesRepaired: 0,
      upkeepsServiced: 0,
      labourApplied: 0,
      overcrowdedDays: 0,
    },
  }
}

/**
 * Read the slice, filling in anything a pre-Phase-2 save omits.
 *
 * Saves written before this phase carry the reserved empty object `{}` here,
 * so every field has to be defaulted rather than assumed present.
 */
function normalizeSlice(
  slice: Partial<AreasModuleState> | undefined,
): AreasModuleState {
  const base = createInitialAreasModuleState()
  if (!slice) return base
  return {
    schedule: slice.schedule ?? base.schedule,
    construction: slice.construction ?? base.construction,
    propagation: slice.propagation ?? base.propagation,
    capacity: slice.capacity ?? base.capacity,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getAreasModuleState(state: TavernState): AreasModuleState {
  return normalizeSlice(
    state.modules[AREAS_MODULE_ID] as Partial<AreasModuleState> | undefined,
  )
}

export function writeAreasSlice(
  ctx: SimContext,
  updater: (current: AreasModuleState) => AreasModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<AreasModuleState>(
    AREAS_MODULE_ID,
    (current) => updater(normalizeSlice(current)),
    { source: `areas.${reason}`, reason },
  )
}

/** Bump one lifetime counter. */
export function bumpAreaTotal(
  ctx: SimContext,
  key: keyof AreasModuleState['totals'],
  by = 1,
  reason = 'totals',
): void {
  writeAreasSlice(
    ctx,
    (current) => ({
      ...current,
      totals: { ...current.totals, [key]: current.totals[key] + by },
    }),
    reason,
  )
}

// ---------- Schemas (§5.7: persisted field, schema in the same phase) ----------

const AreaWorkBlockSchema = z.object({
  id: z.string(),
  kind: z.enum(['construction', 'upkeep', 'repair']),
  areaId: z.string(),
  upgradeId: z.string().optional(),
  actorKind: z.enum(['owner', 'staff', 'site']),
  actorId: z.string().optional(),
  label: z.string(),
  minutes: z.number().min(0),
  startMinute: z.number().min(0),
  holdsWorkstation: z.boolean(),
  status: z.enum(['scheduled', 'conflicted']),
  conflictReason: z.string().optional(),
})

const AreaConstructionLogEntrySchema = z.object({
  areaId: z.string(),
  upgradeId: z.string(),
  labourAdded: z.number(),
  progress: z.number().min(0),
  requiredProgress: z.number().min(0),
  contributors: z.array(z.string()),
  stalledReason: z.string().optional(),
  readable: z.string(),
})

const AreaPropagationEntrySchema = z.object({
  edgeId: z.string(),
  fromAreaId: z.string(),
  toAreaId: z.string().optional(),
  reason: z.string(),
  readable: z.string(),
})

const AreaCapacitySnapshotSchema = z.object({
  areaId: z.string(),
  seats: z.number().min(0),
  usableSeats: z.number().min(0),
  blockedSeats: z.number().min(0),
  workstations: z.number().min(0),
  usableWorkstations: z.number().min(0),
  storage: z.number().min(0),
  usableStorage: z.number().min(0),
  occupancy: z.number().min(0),
  overflow: z.number().min(0),
})

export const AreasModuleStateSchema = z
  .object({
    schedule: z.array(AreaWorkBlockSchema).optional(),
    construction: z.array(AreaConstructionLogEntrySchema).optional(),
    propagation: z.array(AreaPropagationEntrySchema).optional(),
    capacity: z.array(AreaCapacitySnapshotSchema).optional(),
    totals: z
      .object({
        upgradesStarted: z.number().int().min(0),
        upgradesInstalled: z.number().int().min(0),
        upgradesCancelled: z.number().int().min(0),
        upgradesDamaged: z.number().int().min(0),
        upgradesRepaired: z.number().int().min(0),
        upkeepsServiced: z.number().int().min(0),
        labourApplied: z.number().min(0),
        overcrowdedDays: z.number().int().min(0),
      })
      .optional(),
  })
  // Every field is optional so the reserved `{}` a pre-Phase-2 save carries
  // still validates — the loader repairs it, it does not bounce.
  .optional()
