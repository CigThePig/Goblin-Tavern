import { staffPriorityRegistry } from '../../registries/staffPriorityRegistry'
import type {
  StaffPriorityId,
  StaffState,
  StaffWorkStyle,
} from '../../state/TavernState'
import {
  canStaffWork,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffMoraleBonus,
  getStaffStressPenalty,
} from './performance'
import type {
  ServiceQualityModifiers,
  StaffEffectivenessSummary,
} from './types'
import type { StaffRosterEntry } from './workforceTypes'

// Phase 11 §11.5 — Priority effects, channelled via shared service
// modifiers.
//
// `derivePriorityModifiers` translates a staff member's effectiveness
// and current priority into a partial `ServiceQualityModifiers`. The
// values are intentionally additive and bounded so Phase 12 can
// compose them without reaching into staff internals (the §11.5
// "Good vs Bad" rule). Magnitudes scale with `effectiveness / 100`
// — an overworked staff member with a clear priority still helps,
// just less.

const PER_PRIORITY: Record<StaffPriorityId, Partial<ServiceQualityModifiers>> = {
  // Cook
  quality: { foodQualityModifier: 1, serviceSpeed: -0.2 },
  speed: { serviceSpeed: 1, foodQualityModifier: -0.2 },
  stretch_ingredients: { foodQualityModifier: -0.3, serviceSpeed: 0.1 },
  clean_as_you_go: { messControl: 0.6, serviceSpeed: -0.2 },

  // Server
  maximize_sales: { serviceSpeed: 0.6, tabControl: -0.5 },
  keep_customers_happy: { foodQualityModifier: 0.3, serviceSpeed: 0.3, tabControl: -0.1 },
  watch_tabs: { tabControl: 1, serviceSpeed: -0.3 },
  help_clean: { messControl: 0.5, serviceSpeed: -0.4 },

  // Cleaner/bouncer
  clean: { messControl: 1, fightControl: 0.2 },
  minor_repairs: { repairSupport: 1, messControl: 0.2 },
  prevent_fights: { fightControl: 1 },
  intimidate_debtors: { tabControl: 0.8 },
}

// Phase 78 / ISSUE-038 — cook-family roles modulate `foodQualityModifier`
// and server-family roles modulate `serviceSpeed` based on `skill`.
// Before this phase a master_chef on `quality` produced the same daily
// food quality as a kitchen_hand on `quality`; only the prep gate in
// `service/recipes.ts` differentiated them. The role-skill bias here
// is monotonic in skill, bounded at ±0.25, and routed through the same
// `scaleByEffectiveness` pipeline as the priority contribution so
// morale / stress / fatigue still suppress it.
const COOK_ROLE_IDS: ReadonlySet<string> = new Set([
  'cook',
  'kitchen_hand',
  'seasoned_cook',
  'master_chef',
])
const SERVER_ROLE_IDS: ReadonlySet<string> = new Set(['server'])

function skillBias(skill: number): number {
  // (skill - 50) / 200 → -0.25 (skill 0) to +0.25 (skill 100). At the
  // canonical cook skill of 55 this is ~+0.025; at master_chef 85,
  // +0.175. Small enough that priority remains the dominant signal,
  // big enough that a master/kitchen_hand pair produces a noticeable
  // satisfaction-delta gap on the same priority.
  return (skill - 50) / 200
}

// Phase 31 §31.9 — small, additive work-style nudges on top of the
// per-priority modifiers above. Intentionally tiny: priority is still
// the dominant signal, identity merely flavours it. Values are not
// scaled by effectiveness — they are flat per-staff contributions so
// the work-style "feel" reads even when a staff member is exhausted.
const PER_WORKSTYLE: Record<StaffWorkStyle, Partial<ServiceQualityModifiers>> = {
  fast: { serviceSpeed: 0.1 },
  careful: { foodQualityModifier: 0.1, serviceSpeed: -0.05 },
  rough: { fightControl: 0.1 },
  steady: { messControl: 0.05, tabControl: 0.05 },
  social: { tabControl: 0.05, serviceSpeed: 0.05 },
  methodical: { repairSupport: 0.1, serviceSpeed: -0.05 },
  improviser: { foodQualityModifier: 0.05, serviceSpeed: 0.05 },
}

function emptyModifiers(): ServiceQualityModifiers {
  return {
    foodQualityModifier: 0,
    serviceSpeed: 0,
    tabControl: 0,
    messControl: 0,
    fightControl: 0,
    repairSupport: 0,
    staffSummaries: [],
  }
}

function scaleByEffectiveness(value: number, effectiveness: number): number {
  // Effectiveness 0–100. The 50-point baseline is a "normal day" — at
  // 50 effectiveness the priority delivers its nominal value; at 100
  // it delivers double; at 0 the priority is essentially absent.
  return value * (effectiveness / 50)
}

export function summarizeStaff(
  staff: StaffState,
): StaffEffectivenessSummary {
  return {
    staffId: staff.id,
    roleId: staff.role,
    priorityId: staff.currentPriority,
    effectiveness: getStaffEffectiveness(staff),
    stressPenalty: getStaffStressPenalty(staff),
    fatiguePenalty: getStaffFatiguePenalty(staff),
    moraleBonus: getStaffMoraleBonus(staff),
    canWork: canStaffWork(staff),
  }
}

