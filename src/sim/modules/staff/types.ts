import type { StaffPriorityId, StaffRoleId } from '../../state/TavernState'
import type { StaffWorkforceState } from './workforceTypes'

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

/**
 * Expansion Phase 3 — the slice keeps its Phase 11 per-day fields and gains
 * the persistent workforce records (`StaffWorkforceState`).
 *
 * They are merged into one slice rather than split into a second module id
 * because there is one owner of staff transitions (§5.4), and a second slice
 * would mean a second owner with the same responsibilities. The per-day/
 * persistent split is expressed by which fields the morning reset clears, not
 * by which object they live in.
 */
export type StaffModuleState = StaffWorkforceState & {
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
  /**
   * Expansion Phase 3 §3.2 — staff whose focus actually changed today.
   *
   * Recorded during the assignment hook, before `currentPriority` is
   * overwritten, because that is the only moment the previous value is still
   * readable. The roster charges those members a handoff cost, which is what
   * makes churning priorities every morning a decision with a price rather than
   * a free lever.
   */
  priorityChanges: string[]
  /** Service-quality modifiers derived after priorities are assigned. */
  serviceQuality: ServiceQualityModifiers
}
