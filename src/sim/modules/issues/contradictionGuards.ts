import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import type {
  CoreIssueSeedFamilyId,
  IssueSeed,
  IssueSeedFamilyId,
} from './issueSeedTypes'
import { listActiveArcs } from '../localArcs/arcEngine'

// Phase 19 §19.6 — Contradiction guards.
//
// A contradiction guard inspects the current simulation state for a given
// seed family and returns `null` when generation is allowed, or a reason
// string when the family must NOT generate a seed.
//
// Guards run BEFORE generation, so the simulation never produces seeds
// that contradict the visible state — the rule the §4.10 conditions
// list as "no contradictions".

export type ContradictionResult = { allowed: boolean; reason?: string }

const ALE_HIGH_THRESHOLD = 50

function aleStockQuantity(state: TavernState): number {
  return state.stock.ale?.quantity ?? 0
}

function stewStockQuantity(state: TavernState): number {
  return state.stock.stew?.quantity ?? 0
}

function totalUnpaidStaff(state: TavernState): number {
  let count = 0
  for (const id of Object.keys(state.staff)) {
    const s = state.staff[id]!
    if (!s.paidThisWeek) count += 1
  }
  return count
}

function merchantsRecentlyVisited(state: TavernState): boolean {
  const merchants = state.customerGroups.merchants
  if (!merchants) return false
  return merchants.patronage > 10
}

function inspectionPressureValue(state: TavernState): number {
  return state.pressures.inspection?.value ?? 0
}

function recentMemoryToday(
  ctx: SimContext,
  memoryId: string,
): boolean {
  const memory = ctx.state.memories.find((m) => m.id === memoryId)
  if (!memory) return false
  return memory.ageDays <= 0
}

/** Each family's guard. Returns null/undefined when allowed.
 *  The map is keyed by the core family ids; expanded families (Phase 39)
 *  rely on entity-existence guards exported below rather than a single
 *  family-wide veto. */
export const CONTRADICTION_GUARDS: Record<
  CoreIssueSeedFamilyId,
  (ctx: SimContext) => ContradictionResult
> = {
  food_safety(ctx) {
    // No contradiction guard beyond pressure threshold — the generator
    // itself checks for spoilage/cleanliness. Allow.
    return { allowed: true }
  },
  stock_shortage(ctx) {
    if (aleStockQuantity(ctx.state) >= ALE_HIGH_THRESHOLD &&
        stewStockQuantity(ctx.state) >= ALE_HIGH_THRESHOLD) {
      return { allowed: false, reason: 'Stock is high — no shortage to surface' }
    }
    return { allowed: true }
  },
  maintenance(ctx) {
    const maxDamage = Math.max(
      ...Object.values(ctx.state.areas).map((a) => a.damage),
    )
    const minCondition = Math.min(
      ...Object.values(ctx.state.areas).map((a) => a.condition),
    )
    if (maxDamage < 30 && minCondition > 60) {
      return { allowed: false, reason: 'All areas are in good repair' }
    }
    return { allowed: true }
  },
  staff_burnout(ctx) {
    const staff = Object.values(ctx.state.staff)
    const allHappy = staff.every(
      (s) => s.morale > 60 && s.stress < 40 && s.fatigue < 40 && s.paidThisWeek,
    )
    if (allHappy) {
      return { allowed: false, reason: 'Staff are in good shape' }
    }
    return { allowed: true }
  },
  customer_complaint(ctx) {
    // Phase 19 §19.6 — "Do not generate merchant complaint if merchants
    // have not visited recently and satisfaction is high."
    return { allowed: true }
  },
  violence(ctx) {
    const ogres = ctx.state.customerGroups.ogres
    const adventurers = ctx.state.customerGroups.adventurers
    const rowdyPatronage =
      (ogres?.patronage ?? 0) + (adventurers?.patronage ?? 0)
    const danger = ctx.state.reputation.dangerous
    if (rowdyPatronage < 10 && danger < 25) {
      return { allowed: false, reason: 'No rowdy customers and low danger' }
    }
    return { allowed: true }
  },
  debt_rent(ctx) {
    // Allowed when coin is low, rent due/missed, or debt pressure high.
    return { allowed: true }
  },
  inspection(ctx) {
    if (inspectionPressureValue(ctx.state) < 35) {
      return { allowed: false, reason: 'Inspection pressure is low' }
    }
    if (recentMemoryToday(ctx, 'inspection_passed_recently')) {
      return {
        allowed: false,
        reason: 'Inspection was just passed — no warning needed',
      }
    }
    return { allowed: true }
  },
  reputation_shift(ctx) {
    return { allowed: true }
  },
  monthly_review(ctx) {
    // Phase 186 / Cluster 4 — re-homed from the month-end closing deck to
    // the first morning of the *next* month, where the player acts on the
    // just-finalized month's review as a standing reflection (contract
    // §3.5). Fires once per month: `lastMonthlyResult` must be present
    // (written by the previous day's `endMonth` rollup and persisted), and
    // the calendar must have ticked to day 1 of the new month. On day 1 of
    // month 1 there is no prior month, so `lastMonthlyResult` is absent and
    // the guard blocks; on days 2–28 `calendar.day !== 1` blocks
    // regeneration.
    const monthly = ctx.state.modules.monthly as
      | { lastMonthlyResult?: unknown }
      | undefined
    if (!monthly?.lastMonthlyResult) {
      return { allowed: false, reason: 'No finalized month to review yet' }
    }
    if (ctx.state.calendar.day !== 1) {
      return {
        allowed: false,
        reason: 'Monthly review surfaces on the first morning of the new month',
      }
    }
    return { allowed: true }
  },
}

