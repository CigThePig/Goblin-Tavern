import type { StaffState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'

// Phase 11 §11.4 — Staff performance helpers.
//
// These derive purely from a `StaffState`. They never touch context
// state directly; callers compose them into service math (Phase 12
// will). The formula is intentionally modest — Phase 11 builds a
// signal, Phase 12 onward tunes the response.

const STRESS_WEIGHT = 0.25
const FATIGUE_WEIGHT = 0.25
const MORALE_WEIGHT = 0.2

export function getStaffStressPenalty(staff: StaffState): number {
  return Math.max(0, Math.round(staff.stress * STRESS_WEIGHT))
}

export function getStaffFatiguePenalty(staff: StaffState): number {
  return Math.max(0, Math.round(staff.fatigue * FATIGUE_WEIGHT))
}

export function getStaffMoraleBonus(staff: StaffState): number {
  return Math.max(0, Math.round(staff.morale * MORALE_WEIGHT))
}

export function canStaffWork(staff: StaffState): boolean {
  if (staff.unavailable === true) return false
  // A completely broken staff member (skill 0 + extremely fatigued/stressed)
  // still occupies a wage slot but produces zero useful effectiveness.
  // The boolean flag here is the explicit "can show up at all" signal —
  // numeric effectiveness handles the gradient.
  return true
}

export function getStaffEffectiveness(staff: StaffState): number {
  if (!canStaffWork(staff)) return 0
  const raw =
    staff.skill +
    getStaffMoraleBonus(staff) -
    getStaffStressPenalty(staff) -
    getStaffFatiguePenalty(staff)
  return clampPercent(Math.round(raw))
}
