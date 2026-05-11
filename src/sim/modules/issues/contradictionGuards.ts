import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import type { IssueSeed, IssueSeedFamilyId } from './issueSeedTypes'

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

/** Each family's guard. Returns null/undefined when allowed. */
export const CONTRADICTION_GUARDS: Record<
  IssueSeedFamilyId,
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
    // Only emits on end of month.
    if (!ctx.isEndOfMonth()) {
      return { allowed: false, reason: 'Not end of month' }
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