/** Per-template contradiction guards. More fine-grained than family
 *  guards. Templates may override the family guard's allowed/false. */
export type TemplateContradictionGuard = (
  ctx: SimContext,
) => ContradictionResult

export function aleStockHighGuard(ctx: SimContext): ContradictionResult {
  if (aleStockQuantity(ctx.state) >= ALE_HIGH_THRESHOLD) {
    return {
      allowed: false,
      reason: `Ale stock is high (${aleStockQuantity(ctx.state)})`,
    }
  }
  return { allowed: true }
}

export function unpaidWagesGuard(ctx: SimContext): ContradictionResult {
  if (totalUnpaidStaff(ctx.state) === 0) {
    return { allowed: false, reason: 'All staff have been paid' }
  }
  return { allowed: true }
}

export function merchantPresenceGuard(ctx: SimContext): ContradictionResult {
  const merchants = ctx.state.customerGroups.merchants
  if (!merchants) {
    return { allowed: false, reason: 'Merchants do not exist' }
  }
  if (
    !merchantsRecentlyVisited(ctx.state) &&
    merchants.satisfaction > 60
  ) {
    return {
      allowed: false,
      reason: 'Merchants have not visited and are satisfied',
    }
  }
  return { allowed: true }
}

export function roofRepairedTodayGuard(ctx: SimContext): ContradictionResult {
  if (recentMemoryToday(ctx, 'roof_patched_recently')) {
    return {
      allowed: false,
      reason: 'Roof was just patched',
    }
  }
  return { allowed: true }
}

// Phase 39 §39.15 — Expanded entity-existence guards.
//
// The expanded seed families name persistent world entities (suppliers,
// regulars, factions, cultures, local arcs, policies, projects, rumours,
// staff, area traits). Each guard verifies that the named entity still
// exists / is still active before its seed may generate. A seed pointing
// at a banned regular or a repealed policy would contradict the visible
// state.

export function supplierExistsGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  const supplier = ctx.state.world.suppliers[ref.id]
  if (!supplier) {
    return { allowed: false, reason: `Supplier ${ref.id} no longer exists` }
  }
  return { allowed: true }
}

