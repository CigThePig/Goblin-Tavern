import { staffPriorityRegistry } from '../../registries/staffPriorityRegistry'
import type {
  StaffPriorityId,
  StaffState,
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

export function derivePriorityModifiers(
  staffMembers: ReadonlyArray<StaffState>,
): ServiceQualityModifiers {
  const result = emptyModifiers()

  for (const staff of staffMembers) {
    const summary = summarizeStaff(staff)
    result.staffSummaries.push(summary)
    if (!summary.canWork) continue
    if (!staff.currentPriority) continue
    if (!staffPriorityRegistry.has(staff.currentPriority)) continue

    const contribution = PER_PRIORITY[staff.currentPriority]
    if (!contribution) continue

    const eff = summary.effectiveness
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
