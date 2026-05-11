import type { StaffPriorityId, StaffRoleId } from '../../state/TavernState'

// Phase 11 — Staff module types.
//
// `StaffPriorityAssignment` is the per-day input shape used by
// `SimInput.staffPriorities`. The map allows partial input — any staff
// id not present in the map falls back to the role's default priority
// during `assignStaffPriorities` (Phase 11 §11.3).
//
// `ServiceQualityModifiers` is the **plumbing-only** surface Phase 12
// will consume during service. Phase 11 derives the modifiers from
// staff effectiveness + priority tags and writes them to the staff
// module slice so reports can show the values; Phase 12 reads them
// when resolving sales/satisfaction/mess/damage. Phase 11 does NOT
// wire the values into customer math — that boundary is exactly what
// §11.5 ("priority effects via context") protects.

export type StaffPriorityAssignment = Record<string, StaffPriorityId>

export type StaffEffectivenessSummary = {
  staffId: string
  roleId: StaffRoleId
  priorityId: StaffPriorityId | undefined
  effectiveness: number
  stressPenalty: number
  fatiguePenalty: number
  moraleBonus: number
  canWork: boolean
}

export type ServiceQualityModifiers = {
  foodQualityModifier: number
  serviceSpeed: number
  tabControl: number
  messControl: number
  fightControl: number
  repairSupport: number
  /** Per-staff summary used by reports and (later) Phase 12 service math. */
  staffSummaries: StaffEffectivenessSummary[]
}

export type StaffModuleState = {
  /** Per-day priority assignment that was actually applied (after
   * default fallback). */
  appliedPriorities: Record<string, StaffPriorityId>
  /** Rejected priority inputs (unknown staff id, invalid priority for
   * role, or unknown priority id). Surfaced in the daily report. */
  rejectedAssignments: Array<{
    staffId: string
    priorityId: string
    reason: 'unknown_staff' | 'unknown_priority' | 'priority_not_allowed_for_role'
  }>
  /** Service-quality modifiers derived after priorities are assigned. */
  serviceQuality: ServiceQualityModifiers
}