export function regularExistsGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  const regular = ctx.state.world.regulars[ref.id]
  if (!regular) {
    return { allowed: false, reason: `Regular ${ref.id} no longer exists` }
  }
  return { allowed: true }
}

export function factionExistsGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  const faction = ctx.state.world.factions[ref.id]
  if (!faction) {
    return { allowed: false, reason: `Faction ${ref.id} no longer exists` }
  }
  return { allowed: true }
}

export function cultureExistsGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  const culture = ctx.state.world.cultures[ref.id]
  if (!culture) {
    return { allowed: false, reason: `Culture ${ref.id} no longer exists` }
  }
  return { allowed: true }
}

export function activeArcExistsGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  for (const arc of listActiveArcs(ctx.state)) {
    if (arc.id === ref.id) return { allowed: true }
  }
  return { allowed: false, reason: `Arc ${ref.id} is not active` }
}

export function policyStillActiveGuard(
  ctx: SimContext,
  policyId: string,
): ContradictionResult {
  const owner = ctx.state.modules.ownerActions as
    | { policies?: Record<string, { id: string; enabled: boolean }> }
    | undefined
  const policy = owner?.policies?.[policyId]
  if (!policy || !policy.enabled) {
    return { allowed: false, reason: `Policy ${policyId} is no longer active` }
  }
  return { allowed: true }
}

export function projectStillIncompleteGuard(
  ctx: SimContext,
  projectId: string,
): ContradictionResult {
  const owner = ctx.state.modules.ownerActions as
    | { projects?: Record<string, { id: string; status: string }> }
    | undefined
  const project = owner?.projects?.[projectId]
  if (!project) {
    return { allowed: false, reason: `Project ${projectId} does not exist` }
  }
  if (project.status !== 'active') {
    return {
      allowed: false,
      reason: `Project ${projectId} is ${project.status}`,
    }
  }
  return { allowed: true }
}

export function rumourStillActiveGuard(
  ctx: SimContext,
  rumourId: string,
): ContradictionResult {
  const rumour = ctx.state.world.socialRumours[rumourId]
  if (!rumour) {
    return { allowed: false, reason: `Rumour ${rumourId} no longer exists` }
  }
  if (rumour.strength <= 0) {
    return { allowed: false, reason: `Rumour ${rumourId} has faded` }
  }
  return { allowed: true }
}

export function staffStillEmployedGuard(
  ctx: SimContext,
  ref: EntityRef,
): ContradictionResult {
  const staff = ctx.state.staff[ref.id]
  if (!staff) {
    return { allowed: false, reason: `Staff ${ref.id} no longer employed` }
  }
  if (staff.unavailable) {
    return { allowed: false, reason: `Staff ${ref.id} is unavailable` }
  }
  return { allowed: true }
}

export function areaTraitStillPresentGuard(
  ctx: SimContext,
  areaId: string,
  trait: string,
): ContradictionResult {
  const area = ctx.state.areas[areaId] as
    | { id: string; tags: string[]; activeFlags?: string[] }
    | undefined
  if (!area) {
    return { allowed: false, reason: `Area ${areaId} does not exist` }
  }
  if (!area.tags.includes(trait) && !(area.activeFlags ?? []).includes(trait)) {
    return { allowed: false, reason: `Area ${areaId} no longer has trait ${trait}` }
  }
  return { allowed: true }
}

/** Phase 39 §39.15 — registry of expanded entity-existence guards. */
export const EXPANDED_CONTRADICTION_GUARDS = {
  supplierExistsGuard,
  regularExistsGuard,
  factionExistsGuard,
  cultureExistsGuard,
  activeArcExistsGuard,
  policyStillActiveGuard,
  projectStillIncompleteGuard,
  rumourStillActiveGuard,
  staffStillEmployedGuard,
  areaTraitStillPresentGuard,
} as const
