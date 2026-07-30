import type { EmploymentRecord } from '../../contracts/obligations/index'

// Expansion Phase 3 §3.1 — the employment record's shape and its constants.
//
// A LEAF file, for the same reason `staffEventTypes.ts` is: the lifecycle
// (`employment.ts`), the hiring path (`laborMarket.ts`) and the save migration
// all have to build one of these, and if the factory lived in the lifecycle file
// the hiring path and the lifecycle would import each other.

export const STAFF_MODULE_ID_FOR_EMPLOYMENT = 'staff'

/** Days of notice either side owes by default. */
export const DEFAULT_NOTICE_DAYS = 3

/** Days a new hire is on probation — notice is one day and severance is nil. */
export const PROBATION_DAYS = 7
export const PROBATION_NOTICE_DAYS = 1

/**
 * Discipline rungs before dismissal is a formality.
 *
 * The rung lives on `EmploymentRecord.escalation`, the shared escalation ladder
 * every contract family uses (§1.2) — so a disciplined employee and a debt in
 * collections are counted the same way, by design.
 */
export const MAX_DISCIPLINE_ESCALATION = 3

export function employmentId(staffId: string): string {
  return `emp-${staffId}`
}

/**
 * The daily rate implied by a weekly wage.
 *
 * `StaffState.wage` stays the ONE authoritative wage figure — the weekly
 * settlement, every report and every existing test read it — and this is the
 * derived rate the notice clock needs for severance. Both are written by the same
 * call (`setStaffWage`), so they cannot drift apart.
 */
export function dailyRate(weeklyWage: number): number {
  return Math.round((weeklyWage / 7) * 100) / 100
}

export function createEmploymentRecord(input: {
  staffId: string
  staffName: string
  roleId: string
  weeklyWage: number
  onDay: number
  noticeDays?: number
  reason: string
}): EmploymentRecord {
  return {
    id: employmentId(input.staffId),
    family: 'employment',
    ownerModuleId: STAFF_MODULE_ID_FOR_EMPLOYMENT,
    counterparty: { kind: 'staff', id: input.staffId },
    status: 'active',
    openedOnDay: input.onDay,
    graceDays: 0,
    lastTransitionOnDay: input.onDay,
    history: [
      { onDay: input.onDay, from: 'pending', to: 'active', reason: input.reason },
    ],
    escalation: 0,
    readable: `${input.staffName} is employed at ${input.weeklyWage} coin a week.`,
    tags: ['staff', 'employment', input.roleId, input.staffId],
    staffId: input.staffId,
    wagePerDay: dailyRate(input.weeklyWage),
    noticeDays: input.noticeDays ?? DEFAULT_NOTICE_DAYS,
  }
}