/**
 * Expansion Phase 3 §3.2 — the roster is what a member's published modifiers are
 * SCALED BY.
 *
 * `roster` is optional so the pure Phase 11 signature (a list of staff and
 * nothing else) still works for the many callers that only want the shape of the
 * modifiers. When it is supplied — which is every production call — each
 * member's contribution multiplies their whole contribution to the day, and a
 * member with no roster row at all is treated as not having worked. That single
 * multiplier is what makes "service outputs traceable to actual assignment and
 * staff state" a property of the code rather than a claim about it: the roster
 * row carries the factors, this applies them, and the STAFF REPORT prints both.
 */
export function derivePriorityModifiers(
  staffMembers: ReadonlyArray<StaffState>,
  roster?: ReadonlyArray<StaffRosterEntry>,
): ServiceQualityModifiers {
  const result = emptyModifiers()
  const byStaffId = new Map(
    (roster ?? []).map((row) => [row.staffId, row] as const),
  )

  for (const staff of staffMembers) {
    const summary = summarizeStaff(staff)
    result.staffSummaries.push(summary)
    if (!summary.canWork) continue
    if (!staff.currentPriority) continue
    if (!staffPriorityRegistry.has(staff.currentPriority)) continue

    const contribution = PER_PRIORITY[staff.currentPriority]
    if (!contribution) continue

    // No roster at all: the caller wants the unscaled Phase 11 reading, so
    // treat every member as fully assigned. A roster that exists but has no row
    // for this member means they were not on it, and they contribute nothing.
    const assignment = byStaffId.get(staff.id)
    const assignmentFactor =
      roster === undefined
        ? 1
        : (assignment?.contribution ?? 0)
    if (assignmentFactor <= 0) continue
    // Earned through a supported kitchen initiative; disappears from service
    // when its owner is absent. A title alone never staffs a kitchen.
    const earnedBonus = (tag: string, amount: number) =>
      staff.tags.includes(tag) ? amount : staff.tags.includes(`${tag}_steady`) ? amount / 2 : 0
    result.foodQualityModifier += earnedBonus('kitchen_mentor', 0.5) * assignmentFactor
    result.serviceSpeed += earnedBonus('trusted_host', 0.4) * assignmentFactor
    result.messControl += earnedBonus('house_steward', 0.4) * assignmentFactor

    const eff = summary.effectiveness * assignmentFactor
    result.foodQualityModifier += scaleByEffectiveness(
      contribution.foodQualityModifier ?? 0,
      eff,
    )
    result.serviceSpeed += scaleByEffectiveness(
      contribution.serviceSpeed ?? 0,
      eff,
    )
    result.tabControl += scaleByEffectiveness(
      contribution.tabControl ?? 0,
      eff,
    )
    result.messControl += scaleByEffectiveness(
      contribution.messControl ?? 0,
      eff,
    )
    result.fightControl += scaleByEffectiveness(
      contribution.fightControl ?? 0,
      eff,
    )
    result.repairSupport += scaleByEffectiveness(
      contribution.repairSupport ?? 0,
      eff,
    )

    // Phase 78 / ISSUE-038 — cook-tier skill bias on foodQualityModifier
    // and server skill bias on serviceSpeed. Routed through
    // scaleByEffectiveness so a stressed master_chef still beats an
    // unstressed kitchen_hand on the same priority, but only by the
    // appropriate margin.
    if (COOK_ROLE_IDS.has(staff.role)) {
      result.foodQualityModifier += scaleByEffectiveness(
        skillBias(staff.skill),
        eff,
      )
    }
    if (SERVER_ROLE_IDS.has(staff.role)) {
      result.serviceSpeed += scaleByEffectiveness(
        skillBias(staff.skill),
        eff,
      )
    }

    // Phase 31 §31.9 — small flat nudge from the staff member's work
    // style. Identity must not dominate the numeric staff system, so
    // the magnitudes here are roughly an order of magnitude below the
    // priority contributions above.
    const workStyle = staff.identity?.workStyle
    if (workStyle) {
      const styleContribution = PER_WORKSTYLE[workStyle]
      if (styleContribution) {
        // Scaled by the assignment for the same reason as everything else: a
        // careful cook who is not in the kitchen today is not being careful in
        // the kitchen. At the neutral assignment factor of 1 this is exactly the
        // Phase 31 value.
        const f = assignmentFactor
        result.foodQualityModifier += (styleContribution.foodQualityModifier ?? 0) * f
        result.serviceSpeed += (styleContribution.serviceSpeed ?? 0) * f
        result.tabControl += (styleContribution.tabControl ?? 0) * f
        result.messControl += (styleContribution.messControl ?? 0) * f
        result.fightControl += (styleContribution.fightControl ?? 0) * f
        result.repairSupport += (styleContribution.repairSupport ?? 0) * f
      }
    }
  }

  // Round to one decimal so reports stay readable but Phase 12 still
  // has enough resolution for fractional adjustments.
  result.foodQualityModifier = round1(result.foodQualityModifier)
  result.serviceSpeed = round1(result.serviceSpeed)
  result.tabControl = round1(result.tabControl)
  result.messControl = round1(result.messControl)
  result.fightControl = round1(result.fightControl)
  result.repairSupport = round1(result.repairSupport)

  return result
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
